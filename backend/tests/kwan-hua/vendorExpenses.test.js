jest.mock('../../src/models', () => ({
  Booking: {},
  ServiceMemo: {},
  Invoice: {},
  VendorInvoice: { findAll: jest.fn() },
  PricingContract: {},
  SurchargeSchedule: {},
  Client: {},
}))
jest.mock('../../src/services', () => ({ leakageService: {} }))

const { VendorInvoice } = require('../../src/models')
const { vendorExpenses } = require('../../src/controllers/dashboardController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

test('vendor expense summary subtracts the rebate exactly once', async () => {
  VendorInvoice.findAll.mockResolvedValue([{
    vendor_name: 'Medical Supplier',
    invoice_date: '2026-07-01',
    total_including_gst: 109,
    extracted_total: 109,
    rebate_amount: 1.09,
    verified_total: 107.91,
  }])
  const res = mockRes()
  await vendorExpenses({ query: { date_from: '2026-07-01', date_to: '2026-07-31' } }, res)

  const data = res.json.mock.calls[0][0].data
  expect(data.summary).toMatchObject({
    total_expenditure: '109.00',
    total_rebates_applied: '1.09',
    net_payable: '107.91',
  })
  expect(data.by_vendor[0].net_payable).toBe('107.91')
  expect(data.monthly_trend[0].net_payable).toBe('107.91')
})
