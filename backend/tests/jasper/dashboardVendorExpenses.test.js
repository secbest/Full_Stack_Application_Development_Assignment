// Owner: Jasper - Plan 3 final-review fix 4 (2026-08-06-md-reports-real-data.md).
// `vendorExpenses` is a REUSED pre-existing function (originally built for the Executive
// Dashboard's Expense Summary tab) that never had a try/catch, unlike every function this
// plan added new. Task 9 of the plan makes it fire on every MD Reports page load too, so an
// unhandled rejection here now has a bigger blast radius than before. This file confirms the
// happy path still passes after wrapping the body in try/catch, and adds the previously
// missing error-path coverage (a thrown/rejected VendorInvoice.findAll must return 500
// INTERNAL_ERROR, not crash the process) - matching the pattern used for the other
// internalError-covered handlers (see bookingMilestonesInclude.test.js).
jest.mock('../../src/models', () => ({
  Booking: {},
  ServiceMemo: {},
  Invoice: {},
  VendorInvoice: { findAll: jest.fn() },
  PricingContract: {},
  SurchargeSchedule: {},
  Client: {},
  JobMilestone: {},
  XeroSyncLog: {},
}))

const { VendorInvoice } = require('../../src/models')
const { vendorExpenses } = require('../../src/controllers/dashboardController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => jest.clearAllMocks())

describe('vendorExpenses - happy path (still passes after adding try/catch)', () => {
  test('aggregates totals and per-vendor breakdown from approved/synced vendor invoices', async () => {
    VendorInvoice.findAll.mockResolvedValue([
      { vendor_name: 'Acme Medical Supplies', invoice_date: '2026-06-05', verified_total: '100.00', extracted_total: '95.00', rebate_amount: '10.00' },
      { vendor_name: 'Acme Medical Supplies', invoice_date: '2026-06-20', verified_total: null, extracted_total: '50.00', rebate_amount: null },
    ])

    const req = { query: { date_from: '2026-06-01', date_to: '2026-06-30' } }
    const res = mockRes()
    await vendorExpenses(req, res)

    expect(res.status).not.toHaveBeenCalledWith(500)
    const data = payload(res).data
    expect(data.summary).toMatchObject({ total_expenditure: '150.00', total_rebates_applied: '10.00', net_payable: '140.00', invoice_count: 2 })
    expect(data.by_vendor[0]).toMatchObject({ vendor_name: 'Acme Medical Supplies', total_expenditure: '150.00', total_rebates: '10.00', net_payable: '140.00', invoice_count: 2 })
  })
})

describe('vendorExpenses - a DB error is caught, not left to crash the process', () => {
  test('returns 500 INTERNAL_ERROR instead of throwing when VendorInvoice.findAll rejects', async () => {
    VendorInvoice.findAll.mockRejectedValue(Object.assign(new Error('connection terminated'), { name: 'SequelizeConnectionError' }))

    const req = { query: {} }
    const res = mockRes()
    await expect(vendorExpenses(req, res)).resolves.not.toThrow()

    expect(res.status).toHaveBeenCalledWith(500)
    expect(payload(res).code).toBe('INTERNAL_ERROR')
  })
})
