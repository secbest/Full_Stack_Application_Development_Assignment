jest.mock('../../src/models', () => ({
  User: { findAll: jest.fn() },
  Booking: { findAll: jest.fn() },
  JobMilestone: { findAll: jest.fn() },
  ServiceMemo: {},
  Invoice: {},
  VendorInvoice: {},
  PricingContract: {},
  SurchargeSchedule: {},
  Client: {},
  XeroSyncLog: {},
}))
jest.mock('../../src/services/geocodingService', () => ({
  geocodeAddress: jest.fn(),
  HQ_ADDRESS: 'EFAR HQ address',
}))

const { User, Booking, JobMilestone } = require('../../src/models')
const geocodingService = require('../../src/services/geocodingService')
const { crewPositions } = require('../../src/controllers/dashboardController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => {
  jest.clearAllMocks()
  geocodingService.geocodeAddress.mockImplementation((address) => {
    const known = {
      'EFAR HQ address': { lat: 1.284, lng: 103.851 },
      'Pickup St':       { lat: 1.30, lng: 103.80 },
      'Destination Rd':  { lat: 1.40, lng: 103.90 },
    }
    return Promise.resolve(known[address] || { lat: 0, lng: 0 })
  })
})

describe('crewPositions', () => {
  test('a crew member with no active booking and recent activity is "available" near HQ', async () => {
    User.findAll.mockResolvedValue([{ id: 1, name: 'Ravi Kumar', last_active_at: new Date() }])
    Booking.findAll.mockResolvedValue([])
    JobMilestone.findAll.mockResolvedValue([])

    const res = mockRes()
    await crewPositions({ query: {} }, res)

    const entry = jsonBody(res).data[0]
    expect(entry).toMatchObject({ id: 1, name: 'Ravi Kumar', status: 'available', current_job_reference: null })
    // Not exactly at HQ - see hqOffset() in dashboardController.js, which spreads
    // multiple idle crew around HQ (~150m) so they don't render as one stacked pin.
    expect(Math.abs(entry.position.lat - 1.284)).toBeLessThanOrEqual(0.0015)
    expect(Math.abs(entry.position.lng - 103.851)).toBeLessThanOrEqual(0.0015)
  })

  test('a crew member with no active booking and stale activity is "off_duty"', async () => {
    const staleTime = new Date(Date.now() - 10 * 60 * 1000) // 10 min ago, past the 5-min window
    User.findAll.mockResolvedValue([{ id: 2, name: 'Ahmad Salleh', last_active_at: staleTime }])
    Booking.findAll.mockResolvedValue([])
    JobMilestone.findAll.mockResolvedValue([])

    const res = mockRes()
    await crewPositions({ query: {} }, res)

    expect(jsonBody(res).data[0].status).toBe('off_duty')
  })

  test('only "activated" recorded -> en_route, positioned at pickup', async () => {
    User.findAll.mockResolvedValue([{ id: 3, name: 'Wei Jian', last_active_at: new Date() }])
    Booking.findAll.mockResolvedValue([{
      id: 100, assigned_crew_id: 3, reference_number: 'BKG-1', pickup_location: 'Pickup St', destination: 'Destination Rd',
    }])
    JobMilestone.findAll.mockResolvedValue([{ booking_id: 100, milestone_type: 'activated' }])

    const res = mockRes()
    await crewPositions({ query: {} }, res)

    expect(jsonBody(res).data[0]).toMatchObject({
      status: 'en_route',
      position: { lat: 1.30, lng: 103.80 },
      current_job_reference: 'BKG-1',
    })
  })

  test('"arrived_at_location" recorded -> on_scene at pickup', async () => {
    User.findAll.mockResolvedValue([{ id: 4, name: 'Farah Ismail', last_active_at: new Date() }])
    Booking.findAll.mockResolvedValue([{
      id: 101, assigned_crew_id: 4, reference_number: 'BKG-2', pickup_location: 'Pickup St', destination: 'Destination Rd',
    }])
    JobMilestone.findAll.mockResolvedValue([
      { booking_id: 101, milestone_type: 'activated' },
      { booking_id: 101, milestone_type: 'arrived_at_location' },
    ])

    const res = mockRes()
    await crewPositions({ query: {} }, res)

    expect(jsonBody(res).data[0]).toMatchObject({ status: 'on_scene', position: { lat: 1.30, lng: 103.80 } })
  })

  test('"en_route" recorded -> en_route, positioned near the midpoint between pickup and destination', async () => {
    User.findAll.mockResolvedValue([{ id: 5, name: 'Kumar Selvam', last_active_at: new Date() }])
    Booking.findAll.mockResolvedValue([{
      id: 102, assigned_crew_id: 5, reference_number: 'BKG-3', pickup_location: 'Pickup St', destination: 'Destination Rd',
    }])
    JobMilestone.findAll.mockResolvedValue([
      { booking_id: 102, milestone_type: 'activated' },
      { booking_id: 102, milestone_type: 'arrived_at_location' },
      { booking_id: 102, milestone_type: 'en_route' },
    ])

    const res = mockRes()
    await crewPositions({ query: {} }, res)

    const { status, position } = jsonBody(res).data[0]
    expect(status).toBe('en_route')
    // Midpoint of (1.30,103.80) and (1.40,103.90) is (1.35,103.85), plus up to ~0.002 jitter.
    expect(position.lat).toBeGreaterThan(1.346)
    expect(position.lat).toBeLessThan(1.354)
    expect(position.lng).toBeGreaterThan(103.846)
    expect(position.lng).toBeLessThan(103.854)
  })

  test('"job_completed" recorded -> on_scene at destination', async () => {
    User.findAll.mockResolvedValue([{ id: 6, name: 'Nurul Aisyah', last_active_at: new Date() }])
    Booking.findAll.mockResolvedValue([{
      id: 103, assigned_crew_id: 6, reference_number: 'BKG-4', pickup_location: 'Pickup St', destination: 'Destination Rd',
    }])
    JobMilestone.findAll.mockResolvedValue([
      { booking_id: 103, milestone_type: 'activated' },
      { booking_id: 103, milestone_type: 'arrived_at_location' },
      { booking_id: 103, milestone_type: 'en_route' },
      { booking_id: 103, milestone_type: 'arrived_at_destination' },
      { booking_id: 103, milestone_type: 'job_completed' },
    ])

    const res = mockRes()
    await crewPositions({ query: {} }, res)

    expect(jsonBody(res).data[0]).toMatchObject({ status: 'on_scene', position: { lat: 1.40, lng: 103.90 } })
  })

  test('returns one entry per crew member, in the order returned by User.findAll', async () => {
    User.findAll.mockResolvedValue([
      { id: 1, name: 'Ravi Kumar', last_active_at: new Date() },
      { id: 2, name: 'Ahmad Salleh', last_active_at: null },
    ])
    Booking.findAll.mockResolvedValue([])
    JobMilestone.findAll.mockResolvedValue([])

    const res = mockRes()
    await crewPositions({ query: {} }, res)

    expect(jsonBody(res).data).toHaveLength(2)
    expect(jsonBody(res).data.map((c) => c.id)).toEqual([1, 2])
  })

  test('idle crew members are spread around HQ rather than stacked on the exact same point', async () => {
    User.findAll.mockResolvedValue([
      { id: 1, name: 'Ravi Kumar', last_active_at: new Date() },
      { id: 2, name: 'Ahmad Salleh', last_active_at: null },
    ])
    Booking.findAll.mockResolvedValue([])
    JobMilestone.findAll.mockResolvedValue([])

    const res = mockRes()
    await crewPositions({ query: {} }, res)

    const [first, second] = jsonBody(res).data
    expect(first.position).not.toEqual(second.position)
  })
})
