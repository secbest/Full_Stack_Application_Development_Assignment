jest.mock('../../src/models', () => ({
  VendorInvoiceItem: { findByPk: jest.fn(), findAll: jest.fn() },
  VendorInvoice: {},
}))

const { VendorInvoiceItem } = require('../../src/models')
const { updateVendorInvoiceItem } = require('../../src/controllers/vendorInvoiceItemController')

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
  return { item, parent }
}

beforeEach(() => jest.clearAllMocks())

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

  test('rejects a non-positive amount', async () => {
    const { item } = makeItem()
    VendorInvoiceItem.findByPk.mockResolvedValue(item)
    const res = mockRes()
    await updateVendorInvoiceItem({ params: { id: 5 }, body: { amount: 0 } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('INVALID_AMOUNT')
  })

  test('updates description/quantity without touching the parent total when amount is unchanged', async () => {
    const { item, parent } = makeItem()
    VendorInvoiceItem.findByPk.mockResolvedValue(item)
    const res = mockRes()
    await updateVendorInvoiceItem({ params: { id: 5 }, body: { description: 'Diesel' } }, res)
    expect(item.description).toBe('Diesel')
    expect(parent.update).not.toHaveBeenCalled()
    expect(payload(res).data.parent_invoice.extracted_total).toBe(900)
  })

  test('recomputes the parent extracted_total and rebate from all line items when amount changes', async () => {
    const { item, parent } = makeItem()
    VendorInvoiceItem.findByPk.mockResolvedValue(item)
    VendorInvoiceItem.findAll.mockResolvedValue([{ amount: 1000 }, { amount: 200 }])

    const res = mockRes()
    await updateVendorInvoiceItem({ params: { id: 5 }, body: { amount: 1000 } }, res)

    expect(parent.extracted_total).toBe(1200)
    expect(parent.rebate_amount).toBe(12)
    expect(parent.verified_total).toBe(1188)
    expect(payload(res).data.parent_invoice.extracted_total).toBe(1200)
  })
})
