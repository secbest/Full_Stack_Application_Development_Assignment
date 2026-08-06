jest.mock('../../src/models', () => ({
  Invoice: { findAll: jest.fn() },
  SurchargeSchedule: { findAll: jest.fn() },
  Booking: {}, Client: {}, ServiceMemo: {}, VendorInvoice: {}, PricingContract: {}, JobMilestone: {}, XeroSyncLog: {},
}))

const { Invoice, SurchargeSchedule } = require('../../src/models')
const { leakageHistory } = require('../../src/controllers/dashboardController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => { jest.clearAllMocks() })

describe('leakageHistory', () => {
  test('groups estimated leakage by month, skipping invoices with no unpriced surcharges', async () => {
    SurchargeSchedule.findAll.mockResolvedValue([{ surcharge_type: 'oxygen_per_litre', amount: 10 }])
    Invoice.findAll.mockResolvedValue([
      {
        id: 1, createdAt: new Date('2026-06-10T00:00:00.000Z'),
        Booking: { reference_number: 'BKG-001' }, Client: { name: 'TTSH' },
        unpriced_surcharges: [{ surcharge_type: 'oxygen_per_litre', label: 'Oxygen', quantity: 2 }],
      },
      {
        id: 2, createdAt: new Date('2026-06-20T00:00:00.000Z'),
        Booking: { reference_number: 'BKG-002' }, Client: { name: 'CGH' },
        unpriced_surcharges: [],
      },
      {
        id: 3, createdAt: new Date('2026-07-01T00:00:00.000Z'),
        Booking: { reference_number: 'BKG-003' }, Client: { name: 'TTSH' },
        unpriced_surcharges: [{ surcharge_type: 'oxygen_per_litre', label: 'Oxygen', quantity: 1 }],
      },
    ])

    const res = mockRes()
    await leakageHistory({ query: {} }, res)

    const history = jsonBody(res).data.history
    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({ month: '2026-06', estimated_leakage: 20, affected_invoice_count: 1 })
    expect(history[0].rows).toEqual([
      { invoice_id: 1, booking_reference: 'BKG-001', client_name: 'TTSH', created_at: new Date('2026-06-10T00:00:00.000Z'), unpriced_count: 1, estimated_amount: 20 },
    ])
    expect(history[1]).toMatchObject({ month: '2026-07', estimated_leakage: 10, affected_invoice_count: 1 })
  })

  test('returns an empty history array when no invoice has unpriced surcharges', async () => {
    SurchargeSchedule.findAll.mockResolvedValue([])
    Invoice.findAll.mockResolvedValue([{ id: 1, createdAt: new Date(), Booking: null, Client: null, unpriced_surcharges: [] }])

    const res = mockRes()
    await leakageHistory({ query: {} }, res)

    expect(jsonBody(res).data.history).toEqual([])
  })
})
