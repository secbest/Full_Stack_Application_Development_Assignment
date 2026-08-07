// Owner: Zheng Bao - Quotations Specialist intake workflow
// (backend/src/controllers/intakeController.js).
//
// Notification fan-out and tier-ownership are already covered in
// backend/tests/jasper/{intakeNotificationFanout,intakeTierValidation}.test.js.
// This file covers the rest of the controller: duplicate-submission detection,
// reference-number derivation (see the comment above nextReferenceNumber - a
// seeded gap between id and reference_number must not collide), list filtering,
// and the confirm/reject lifecycle.
jest.mock('../../src/models', () => ({
  IntakeSubmission: { findOne: jest.fn(), findAndCountAll: jest.fn(), findByPk: jest.fn(), create: jest.fn() },
  Booking: { findOne: jest.fn(), create: jest.fn() },
  Client: { findOrCreate: jest.fn() },
  User: { findAll: jest.fn() },
  PricingContract: { findOne: jest.fn() },
  PricingRate: { findAll: jest.fn() },
}))
jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))

const { IntakeSubmission, Booking, Client, User, PricingContract, PricingRate } = require('../../src/models')
const {
  createIntake,
  listIntakes,
  getIntakeById,
  confirmIntake,
  rejectIntake,
  deleteIntake,
} = require('../../src/controllers/intakeController')

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
    preferred_date: '2026-09-01',
    preferred_time: '10:00',
    pickup_location: 'Changi General Hospital',
    destination: 'Singapore General Hospital',
    ...overrides,
  }
}
function confirmBody(overrides = {}) {
  return {
    service_tier: 'advanced',
    pricing_source: 'one_off_quote',
    quoted_transfer_type: 'one_way_hospital',
    quoted_time_of_day: 'office_hours',
    quoted_base_amount: 650,
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  User.findAll.mockResolvedValue([])
  Booking.findOne.mockResolvedValue(null) // nextReferenceNumber(Booking, 'BKG-2026') - starts at 1 unless a test overrides it
})

describe('createIntake - duplicate detection', () => {
  test('409s a second submission with the same email/date/pickup within the 10-minute window', async () => {
    IntakeSubmission.findOne.mockResolvedValueOnce({ id: 9 }) // dedupe check finds a recent match

    const res = mockRes()
    await createIntake({ body: validBody() }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res)).toMatchObject({ success: false, code: 'DUPLICATE_SUBMISSION' })
    expect(IntakeSubmission.create).not.toHaveBeenCalled()
  })

  test('allows the submission through when no recent duplicate exists', async () => {
    IntakeSubmission.findOne
      .mockResolvedValueOnce(null) // dedupe check
      .mockResolvedValueOnce(null) // nextReferenceNumber lookup
    IntakeSubmission.create.mockResolvedValue({
      id: 1, reference_number: 'EFAR-2026-00001', status: 'pending', customer_name: 'John Tan', createdAt: new Date('2026-08-05T00:00:00Z'),
    })

    const res = mockRes()
    await createIntake({ body: validBody() }, res)

    expect(res.status).toHaveBeenCalledWith(201)
  })
})

describe('createIntake - reference number derivation', () => {
  // Regression guard for the gap documented above nextReferenceNumber: a seeded row can hold
  // a reference_number ahead of what its id would suggest. Deriving from id instead of the
  // numeric suffix of the last reference_number would reuse an already-taken number and 500
  // on the unique constraint.
  test('derives the next number from the highest reference_number suffix, not the row id', async () => {
    IntakeSubmission.findOne
      .mockResolvedValueOnce(null) // dedupe check
      .mockResolvedValueOnce({ reference_number: 'EFAR-2026-00010' }) // id 7 holding a higher suffix
    IntakeSubmission.create.mockResolvedValue({
      id: 8, reference_number: 'EFAR-2026-00011', status: 'pending', customer_name: 'John Tan', createdAt: new Date('2026-08-05T00:00:00Z'),
    })

    const res = mockRes()
    await createIntake({ body: validBody() }, res)

    expect(IntakeSubmission.create).toHaveBeenCalledWith(expect.objectContaining({ reference_number: 'EFAR-2026-00011' }))
  })

  test('starts at 00001 when no prior submission uses the EFAR-2026 prefix', async () => {
    IntakeSubmission.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null)
    IntakeSubmission.create.mockResolvedValue({
      id: 1, reference_number: 'EFAR-2026-00001', status: 'pending', customer_name: 'John Tan', createdAt: new Date('2026-08-05T00:00:00Z'),
    })

    const res = mockRes()
    await createIntake({ body: validBody() }, res)

    expect(IntakeSubmission.create).toHaveBeenCalledWith(expect.objectContaining({ reference_number: 'EFAR-2026-00001' }))
  })
})

