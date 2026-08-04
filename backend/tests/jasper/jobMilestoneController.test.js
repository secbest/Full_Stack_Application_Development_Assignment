// Owner: Jasper - Field Ops (client feedback item 1, interim review 17 Jul 2026).
// Unit tests for POST /api/bookings/:id/milestone - the live tap-to-timestamp endpoint.
// EFAR asked for each of the five job stages to be captured the moment it happens
// ("as when they reach the point, they probably just click a button") instead of the
// crew typing times at the end of the day, because pricing depends on those times.
jest.mock('../../src/models', () => ({
  Booking: { findByPk: jest.fn() },
  JobMilestone: { findAll: jest.fn(), create: jest.fn() },
}))

jest.mock('../../src/config', () => ({
  transaction: jest.fn((cb) => cb({})),
}))

const { Booking, JobMilestone } = require('../../src/models')
const { recordMilestone, MILESTONE_SEQUENCE } = require('../../src/controllers/jobMilestoneController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}
function mockReq({ bookingId = 1, milestone = 'activated', role = 'field_crew', sub = 42 } = {}) {
  return { params: { id: bookingId }, body: { milestone_type: milestone }, user: { sub, role } }
}
function mockBooking(overrides = {}) {
  return {
    id: 1,
    assigned_crew_id: 42,
    status: 'in_progress',
    update: jest.fn().mockResolvedValue(),
    ...overrides,
  }
}
function milestoneRow(milestone_type, recorded_at = new Date('2026-08-04T01:00:00Z')) {
  return { milestone_type, recorded_at }
}

beforeEach(() => jest.clearAllMocks())

describe('recordMilestone - sequence and ownership rules', () => {
  test('records the next milestone in sequence and returns all recorded milestones in order', async () => {
    const booking = mockBooking()
    Booking.findByPk.mockResolvedValue(booking)
    // 'activated' already recorded; crew taps 'arrived_at_location'.
    JobMilestone.findAll
      .mockResolvedValueOnce([milestoneRow('activated')])
      .mockResolvedValueOnce([
        // deliberately out of insertion order - the controller must sort by sequence
        milestoneRow('arrived_at_location', new Date('2026-08-04T01:20:00Z')),
        milestoneRow('activated'),
      ])
    JobMilestone.create.mockResolvedValue(milestoneRow('arrived_at_location'))

    const res = mockRes()
    await recordMilestone(mockReq({ milestone: 'arrived_at_location' }), res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(JobMilestone.create).toHaveBeenCalledWith(
      expect.objectContaining({ booking_id: 1, milestone_type: 'arrived_at_location', recorded_by: 42 }),
      expect.anything()
    )
    // recorded_at is server-set, never taken from the request body
    expect(JobMilestone.create.mock.calls[0][0].recorded_at).toBeInstanceOf(Date)
    expect(payload(res).data.milestones.map((m) => m.milestone_type)).toEqual(['activated', 'arrived_at_location'])
  })

  test('recording "activated" on a confirmed booking flips it to in_progress', async () => {
    const booking = mockBooking({ status: 'confirmed' })
    Booking.findByPk.mockResolvedValue(booking)
    JobMilestone.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([milestoneRow('activated')])
    JobMilestone.create.mockResolvedValue(milestoneRow('activated'))

    const res = mockRes()
    await recordMilestone(mockReq({ milestone: 'activated' }), res)

    expect(booking.update).toHaveBeenCalledWith({ status: 'in_progress' }, expect.anything())
    expect(res.status).toHaveBeenCalledWith(201)
  })

  test('a non-activated milestone never touches booking status', async () => {
    const booking = mockBooking({ status: 'in_progress' })
    Booking.findByPk.mockResolvedValue(booking)
    JobMilestone.findAll
      .mockResolvedValueOnce([milestoneRow('activated'), milestoneRow('arrived_at_location')])
      .mockResolvedValueOnce([milestoneRow('activated'), milestoneRow('arrived_at_location'), milestoneRow('en_route')])
    JobMilestone.create.mockResolvedValue(milestoneRow('en_route'))

    const res = mockRes()
    await recordMilestone(mockReq({ milestone: 'en_route' }), res)

    expect(booking.update).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
  })

  test('duplicate milestone -> 409 MILESTONE_ALREADY_RECORDED', async () => {
    Booking.findByPk.mockResolvedValue(mockBooking())
    JobMilestone.findAll.mockResolvedValueOnce([milestoneRow('activated')])

    const res = mockRes()
    await recordMilestone(mockReq({ milestone: 'activated' }), res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('MILESTONE_ALREADY_RECORDED')
    expect(JobMilestone.create).not.toHaveBeenCalled()
  })

  test('skipping ahead -> 409 MILESTONE_OUT_OF_ORDER naming the first missing milestone', async () => {
    Booking.findByPk.mockResolvedValue(mockBooking())
    JobMilestone.findAll.mockResolvedValueOnce([milestoneRow('activated')])

    const res = mockRes()
    await recordMilestone(mockReq({ milestone: 'arrived_at_destination' }), res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('MILESTONE_OUT_OF_ORDER')
    expect(payload(res).message).toContain('arrived_at_location')
    expect(JobMilestone.create).not.toHaveBeenCalled()
  })

  test('completed booking -> 409 BOOKING_ALREADY_COMPLETED', async () => {
    Booking.findByPk.mockResolvedValue(mockBooking({ status: 'completed' }))

    const res = mockRes()
    await recordMilestone(mockReq(), res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('BOOKING_ALREADY_COMPLETED')
    expect(JobMilestone.findAll).not.toHaveBeenCalled()
  })

  test("field crew on someone else's booking -> blurred 404 BOOKING_NOT_FOUND", async () => {
    Booking.findByPk.mockResolvedValue(mockBooking({ assigned_crew_id: 999 }))

    const res = mockRes()
    await recordMilestone(mockReq({ role: 'field_crew', sub: 42 }), res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(payload(res).code).toBe('BOOKING_NOT_FOUND')
  })

  test('exports the canonical five-step sequence for reuse', () => {
    expect(MILESTONE_SEQUENCE).toEqual([
      'activated', 'arrived_at_location', 'en_route', 'arrived_at_destination', 'job_completed',
    ])
  })
})
