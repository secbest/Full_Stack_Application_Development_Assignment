jest.mock('../../src/models', () => ({
  Invoice: { findAll: jest.fn() },
  Booking: {},
  Client: {},
  ServiceMemo: {},
  VendorInvoice: {},
  PricingContract: {},
  SurchargeSchedule: {},
  JobMilestone: {},
  XeroSyncLog: {},
}))

const { Invoice } = require('../../src/models')
const { revenueByServiceType } = require('../../src/controllers/dashboardController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => { jest.clearAllMocks() })

describe('revenueByServiceType', () => {
  test('sums total_amount per Booking.service_type, sorted descending, with a friendly label', async () => {
    Invoice.findAll.mockResolvedValue([
      { total_amount: '100.00', Booking: { service_type: 'eas' } },
      { total_amount: '50.00',  Booking: { service_type: 'mts' } },
      { total_amount: '25.00',  Booking: { service_type: 'eas' } },
    ])

    const req = { query: {} }
    const res = mockRes()
    await revenueByServiceType(req, res)

    expect(jsonBody(res).data.breakdown).toEqual([
      { service_type: 'eas', label: 'Emergency Ambulance Services (EAS)', total_revenue: '125.00' },
      { service_type: 'mts', label: 'Medical Transport Service (MTS)', total_revenue: '50.00' },
    ])
  })

  test('groups an invoice with no linked booking under "unknown"', async () => {
    Invoice.findAll.mockResolvedValue([{ total_amount: '10.00', Booking: null }])

    const res = mockRes()
    await revenueByServiceType({ query: {} }, res)

    expect(jsonBody(res).data.breakdown).toEqual([{ service_type: 'unknown', label: 'unknown', total_revenue: '10.00' }])
  })
})