describe('createIntake - validation', () => {
  test('400s with VALIDATION_ERROR when a required field is missing, and does not touch the DB', async () => {
    const res = mockRes()
    await createIntake({ body: validBody({ contact_phone: undefined }) }, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res)).toMatchObject({ success: false, code: 'VALIDATION_ERROR' })
    expect(IntakeSubmission.create).not.toHaveBeenCalled()
  })

  test('rejects a contact phone that is not exactly 8 digits', async () => {
    const res = mockRes()
    await createIntake({ body: validBody({ contact_phone: '123' }) }, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(IntakeSubmission.create).not.toHaveBeenCalled()
  })
})

describe('listIntakes (Intake Queue)', () => {
  test('applies status/service_type/search filters and returns pagination meta', async () => {
    IntakeSubmission.findAndCountAll.mockResolvedValue({ rows: [], count: 0 })

    const res = mockRes()
    await listIntakes({ query: { status: 'pending', service_type: 'eas', search: 'Tan', page: '2', limit: '10' } }, res)

    const callArgs = IntakeSubmission.findAndCountAll.mock.calls[0][0]
    expect(callArgs.where.status).toBe('pending')
    expect(callArgs.where.service_type).toBe('eas')
    expect(callArgs.limit).toBe(10)
    expect(callArgs.offset).toBe(10) // (page 2 - 1) * limit 10
    expect(payload(res).data.meta).toEqual({ total: 0, page: 2, limit: 10 })
  })

  test('defaults to pending/page 1 when no query params are given', async () => {
    IntakeSubmission.findAndCountAll.mockResolvedValue({ rows: [], count: 0 })

    const res = mockRes()
    await listIntakes({ query: {} }, res)

    const callArgs = IntakeSubmission.findAndCountAll.mock.calls[0][0]
    expect(callArgs.where.status).toBe('pending')
    expect(callArgs.offset).toBe(0)
  })
})

