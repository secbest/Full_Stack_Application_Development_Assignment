// Owner: Jasper - Field Ops (client feedback item 1, interim review 17 Jul 2026).
// The My Jobs hero card renders the milestone stepper and the memo wizard pre-fills
// job start/end from recorded milestones, so both GET /api/bookings/my-jobs and
// GET /api/bookings/:id must carry a `milestones` array sorted in sequence order
// (activated -> ... -> job_completed), regardless of DB row order.
jest.mock('../../src/models', () => ({
  Booking: { findAll: jest.fn(), findByPk: jest.fn(), findAndCountAll: jest.fn() },
  Client: {},
  User: {},
  IntakeSubmission: {},
  ServiceMemo: {},
  Invoice: {},
  JobMilestone: {},
}))

const { Booking } = require('../../src/models')
const { listMyJobs, getBookingById } = require('../../src/controllers/bookingController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}

const T_ACTIVATED = new Date('2026-08-04T00:45:00Z')
const T_ARRIVED = new Date('2026-08-04T01:05:00Z')

// JobMilestones deliberately out of sequence order - serialization must sort.
function bookingRow(overrides = {}) {
  return {
    id: 1,
    reference_number: 'BKG-TEST-00001',
    Client: { id: 3, name: 'Raffles Medical Group' },
    service_type: 'eas',
    service_tier: 'advanced',
    scheduled_date: '2026-08-04',
    scheduled_time: '09:00',
    pickup_location: 'A',
    destination: 'B',
    status: 'in_progress',
    assigned_crew_id: 42,
    JobMilestones: [
      { milestone_type: 'arrived_at_location', recorded_at: T_ARRIVED },
      { milestone_type: 'activated', recorded_at: T_ACTIVATED },
    ],
    ...overrides,
  }
}

beforeEach(() => jest.clearAllMocks())

describe('listMyJobs - milestones included', () => {
  test('each job carries milestones sorted by sequence order', async () => {
    Booking.findAll.mockResolvedValue([bookingRow()])

    const res = mockRes()
    await listMyJobs({ query: {}, user: { sub: 42, role: 'field_crew' } }, res)

    const job = payload(res).data[0]
    expect(job.milestones).toEqual([
      { milestone_type: 'activated', recorded_at: T_ACTIVATED },
      { milestone_type: 'arrived_at_location', recorded_at: T_ARRIVED },
    ])
  })

  test('a job with no milestone rows serializes an empty array, not undefined', async () => {
    Booking.findAll.mockResolvedValue([bookingRow({ JobMilestones: [] })])

    const res = mockRes()
    await listMyJobs({ query: {}, user: { sub: 42, role: 'field_crew' } }, res)

    expect(payload(res).data[0].milestones).toEqual([])
  })
})

describe('getBookingById - milestones included', () => {
  test('booking detail carries sequence-sorted milestones for the memo wizard pre-fill', async () => {
    Booking.findByPk.mockResolvedValue(bookingRow())

    const res = mockRes()
    await getBookingById({ params: { id: 1 }, user: { sub: 42, role: 'field_crew' } }, res)

    expect(payload(res).data.milestones.map((m) => m.milestone_type)).toEqual([
      'activated', 'arrived_at_location',
    ])
  })
})
