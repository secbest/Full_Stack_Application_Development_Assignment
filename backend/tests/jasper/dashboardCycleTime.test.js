const { Op } = require('sequelize')

jest.mock('../../src/models', () => ({
  JobMilestone: { findAll: jest.fn() },
  ServiceMemo: { findAll: jest.fn() },
  Invoice: { findAll: jest.fn() },
  XeroSyncLog: { findAll: jest.fn() },
  Booking: {},
  VendorInvoice: {},
  PricingContract: {},
  SurchargeSchedule: {},
  Client: {},
}))

const { JobMilestone, ServiceMemo, Invoice, XeroSyncLog } = require('../../src/models')
const { cycleTime } = require('../../src/controllers/dashboardController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => { jest.clearAllMocks() })

describe('cycleTime', () => {
  test('returns null averages and an empty row set when nothing completed in the period', async () => {
    JobMilestone.findAll.mockResolvedValue([])

    const req = { query: { date_from: '2026-01-01', date_to: '2026-01-31' } }
    const res = mockRes()
    await cycleTime(req, res)

    expect(jsonBody(res).data).toMatchObject({
      booking_count: 0,
      overall_average_days: null,
      stage_averages_days: { job_to_memo: null, memo_to_invoice: null, invoice_to_sync: null },
      rows: [],
    })
  })

  test('computes per-stage and overall day averages for a fully-synced booking', async () => {
    const jobCompletedAt = new Date('2026-06-01T00:00:00.000Z')
    const memoSubmittedAt = new Date('2026-06-02T00:00:00.000Z')   // +1 day
    const invoiceApprovedAt = new Date('2026-06-04T00:00:00.000Z') // +2 days
    const syncedAt = new Date('2026-06-05T00:00:00.000Z')          // +1 day

    JobMilestone.findAll.mockResolvedValue([{ booking_id: 1, recorded_at: jobCompletedAt }])
    ServiceMemo.findAll.mockResolvedValue([{ booking_id: 1, createdAt: memoSubmittedAt }])
    Invoice.findAll.mockResolvedValue([{ id: 50, booking_id: 1, approved_at: invoiceApprovedAt }])
    XeroSyncLog.findAll.mockResolvedValue([{ entity_id: 50, synced_at: syncedAt }])

    const req = { query: {} }
    const res = mockRes()
    await cycleTime(req, res)

    const data = jsonBody(res).data
    expect(data.booking_count).toBe(1)
    expect(data.stage_averages_days).toEqual({ job_to_memo: 1, memo_to_invoice: 2, invoice_to_sync: 1 })
    expect(data.overall_average_days).toBe(4)
    expect(data.rows[0]).toMatchObject({ booking_id: 1, total_days: 4 })
  })

  test('a booking with no invoice yet contributes to job_to_memo but not to invoice_to_sync', async () => {
    const jobCompletedAt = new Date('2026-06-01T00:00:00.000Z')
    const memoSubmittedAt = new Date('2026-06-03T00:00:00.000Z') // +2 days

    JobMilestone.findAll.mockResolvedValue([{ booking_id: 2, recorded_at: jobCompletedAt }])
    ServiceMemo.findAll.mockResolvedValue([{ booking_id: 2, createdAt: memoSubmittedAt }])
    Invoice.findAll.mockResolvedValue([])
    XeroSyncLog.findAll.mockResolvedValue([])

    const req = { query: {} }
    const res = mockRes()
    await cycleTime(req, res)

    const data = jsonBody(res).data
    expect(data.stage_averages_days.job_to_memo).toBe(2)
    expect(data.stage_averages_days.memo_to_invoice).toBeNull()
    expect(data.stage_averages_days.invoice_to_sync).toBeNull()
    expect(data.overall_average_days).toBeNull()
  })
})