describe('getIntakeById', () => {
  test('404s when the intake does not exist', async () => {
    IntakeSubmission.findByPk.mockResolvedValue(null)

    const res = mockRes()
    await getIntakeById({ params: { id: 999 } }, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe('confirmIntake (Intake Detail -> Booking Created)', () => {
  function pendingIntake(overrides = {}) {
    return {
      id: 41,
      status: 'pending',
      organisation: null,
      customer_name: 'John Tan',
      contact_email: 'john.tan@cgh.com.sg',
      contact_phone: '91234567',
      service_type: 'eas',
      service_tier: null,
      preferred_date: '2026-09-01',
      preferred_time: '10:00',
      pickup_location: 'Changi General Hospital',
      destination: 'Singapore General Hospital',
      update: jest.fn().mockResolvedValue(true),
      ...overrides,
    }
  }

  test('409s ALREADY_ACTIONED when the intake is no longer pending', async () => {
    IntakeSubmission.findByPk.mockResolvedValue(pendingIntake({ status: 'confirmed' }))

    const res = mockRes()
    await confirmIntake({ params: { id: 41 }, body: { service_tier: 'advanced' }, user: { sub: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res)).toMatchObject({ code: 'ALREADY_ACTIONED' })
    expect(Booking.create).not.toHaveBeenCalled()
  })

  test('400s VALIDATION_ERROR when service_tier is missing from the confirm body', async () => {
    IntakeSubmission.findByPk.mockResolvedValue(pendingIntake())

    const res = mockRes()
    await confirmIntake({ params: { id: 41 }, body: {}, user: { sub: 3 } }, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(Booking.create).not.toHaveBeenCalled()
  })

  test('reuses an existing Client for the same contact_email instead of creating a duplicate', async () => {
    const intake = pendingIntake()
    IntakeSubmission.findByPk.mockResolvedValue(intake)
    Client.findOrCreate.mockResolvedValue([{ id: 7 }, false])
    Booking.create.mockResolvedValue({ id: 1, reference_number: 'BKG-2026-00001', intake_submission_id: 41, status: 'confirmed' })

    const res = mockRes()
    await confirmIntake({ params: { id: 41 }, body: confirmBody(), user: { sub: 3 } }, res)

    expect(Client.findOrCreate).toHaveBeenCalledWith(expect.objectContaining({ where: { contact_email: 'john.tan@cgh.com.sg' } }))
    expect(Booking.create).toHaveBeenCalledWith(expect.objectContaining({
      client_id: 7,
      pricing_source: 'one_off_quote',
      quoted_base_amount: 650,
      quoted_transfer_type: 'one_way_hospital',
      quoted_time_of_day: 'office_hours',
      quoted_by: 3,
    }))
    expect(intake.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'confirmed', reviewed_by: 3 }))
    expect(res.status).toHaveBeenCalledWith(201)
  })

  test('leaves original_service_tier null when the customer never selected a tier', async () => {
    IntakeSubmission.findByPk.mockResolvedValue(pendingIntake({ service_tier: null }))
    Client.findOrCreate.mockResolvedValue([{ id: 7 }, false])
    Booking.create.mockResolvedValue({ id: 1, reference_number: 'BKG-2026-00001', status: 'confirmed' })

    const res = mockRes()
    await confirmIntake({ params: { id: 41 }, body: confirmBody({ service_tier: 'critical' }), user: { sub: 3 } }, res)

    expect(Booking.create).toHaveBeenCalledWith(expect.objectContaining({ original_service_tier: null, service_tier: 'critical' }))
  })

  // Legacy-data edge case: an older intake row that does carry a service_tier and quotations
  // overrides it on confirm - original_service_tier should preserve what the customer picked.
  test('records original_service_tier when quotations overrides a pre-existing customer tier', async () => {
    IntakeSubmission.findByPk.mockResolvedValue(pendingIntake({ service_tier: 'basic' }))
    Client.findOrCreate.mockResolvedValue([{ id: 7 }, false])
    Booking.create.mockResolvedValue({ id: 1, reference_number: 'BKG-2026-00001', status: 'confirmed' })

    const res = mockRes()
    await confirmIntake({ params: { id: 41 }, body: confirmBody({ service_tier: 'critical' }), user: { sub: 3 } }, res)

    expect(Booking.create).toHaveBeenCalledWith(expect.objectContaining({ original_service_tier: 'basic', service_tier: 'critical' }))
  })

  test('resolves and freezes the applicable client contract rate', async () => {
    IntakeSubmission.findByPk.mockResolvedValue(pendingIntake())
    Client.findOrCreate.mockResolvedValue([{ id: 7 }, false])
    PricingContract.findOne.mockResolvedValue({ id: 22 })
    PricingRate.findAll.mockResolvedValue([{ time_of_day: 'all_hours', base_amount: '875.50' }])
    Booking.create.mockResolvedValue({ id: 1, reference_number: 'BKG-2026-00001', status: 'confirmed' })

    const res = mockRes()
    await confirmIntake({
      params: { id: 41 },
      body: confirmBody({ pricing_source: 'contract', quoted_time_of_day: 'office_hours', quoted_base_amount: undefined }),
      user: { sub: 3 },
    }, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(Booking.create).toHaveBeenCalledWith(expect.objectContaining({
      pricing_source: 'contract', pricing_contract_id: 22, quoted_base_amount: 875.5,
    }))
  })

  test('rejects contract pricing when no active client contract covers the service date', async () => {
    IntakeSubmission.findByPk.mockResolvedValue(pendingIntake())
    Client.findOrCreate.mockResolvedValue([{ id: 7 }, false])
    PricingContract.findOne.mockResolvedValue(null)

    const res = mockRes()
    await confirmIntake({
      params: { id: 41 },
      body: confirmBody({ pricing_source: 'contract', quoted_base_amount: undefined }),
      user: { sub: 3 },
    }, res)

    expect(res.status).toHaveBeenCalledWith(422)
    expect(payload(res)).toMatchObject({ code: 'NO_ACTIVE_CONTRACT' })
    expect(Booking.create).not.toHaveBeenCalled()
  })
})

describe('rejectIntake (Intake Detail -> toast + Intake Queue)', () => {
  test('409s ALREADY_ACTIONED when the intake is no longer pending', async () => {
    IntakeSubmission.findByPk.mockResolvedValue({ id: 41, status: 'rejected' })

    const res = mockRes()
    await rejectIntake({ params: { id: 41 }, body: { rejection_reason: 'Duplicate request' }, user: { sub: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  test('400s VALIDATION_ERROR when rejection_reason is missing', async () => {
    IntakeSubmission.findByPk.mockResolvedValue({ id: 41, status: 'pending', update: jest.fn() })

    const res = mockRes()
    await rejectIntake({ params: { id: 41 }, body: {}, user: { sub: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })

  test('marks the intake rejected with the reviewer and reason on success', async () => {
    const intake = { id: 41, reference_number: 'EFAR-2026-00041', status: 'pending', update: jest.fn().mockResolvedValue(true) }
    IntakeSubmission.findByPk.mockResolvedValue(intake)

    const res = mockRes()
    await rejectIntake({ params: { id: 41 }, body: { rejection_reason: 'Outside service area' }, user: { sub: 5 } }, res)

    expect(intake.update).toHaveBeenCalledWith(expect.objectContaining({
      status: 'rejected', rejection_reason: 'Outside service area', reviewed_by: 5,
    }))
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

describe('deleteIntake', () => {
  test('404s when the intake does not exist', async () => {
    IntakeSubmission.findByPk.mockResolvedValue(null)

    const res = mockRes()
    await deleteIntake({ params: { id: 999 } }, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('409s INTAKE_NOT_REJECTED for a pending submission, and does not delete it', async () => {
    const intake = { id: 41, status: 'pending', destroy: jest.fn() }
    IntakeSubmission.findByPk.mockResolvedValue(intake)

    const res = mockRes()
    await deleteIntake({ params: { id: 41 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res)).toMatchObject({ code: 'INTAKE_NOT_REJECTED' })
    expect(intake.destroy).not.toHaveBeenCalled()
  })

  // A confirmed intake already has a Booking pointing back at it (intake_submission_id) -
  // deleting it would either FK-violate or orphan that booking, so it must be blocked too.
  test('409s INTAKE_NOT_REJECTED for a confirmed submission, and does not delete it', async () => {
    const intake = { id: 41, status: 'confirmed', destroy: jest.fn() }
    IntakeSubmission.findByPk.mockResolvedValue(intake)

    const res = mockRes()
    await deleteIntake({ params: { id: 41 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(intake.destroy).not.toHaveBeenCalled()
  })

  test('deletes a rejected submission and returns its reference number', async () => {
    const intake = { id: 41, reference_number: 'EFAR-2026-00041', status: 'rejected', destroy: jest.fn().mockResolvedValue(true) }
    IntakeSubmission.findByPk.mockResolvedValue(intake)

    const res = mockRes()
    await deleteIntake({ params: { id: 41 } }, res)

    expect(intake.destroy).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(payload(res).data).toEqual({ id: 41, reference_number: 'EFAR-2026-00041' })
  })
})
