// Owner: Jasper. createIntake (backend/src/controllers/intakeController.js, owned by
// Zheng Bao) writes an IntakeSubmission but never notified anyone - the enum already
// declared 'new_intake_submission' but nothing ever created one. This covers the new
// fan-out to every quotations_specialist, and that a lookup failure there can never
// turn an already-successful, unauthenticated public submission into a 500.
jest.mock('../../src/models', () => ({
  IntakeSubmission: { findOne: jest.fn(), create: jest.fn() },
  Booking: {},
  Client: {},
  User: { findAll: jest.fn() },
}))
jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))

const { IntakeSubmission, User } = require('../../src/models')
const notificationService = require('../../src/services/notificationService')
const { createIntake } = require('../../src/controllers/intakeController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}
function validBody(overrides = {}) {
  return {
    customer_name: 'John Tan',
    contact_email: 'john.tan@cgh.com.sg',
    contact_phone: '91234567',
    service_type: 'eas',
    service_tier: 'basic',
    preferred_date: '2026-09-01',
    preferred_time: '10:00',
    pickup_location: 'Changi General Hospital',
    destination: 'Singapore General Hospital',
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  IntakeSubmission.findOne
    .mockResolvedValueOnce(null) // dedupe check: no recent duplicate
    .mockResolvedValueOnce(null) // nextReferenceNumber: no prior rows, starts at 1
  IntakeSubmission.create.mockResolvedValue({
    id: 1,
    reference_number: 'EFAR-2026-00001',
    status: 'pending',
    customer_name: 'John Tan',
    createdAt: new Date('2026-08-05T00:00:00Z'),
  })
})

describe('createIntake - notification fan-out', () => {
  test('notifies every quotations_specialist with the intake queue link', async () => {
    User.findAll.mockResolvedValue([{ id: 5 }, { id: 8 }])

    const res = mockRes()
    await createIntake({ body: validBody() }, res)

    expect(User.findAll).toHaveBeenCalledWith({ where: { role: 'quotations_specialist' } })
    expect(notificationService.create).toHaveBeenCalledTimes(2)
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 5, type: 'new_intake_submission', link: '/intake-queue',
    }))
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 8, type: 'new_intake_submission', link: '/intake-queue',
    }))
    expect(res.status).toHaveBeenCalledWith(201)
  })

  test('still returns 201 when the specialist lookup itself throws', async () => {
    // The intake row is already committed by this point - a public, unauthenticated
    // customer must never see a failure caused by the notification fan-out.
    User.findAll.mockRejectedValue(new Error('connection reset'))

    const res = mockRes()
    await createIntake({ body: validBody() }, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(payload(res).data.reference_number).toBe('EFAR-2026-00001')
  })

  test('does nothing and still succeeds when there are no quotations specialists', async () => {
    User.findAll.mockResolvedValue([])

    const res = mockRes()
    await createIntake({ body: validBody() }, res)

    expect(notificationService.create).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
  })
})
