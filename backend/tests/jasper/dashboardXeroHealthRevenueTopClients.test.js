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
})

describe('topClients', () => {
  test('ranks clients by total synced revenue, capped at 5, with booking_count attached', async () => {
    Invoice.findAll.mockResolvedValue([
      { client_id: 1, total_amount: '1000.00', Client: { id: 1, name: 'TTSH' } },
      { client_id: 1, total_amount: '500.00',  Client: { id: 1, name: 'TTSH' } },
      { client_id: 2, total_amount: '2000.00', Client: { id: 2, name: 'CGH' } },
    ])
    Booking.findAll.mockResolvedValue([
      { client_id: 1, id: 10 }, { client_id: 1, id: 11 }, { client_id: 2, id: 12 },
    ])

    const res = mockRes()
    await topClients({ query: {} }, res)

    const data = jsonBody(res).data
    expect(data.top_clients[0]).toMatchObject({ client_id: 2, client_name: 'CGH', total_revenue: '2000.00', invoice_count: 1, booking_count: 1 })
    expect(data.top_clients[1]).toMatchObject({ client_id: 1, client_name: 'TTSH', total_revenue: '1500.00', invoice_count: 2, booking_count: 2 })
  })
})
