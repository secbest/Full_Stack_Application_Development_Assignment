jest.mock('../../src/models', () => ({
  VendorInvoiceItem: { create: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
  VendorInvoice: { findByPk: jest.fn() },
}))

jest.mock('../../src/config', () => ({
  transaction: jest.fn(async (fn) => fn({})),
}))

jest.mock('../../src/services', () => ({
  apInvoiceService: { calculateTax: jest.fn(() => 0) },
  vendorInvoiceAuditService: {
    record: jest.fn(async () => ({})),
    diff: jest.fn((before, after, fields) => fields.reduce((out, field) => {
      if (String(before[field]) !== String(after[field])) out[field] = { from: before[field], to: after[field] }
      return out
    }, {})),
  },
}))

const { VendorInvoice, VendorInvoiceItem } = require('../../src/models')
const { vendorInvoiceAuditService } = require('../../src/services')
const { createVendorInvoiceItem, updateVendorInvoiceItem, deleteVendorInvoiceItem } = require('../../src/controllers/vendorInvoiceItemController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}
function makeItem(parentOverrides = {}, itemOverrides = {}) {
  const parent = { id: 1, status: 'pending_review', extracted_total: 900, rebate_percentage: 1.0, rebate_amount: 9, verified_total: 891, ...parentOverrides }
  parent.update = jest.fn(async (f) => Object.assign(parent, f))
  const item = { id: 5, vendor_invoice_id: 1, description: 'Fuel', quantity: 1, unit_price: 900, amount: 900, updatedAt: null, VendorInvoice: parent, ...itemOverrides }
  item.update = jest.fn(async (f) => Object.assign(item, f))
  item.destroy = jest.fn(async () => {})
  return { item, parent }
}

beforeEach(() => jest.clearAllMocks())

describe('createVendorInvoiceItem', () => {
  test('404s when the parent invoice does not exist', async () => {
    VendorInvoice.findByPk.mockResolvedValue(null)
    const res = mockRes()

    await createVendorInvoiceItem({ params: { id: 99 }, body: {} }, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(VendorInvoiceItem.create).not.toHaveBeenCalled()
  })

  test('409s when the parent invoice is not editable', async () => {
    const { parent } = makeItem({ status: 'approved' })
    VendorInvoice.findByPk.mockResolvedValue(parent)
    const res = mockRes()

    await createVendorInvoiceItem({ params: { id: 1 }, body: { description: 'Fuel', quantity: 1, unit_price: 20 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('INVALID_STATUS')
  })

  test('derives amount, recalculates totals and audits the new line', async () => {
    const { parent } = makeItem()
    const createdItem = { id: 8, vendor_invoice_id: 1, description: 'Bandages', quantity: 3, unit_price: 12.5, amount: 37.5, createdAt: null }
    VendorInvoice.findByPk.mockResolvedValue(parent)
    VendorInvoiceItem.create.mockResolvedValue(createdItem)
    VendorInvoiceItem.findAll.mockResolvedValue([{ amount: 900 }, createdItem])
    const res = mockRes()

    await createVendorInvoiceItem({
      params: { id: 1 },
      body: { description: 'Bandages', quantity: 3, unit_price: 12.5, amount: 999 },
      user: { sub: 4 },
    }, res)

    expect(VendorInvoiceItem.create).toHaveBeenCalledWith(expect.objectContaining({ amount: 37.5 }), expect.any(Object))
    expect(parent.extracted_total).toBe(937.5)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(vendorInvoiceAuditService.record).toHaveBeenCalledWith(expect.objectContaining({
      invoiceId: 1,
      userId: 4,
      action: 'line_item_added',
    }))
  })

  test('moves an OCR-failed invoice back to pending review after a manual line is added', async () => {
    const { parent } = makeItem({ status: 'extraction_failed', extracted_total: null })
    const createdItem = { id: 8, vendor_invoice_id: 1, description: 'Transport', quantity: 1, unit_price: 100, amount: 100 }
    VendorInvoice.findByPk.mockResolvedValue(parent)
    VendorInvoiceItem.create.mockResolvedValue(createdItem)
    VendorInvoiceItem.findAll.mockResolvedValue([createdItem])
    const res = mockRes()

    await createVendorInvoiceItem({ params: { id: 1 }, body: { description: 'Transport', quantity: 1, unit_price: 100 } }, res)

    expect(parent.status).toBe('pending_review')
    expect(payload(res).data.parent_invoice.status).toBe('pending_review')
    expect(vendorInvoiceAuditService.record).toHaveBeenCalledWith(expect.objectContaining({
      changes: expect.objectContaining({ status: { from: 'extraction_failed', to: 'pending_review' } }),
    }))
  })
})

describe('updateVendorInvoiceItem (UC-06)', () => {
  test('404s when the line item does not exist', async () => {
    VendorInvoiceItem.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await updateVendorInvoiceItem({ params: { id: 1 }, body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('409s when the parent invoice is not in an editable status', async () => {
    const { item } = makeItem({ status: 'synced_to_xero' })
    VendorInvoiceItem.findByPk.mockResolvedValue(item)
    const res = mockRes()
    await updateVendorInvoiceItem({ params: { id: 5 }, body: { amount: 100 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('INVALID_STATUS')
  })

  // A line item must never be able to claim a total its own figures do not support.
  // `amount` was previously persisted straight from the request body, so (qty 2 x $10)
  // could be stored as $999 - and that $999 then became the invoice's extracted_total,
  // which is the number the rebate and the Xero bill are both derived from.
  test('derives amount from quantity x unit_price and ignores any client-supplied amount', async () => {
    const { item } = makeItem()
    VendorInvoiceItem.findByPk.mockResolvedValue(item)
    VendorInvoiceItem.findAll.mockResolvedValue([{ amount: 20 }])

    const res = mockRes()
    await updateVendorInvoiceItem({ params: { id: 5 }, body: { quantity: 2, unit_price: 10, amount: 999 } }, res)

    expect(item.amount).toBe(20)
    expect(payload(res).data.amount).toBe(20)
  })

  // Regression: the parent recompute used to be gated on `amount !== undefined`, so
  // editing unit_price alone left BOTH the line's amount and the invoice total stale.
  test('recomputes the line amount and the parent total when only unit_price changes', async () => {
    const { item, parent } = makeItem()
    VendorInvoiceItem.findByPk.mockResolvedValue(item)
    // The line's own amount is recomputed first (1 x 1200), so the parent sums to 1200.
    VendorInvoiceItem.findAll.mockResolvedValue([{ amount: 1200 }])

    const res = mockRes()
    await updateVendorInvoiceItem({ params: { id: 5 }, body: { unit_price: 1200 } }, res)

    expect(item.amount).toBe(1200)
    expect(parent.update).toHaveBeenCalled()
    expect(parent.extracted_total).toBe(1200)
    expect(payload(res).data.parent_invoice.extracted_total).toBe(1200)
  })

  test('recomputes the parent extracted_total and rebate from all line items', async () => {
    const { item, parent } = makeItem()
    VendorInvoiceItem.findByPk.mockResolvedValue(item)
    VendorInvoiceItem.findAll.mockResolvedValue([{ amount: 1000 }, { amount: 200 }])

    const res = mockRes()
    await updateVendorInvoiceItem({ params: { id: 5 }, body: { quantity: 1, unit_price: 1000 } }, res)

    expect(parent.extracted_total).toBe(1200)
    expect(parent.rebate_amount).toBe(12)
    expect(parent.verified_total).toBe(1188)
    expect(payload(res).data.parent_invoice.extracted_total).toBe(1200)
  })

  // Cents-safe rounding reaches the line item: 3 x 0.335 is 1.005, which the old
  // Math.round(n * 100) / 100 floored to 1.00 because 1.005 * 100 is 100.49999999999999.
  test('rounds a derived amount to the nearest cent, not down', async () => {
    const { item } = makeItem()
    VendorInvoiceItem.findByPk.mockResolvedValue(item)
    VendorInvoiceItem.findAll.mockResolvedValue([{ amount: 1.01 }])

    const res = mockRes()
    await updateVendorInvoiceItem({ params: { id: 5 }, body: { quantity: 3, unit_price: 0.335 } }, res)

    expect(item.amount).toBe(1.01)
  })
})

describe('deleteVendorInvoiceItem', () => {
  test('404s when the line item does not exist', async () => {
    VendorInvoiceItem.findByPk.mockResolvedValue(null)
    const res = mockRes()

    await deleteVendorInvoiceItem({ params: { id: 99 } }, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('409s when the parent invoice is not editable', async () => {
    const { item } = makeItem({ status: 'synced_to_xero' })
    VendorInvoiceItem.findByPk.mockResolvedValue(item)
    const res = mockRes()

    await deleteVendorInvoiceItem({ params: { id: 5 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(item.destroy).not.toHaveBeenCalled()
  })

  test('deletes the line, recalculates the remaining total and records an audit event', async () => {
    const { item, parent } = makeItem()
    VendorInvoiceItem.findByPk.mockResolvedValue(item)
    VendorInvoiceItem.findAll.mockResolvedValue([{ amount: 300 }, { amount: 200 }])
    const res = mockRes()

    await deleteVendorInvoiceItem({ params: { id: 5 }, user: { sub: 4 } }, res)

    expect(item.destroy).toHaveBeenCalled()
    expect(parent.extracted_total).toBe(500)
    expect(payload(res).data.parent_invoice.extracted_total).toBe(500)
    expect(vendorInvoiceAuditService.record).toHaveBeenCalledWith(expect.objectContaining({
      userId: 4,
      action: 'line_item_deleted',
      changes: expect.objectContaining({ item_id: 5, description: 'Fuel' }),
    }))
  })

  test('allows deleting the final line and leaves approval to reject the empty invoice', async () => {
    const { item, parent } = makeItem()
    VendorInvoiceItem.findByPk.mockResolvedValue(item)
    VendorInvoiceItem.findAll.mockResolvedValue([])
    const res = mockRes()

    await deleteVendorInvoiceItem({ params: { id: 5 } }, res)

    expect(parent.status).toBe('pending_review')
    expect(parent.extracted_total).toBe(0)
    expect(parent.verified_total).toBe(0)
  })
})
