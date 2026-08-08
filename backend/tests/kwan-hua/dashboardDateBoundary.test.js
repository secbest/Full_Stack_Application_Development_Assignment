// Owner: Kwan Hua - regression cover for the MD dashboard off-by-one-day defect.
//
// Doris's Executive Dashboard reported every figure one calendar day behind: the Fleet tab's
// "Today" showed yesterday's bookings, and even an explicit date_to=2026-08-08 came back as
// 2026-08-07. Two separate inputs both land on the same broken formatter:
//
//   1. resolvePeriodRange() builds local midnight via startOfDay(new Date()).
//   2. Yup.date() in fleetOverviewQuerySchema/vendorExpensesQuerySchema coerces a bare
//      "2026-08-08" query param to LOCAL midnight (Yup parses date-only strings as local -
//      native `new Date("2026-08-08")` parses them as UTC, which is why this is easy to miss).
//
// toDateOnly() then called .toISOString(), converting to UTC before slicing. In Singapore
// (UTC+8) local midnight is 16:00 the previous day in UTC, so the calendar day shifted back
// by one. The fix reads local date components instead.
//
// These tests pin the boundary explicitly rather than asserting "today", because a test that
// computes its expectation the same way the code does would have passed against the bug.
jest.mock('../../src/models', () => ({
  Booking: { findAll: jest.fn() },
  ServiceMemo: { findAll: jest.fn() },
  Invoice: { count: jest.fn(), findAll: jest.fn() },
  VendorInvoice: { findAll: jest.fn() },
  PricingContract: {},
  SurchargeSchedule: {},
  Client: {},
  JobMilestone: {},
  XeroSyncLog: {},
  User: {},
  GeocodedLocation: {},
}))

const { Op } = require('sequelize')
const { Booking, ServiceMemo, Invoice, VendorInvoice } = require('../../src/models')
const { fleetOverview, vendorExpenses } = require('../../src/controllers/dashboardController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
const payload = (res) => res.json.mock.calls[0][0]

beforeEach(() => {
  jest.clearAllMocks()
  Booking.findAll.mockResolvedValue([])
  ServiceMemo.findAll.mockResolvedValue([])
  Invoice.count.mockResolvedValue(0)
  VendorInvoice.findAll.mockResolvedValue([])
})

describe('fleetOverview - the caller\'s calendar day survives the round trip', () => {
  // Yup.date() hands the controller a Date at LOCAL midnight, which is what the real
  // request pipeline produces. Passing a raw string here would not reproduce the bug.
  const localMidnight = (ymd) => {
    const [y, m, d] = ymd.split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  test('an explicit single-day range comes back as that same day, not the day before', async () => {
    const req = { query: { date_from: localMidnight('2026-08-08'), date_to: localMidnight('2026-08-08') } }
    const res = mockRes()
    await fleetOverview(req, res)

    expect(payload(res).data.period).toEqual({ from: '2026-08-08', to: '2026-08-08' })
  })

  test('the DB is queried on the requested day, not a shifted one', async () => {
    const req = { query: { date_from: localMidnight('2026-08-08'), date_to: localMidnight('2026-08-08') } }
    await fleetOverview(req, mockRes())

    // Op.between is a Symbol key, so it has to be read through the Op export - a plain
    // Object.values() walk silently skips it and asserts nothing.
    const where = Booking.findAll.mock.calls[0][0].where
    expect(where.scheduled_date[Op.between]).toEqual(['2026-08-08', '2026-08-08'])
  })

  test('a multi-day range keeps both ends intact', async () => {
    const req = { query: { date_from: localMidnight('2026-01-01'), date_to: localMidnight('2026-12-31') } }
    const res = mockRes()
    await fleetOverview(req, res)

    expect(payload(res).data.period).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  test('period=today resolves to the server\'s current calendar day', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 8, 0, 30)) // 00:30 local - the worst case
    try {
      const res = mockRes()
      await fleetOverview({ query: { period: 'today' } }, res)
      expect(payload(res).data.period).toEqual({ from: '2026-08-08', to: '2026-08-08' })
    } finally {
      jest.useRealTimers()
    }
  })

  test('period=this_month starts on the 1st, not the last day of the previous month', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 8, 0, 30))
    try {
      const res = mockRes()
      await fleetOverview({ query: { period: 'this_month' } }, res)
      expect(payload(res).data.period).toEqual({ from: '2026-08-01', to: '2026-08-08' })
    } finally {
      jest.useRealTimers()
    }
  })
})

describe('vendorExpenses - the default end of range is today, not yesterday', () => {
  test('an invoice dated today is inside the default window', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 7, 8, 0, 30))
    try {
      await vendorExpenses({ query: {} }, mockRes())

      const where = VendorInvoice.findAll.mock.calls[0][0].where
      const [, to] = where.invoice_date[Op.between]
      expect(to).toBe('2026-08-08')
    } finally {
      jest.useRealTimers()
    }
  })
})
