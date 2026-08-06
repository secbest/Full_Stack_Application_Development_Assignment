// Owner: Jasper. updateBookingCrew (backend/src/controllers/bookingController.js,
// owned by Zheng Bao) had two problems: it wrote no notification when assigning crew,
// and it moved a booking straight to 'in_progress' as a side effect of assignment - a
// second, stale trigger for the same transition jobMilestoneController's 'activated'
// tap already owns (see that file's own comment: "previously this only happened as a
// side effect of crew assignment", written when the milestone trigger was added but the
// assignment side effect was never removed). This covers both fixes: the job_assigned
// notification only fires on a real change, and status is left alone entirely here.
jest.mock('../../src/models', () => ({
  Booking: { findByPk: jest.fn() },
  User: { findOne: jest.fn() },
}))
jest.mock('../../src/validators', () => ({
  bookingCrewSchema: { validate: jest.fn((body) => Promise.resolve(body)) },
}))
jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))

const { Booking, User } = require('../../src/models')
const notificationService = require('../../src/services/notificationService')
const { updateBookingCrew } = require('../../src/controllers/bookingController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}
function mockBooking(overrides = {}) {
  const booking = {
    id: 1,
    reference_number: 'BKG-2026-00001',
    status: 'confirmed',
    assigned_crew_id: null,
    assignedCrew: null,
    ...overrides,
  }
  booking.update = jest.fn(async (fields) => { Object.assign(booking, fields); return booking })
  booking.reload = jest.fn(async () => booking)
  return booking
}
function mockReq(bookingId, assigned_crew_id) {
  return { params: { id: bookingId }, body: { assigned_crew_id } }
}

beforeEach(() => jest.clearAllMocks())

describe('updateBookingCrew - notification', () => {
  test('assigning a new crew member notifies them and leaves status untouched', async () => {
    const booking = mockBooking({ status: 'confirmed', assigned_crew_id: null })
    Booking.findByPk.mockResolvedValue(booking)
    User.findOne.mockResolvedValue({ id: 42, role: 'field_crew' })
    booking.reload = jest.fn(async () => { booking.assignedCrew = { id: 42, name: 'Ravi Kumar' }; return booking })

    const res = mockRes()
    await updateBookingCrew(mockReq(1, 42), res)

    expect(booking.update).toHaveBeenCalledWith({ assigned_crew_id: 42 })
    expect(booking.status).toBe('confirmed')
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42, type: 'job_assigned', link: '/jobs',
    }))
    expect(payload(res).data.status).toBe('confirmed')
  })

  test('re-saving the same crew member does not notify again', async () => {
    const booking = mockBooking({ status: 'in_progress', assigned_crew_id: 42 })
    Booking.findByPk.mockResolvedValue(booking)
    User.findOne.mockResolvedValue({ id: 42, role: 'field_crew' })

    const res = mockRes()
    await updateBookingCrew(mockReq(1, 42), res)

    expect(notificationService.create).not.toHaveBeenCalled()
  })

  test('unassigning does not notify', async () => {
    const booking = mockBooking({ status: 'in_progress', assigned_crew_id: 42 })
    Booking.findByPk.mockResolvedValue(booking)

    const res = mockRes()
    await updateBookingCrew(mockReq(1, null), res)

    expect(booking.update).toHaveBeenCalledWith({ assigned_crew_id: null })
    expect(notificationService.create).not.toHaveBeenCalled()
  })
})
