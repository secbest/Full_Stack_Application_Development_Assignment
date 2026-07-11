jest.mock('../../src/models', () => ({
  Invoice: { findByPk: jest.fn(), findAndCountAll: jest.fn() },
  InvoiceLineItem: { findAll: jest.fn(), create: jest.fn(), findOne: jest.fn() },
  Booking: { update: jest.fn() },
  Client: { findByPk: jest.fn() },
  ServiceMemo: { update: jest.fn() },
  PricingContract: {},
  User: {},
  XeroSyncLog: { create: jest.fn() },
}))

jest.mock('../../src/services', () => ({
  xeroService: { pushArInvoice: jest.fn() },
}))

jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))

jest.mock('../../src/controllers/xeroController', () => ({ getFreshConnection: jest.fn() }))

const { Invoice, InvoiceLineItem, Client, XeroSyncLog } = require('../../src/models')
const { xeroService } = require('../../src/services')
const notificationService = require('../../src/services/notificationService')
const xeroController = require('../../src/controllers/xeroController')
const {
  addLineItem, updateLineItem, deleteLineItem, batchApprove, retryXero,
} = require('../../src/controllers/invoiceController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}
function makeInvoice(overrides = {}) {
  const obj = { id: 1, status: 'matched', tax_amount: 0, subtotal: 850, total_amount: 850, ...overrides }
  obj.update = jest.fn(async (fields) => { Object.assign(obj, fields); return obj })
  return obj
}

beforeEach(() => jest.clearAllMocks())

describe('addLineItem (UC-05)', () => {
  test('404s when the invoice does not exist', async () => {
    Invoice.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await addLineItem({ params: { invoiceId: 1 }, body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('blocks edits once the invoice is approved or synced', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ status: 'approved' }))
    const res = mockRes()
    await addLineItem({ params: { invoiceId: 1 }, body: { description: 'x', quantity: 1, unit_price: 10 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('INVOICE_LOCKED')
  })

  test('rejects a missing description or non-positive quantity/price', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice())
    const res = mockRes()
    await addLineItem({ params: { invoiceId: 1 }, body: { description: '  ', quantity: 0, unit_price: 10 } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('VALIDATION_ERROR')
  })

  test('adds a manual line item, flips a matched invoice to adjusted, and recalculates totals', async () => {
    const invoice = makeInvoice({ status: 'matched', tax_amount: 0 })
    Invoice.findByPk.mockResolvedValue(invoice)
    InvoiceLineItem.create.mockResolvedValue({ id: 9, invoice_id: 1, description: 'Extra mileage', quantity: 1, unit_price: 40, amount: 40, is_manual_adjustment: true })
    InvoiceLineItem.findAll.mockResolvedValue([{ amount: 850 }, { amount: 40 }])

    const res = mockRes()
    await addLineItem({ params: { invoiceId: 1 }, body: { description: 'Extra mileage', quantity: 1, unit_price: 40 } }, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(invoice.status).toBe('adjusted')
    expect(payload(res).data.invoice.subtotal).toBe(890)
  })
})

describe('updateLineItem (UC-05)', () => {
  test('rejects a negative quantity', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice())
    InvoiceLineItem.findOne.mockResolvedValue({ id: 1, invoice_id: 1, quantity: 1, unit_price: 10, amount: 10 })
    const res = mockRes()
    await updateLineItem({ params: { invoiceId: 1, itemId: 1 }, body: { quantity: -1 } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('VALIDATION_ERROR')
  })

  test('404s when the line item does not belong to this invoice', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice())
    InvoiceLineItem.findAll.mockResolvedValue([]) // for the not-found path we short-circuit below
    InvoiceLineItem.findOne.mockResolvedValue(null)
    const res = mockRes()
    await updateLineItem({ params: { invoiceId: 1, itemId: 999 }, body: { quantity: 2 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('recomputes amount = quantity * unit_price and re-totals the invoice', async () => {
    const invoice = makeInvoice({ status: 'matched' })
    Invoice.findByPk.mockResolvedValue(invoice)
    const item = { id: 1, invoice_id: 1, description: 'Base', quantity: 1, unit_price: 850, amount: 850 }
    item.update = jest.fn(async (f) => Object.assign(item, f))
    InvoiceLineItem.findOne.mockResolvedValue(item)
    InvoiceLineItem.findAll.mockResolvedValue([{ amount: 950 }])

    const res = mockRes()
    await updateLineItem({ params: { invoiceId: 1, itemId: 1 }, body: { unit_price: 950 } }, res)

    expect(item.amount).toBe(950)
    expect(invoice.status).toBe('adjusted')
    expect(res.status).toHaveBeenCalledWith(200)
  })

  test('flips an unmatched invoice to adjusted, same as addLineItem', async () => {
    const invoice = makeInvoice({ status: 'unmatched', subtotal: 0, total_amount: 0 })
    Invoice.findByPk.mockResolvedValue(invoice)
    const item = { id: 1, invoice_id: 1, description: 'Manual price', quantity: 1, unit_price: 100, amount: 100 }
    item.update = jest.fn(async (f) => Object.assign(item, f))
    InvoiceLineItem.findOne.mockResolvedValue(item)
    InvoiceLineItem.findAll.mockResolvedValue([{ amount: 120 }])

    const res = mockRes()
    await updateLineItem({ params: { invoiceId: 1, itemId: 1 }, body: { unit_price: 120 } }, res)

    expect(invoice.status).toBe('adjusted')
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

describe('deleteLineItem (UC-05)', () => {
  test('403s when trying to delete an engine-generated line item', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice())
    InvoiceLineItem.findOne.mockResolvedValue({ id: 1, is_manual_adjustment: false })
    const res = mockRes()
    await deleteLineItem({ params: { invoiceId: 1, itemId: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(payload(res).code).toBe('SYSTEM_LINE_ITEM')
  })

  test('deletes a manual line item and recalculates totals', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice())
    const item = { id: 2, is_manual_adjustment: true, destroy: jest.fn().mockResolvedValue() }
    InvoiceLineItem.findOne.mockResolvedValue(item)
    InvoiceLineItem.findAll.mockResolvedValue([{ amount: 850 }])
    const res = mockRes()
    await deleteLineItem({ params: { invoiceId: 1, itemId: 2 } }, res)
    expect(item.destroy).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

describe('batchApprove (UC-06)', () => {
  test('rejects an empty/non-array invoice_ids', async () => {
    const res = mockRes()
    await batchApprove({ body: { invoice_ids: [] }, user: { sub: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('VALIDATION_ERROR')
  })

  test('503s when Xero is not connected', async () => {
    xeroController.getFreshConnection.mockResolvedValue(null)
    const res = mockRes()
    await batchApprove({ body: { invoice_ids: [1] }, user: { sub: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(payload(res).code).toBe('XERO_NOT_CONNECTED')
  })

  test('skips invoices not in matched/adjusted status and syncs the rest', async () => {
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    const eligible = makeInvoice({ id: 1, status: 'matched' })
    const ineligible = makeInvoice({ id: 2, status: 'unmatched' })
    Invoice.findByPk.mockImplementation((id) => Promise.resolve(id === 1 ? eligible : ineligible))
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: true, xeroRecordId: 'INV-XR-1' })
    XeroSyncLog.create.mockResolvedValue({})

    const res = mockRes()
    await batchApprove({ body: { invoice_ids: [1, 2] }, user: { sub: 1 } }, res)

    expect(payload(res).data.approved).toEqual([1])
    expect(payload(res).data.skipped).toEqual([2])
    expect(payload(res).data.queued_for_xero).toEqual([1])
    expect(eligible.status).toBe('synced_to_xero')
  })

  test('marks an invoice failed and notifies when the Xero push itself fails', async () => {
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    const invoice = makeInvoice({ id: 3, status: 'matched', approved_by: 7 })
    Invoice.findByPk.mockResolvedValue(invoice)
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: false, error: 'Xero rejected the invoice' })
    XeroSyncLog.create.mockResolvedValue({})

    const res = mockRes()
    await batchApprove({ body: { invoice_ids: [3] }, user: { sub: 1 } }, res)

    expect(invoice.status).toBe('failed')
    expect(payload(res).data.queued_for_xero).toEqual([])
    expect(notificationService.create).toHaveBeenCalled()
  })
})

describe('retryXero (UC-07 alt / UC-10)', () => {
  test('404s when the invoice does not exist', async () => {
    Invoice.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('409s when the invoice is not in failed status', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ status: 'matched' }))
    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('INVOICE_NOT_FAILED')
  })

  test('503s when Xero is not connected', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ status: 'failed' }))
    xeroController.getFreshConnection.mockResolvedValue(null)
    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(503)
  })

  test('502s when Xero rejects the retried push', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ status: 'failed' }))
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: false, error: 'still down' })
    XeroSyncLog.create.mockResolvedValue({})
    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(502)
    expect(payload(res).code).toBe('XERO_SYNC_ERROR')
  })

  test('re-syncs successfully and advances the invoice to synced_to_xero', async () => {
    const invoice = makeInvoice({ status: 'failed' })
    Invoice.findByPk.mockResolvedValue(invoice)
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: true, xeroRecordId: 'INV-XR-99' })
    XeroSyncLog.create.mockResolvedValue({})
    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(payload(res).data.xero_invoice_id).toBe('INV-XR-99')
    expect(invoice.status).toBe('synced_to_xero')
  })
})
