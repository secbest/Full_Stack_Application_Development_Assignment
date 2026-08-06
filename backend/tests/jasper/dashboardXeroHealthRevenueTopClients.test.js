jest.mock('../../src/models', () => ({
  Invoice: { count: jest.fn(), findAll: jest.fn() },
  XeroSyncLog: { findOne: jest.fn() },
  Booking: { findAll: jest.fn() },
  Client: {},
  ServiceMemo: {},
  VendorInvoice: {},
  PricingContract: {},
  SurchargeSchedule: {},
  JobMilestone: {},
}))
jest.mock('../../src/services/xeroService', () => ({
  describeMode: jest.fn(),
}))

const { Invoice, XeroSyncLog, Booking } = require('../../src/models')
const xeroService = require('../../src/services/xeroService')
const { xeroHealth, revenueTrend, topClients } = require('../../src/controllers/dashboardController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => { jest.clearAllMocks() })

describe('xeroHealth', () => {
  test('returns synced/pending/failed counts, last sync time, and the current mode', async () => {
    Invoice.count.mockImplementation(({ where }) => {
      if (where.status === 'synced_to_xero') return Promise.resolve(12)
      if (where.status === 'approved') return Promise.resolve(3)
      if (where.status === 'failed') return Promise.resolve(1)
      return Promise.resolve(0)
    })
    const lastSync = new Date('2026-08-01T00:00:00.000Z')
    XeroSyncLog.findOne.mockResolvedValue({ synced_at: lastSync })
    xeroService.describeMode.mockReturnValue({ simulated: true, label: 'SIMULATION', detail: 'Xero calls are simulated.' })

    const res = mockRes()
    await xeroHealth({ query: {} }, res)

    expect(jsonBody(res).data).toEqual({
      counts: { synced: 12, pending: 3, failed: 1 },
      last_synced_at: lastSync,
      mode: { simulated: true, label: 'SIMULATION', detail: 'Xero calls are simulated.' },
    })
  })
})

describe('revenueTrend', () => {
  test('buckets synced invoice revenue by month by default', async () => {
    Invoice.findAll.mockResolvedValue([
      { total_amount: '100.00', createdAt: new Date('2026-06-05T00:00:00.000Z') },
      { total_amount: '50.50',  createdAt: new Date('2026-06-20T00:00:00.000Z') },
      { total_amount: '75.00',  createdAt: new Date('2026-07-01T00:00:00.000Z') },
    ])

    const res = mockRes()
    await revenueTrend({ query: {} }, res)

    const data = jsonBody(res).data
    expect(data.granularity).toBe('month')
    expect(data.trend).toEqual(
      expect.arrayContaining([
        { bucket: '2026-06', total_revenue: '150.50' },
        { bucket: '2026-07', total_revenue: '75.00' },
      ])
    )
  })

  test('buckets by ISO week in UTC, so invoices in the same UTC week land in the same bucket regardless of local time-of-day', async () => {
    Invoice.findAll.mockResolvedValue([
      // Monday 2026-06-01 18:00 UTC and Wednesday 2026-06-03 02:00 UTC - same UTC week.
      // On a non-UTC server, local-time bucketing could split these across two buckets.
      { total_amount: '100.00', createdAt: new Date('2026-06-01T18:00:00.000Z') },
      { total_amount: '50.00',  createdAt: new Date('2026-06-03T02:00:00.000Z') },
    ])

    const res = mockRes()
    await revenueTrend({ query: { granularity: 'week' } }, res)

    const data = jsonBody(res).data
    expect(data.granularity).toBe('week')
    expect(data.trend).toEqual([
      { bucket: '2026-06-01', total_revenue: '150.00' },
    ])
  })
})

describe('topClients', () => {
  test('ranks clients by total synced revenue, capped at 5, with booking_count attached', async () => {
    Invoice.findAll.mockResolvedValue([
      { client_id: 1, total_amount: '1000.00', Client: { id: 1, name: 'TTSH' } },
      { client_id: 1, total_amount: '500.00',  Client: { id: 1, name: 'TTSH' } },
      { client_id: 2, total_amount: '2000.00', Client: { id: 2, name: 'CGH' } },
    ])
    // Booking.findAll is scoped by the controller to `status: 'invoiced'` - the mock
    // applies that same filter so this test actually catches a regression to the old
    // "count every booking regardless of status" behavior.
    Booking.findAll.mockImplementation(({ where }) => {
      const rows = [
        { client_id: 1, id: 10, status: 'invoiced' },
        { client_id: 1, id: 11, status: 'invoiced' },
        { client_id: 2, id: 12, status: 'invoiced' },
        { client_id: 2, id: 13, status: 'confirmed' }, // never reached 'invoiced' - must not be counted
      ]
      return Promise.resolve(rows.filter((b) => b.status === where.status))
    })

    const res = mockRes()
    await topClients({ query: {} }, res)

    const data = jsonBody(res).data
    expect(data.top_clients[0]).toMatchObject({ client_id: 2, client_name: 'CGH', total_revenue: '2000.00', invoice_count: 1, booking_count: 1 })
    expect(data.top_clients[1]).toMatchObject({ client_id: 1, client_name: 'TTSH', total_revenue: '1500.00', invoice_count: 2, booking_count: 2 })
  })
})
