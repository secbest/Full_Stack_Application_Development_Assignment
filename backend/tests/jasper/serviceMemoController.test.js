// Owner: Jasper - Field Ops (Wave 2A), hotfix follow-up.
// Regression tests for the "Invalid Date" bug in Memo History / the AR review queue:
// the ServiceMemo model has `underscored: true` but never declares an explicit created_at
// field, so Sequelize exposes the timestamp as the camelCase `memo.createdAt` JS property
// (only the DB *column* is snake_case). The controller previously read `memo.created_at`,
// which is always undefined on a real Sequelize instance - JSON.stringify then silently
// drops that key entirely, so the frontend received no created_at at all and rendered
// `new Date(undefined)` -> "Invalid Date". Fixed by reading `memo.createdAt`/`memo.updatedAt`.
jest.mock('../../src/models', () => ({
  ServiceMemo: { findAndCountAll: jest.fn(), findByPk: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  MemoSignature: { create: jest.fn() },
  Booking: { findByPk: jest.fn() },
  User: { findOne: jest.fn() },
}))

jest.mock('../../src/config', () => ({
  transaction: jest.fn((cb) => cb({})),
}))

jest.mock('../../src/services/cloudinaryService', () => ({ uploadBuffer: jest.fn() }))
jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))

const { ServiceMemo, MemoSignature, Booking, User } = require('../../src/models')
const { listServiceMemos, getServiceMemoById, createServiceMemo } = require('../../src/controllers/serviceMemoController')

const KNOWN_DATE = new Date('2026-07-05T02:30:00.000Z')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => jest.clearAllMocks())

describe('listServiceMemos - created_at serialization (Memo History)', () => {
  test('surfaces the real timestamp via memo.createdAt, not undefined', async () => {
    ServiceMemo.findAndCountAll.mockResolvedValue({
      rows: [{
        id: 5, booking_id: 10, patient_name: 'Test Patient', hospital_destination: 'TTSH',
        service_type: 'eas', status: 'submitted', hospital_stamp_image_url: null,
        submittedBy: { id: 99, name: 'Ravi Kumar' },
        createdAt: KNOWN_DATE, // real Sequelize property - deliberately no created_at set
      }],
      count: 1,
    })

    const res = mockRes()
    await listServiceMemos({ query: { page: 1, limit: 20 }, user: { sub: 99, role: 'field_crew' } }, res)

    expect(payload(res).data.data[0].created_at).toEqual(KNOWN_DATE)
    expect(payload(res).data.data[0].created_at).not.toBeUndefined()
  })
})

describe('getServiceMemoById - created_at/updated_at serialization', () => {
  test('surfaces memo.createdAt and memo.updatedAt, not the undefined snake_case form', async () => {
    ServiceMemo.findByPk.mockResolvedValue({
      id: 5, booking_id: 10, submitted_by: 99, submittedBy: { id: 99, name: 'Ravi Kumar' }, reviewedBy: null,
      status: 'submitted', patient_name: 'Test Patient', hospital_destination: 'TTSH',
      service_type: 'eas', transfer_type: 'one_way_hospital', is_office_hours: true,
      oxygen_litres_used: 0, has_inconvenience_fee: false, disposables_used: false,
      resuscitation_performed: false, suction_performed: false, waiting_time_minutes: 0,
      patient_weight_kg: null, is_jurong_island: false, additional_charges_notes: null,
      hospital_stamp_image_url: null, job_start_time: '2026-07-05T00:00:00Z', job_end_time: '2026-07-05T01:00:00Z',
      overtime_hours: 0, evacuation_floors: 0,
      MemoSignatures: [],
      createdAt: KNOWN_DATE,
      updatedAt: KNOWN_DATE,
    })

    const res = mockRes()
    await getServiceMemoById({ params: { id: 5 }, user: { sub: 99, role: 'ar_specialist' } }, res)

    expect(payload(res).data.created_at).toEqual(KNOWN_DATE)
    expect(payload(res).data.updated_at).toEqual(KNOWN_DATE)
  })
})

describe('createServiceMemo - created_at on the just-created memo (UC-05 success response)', () => {
  test('the submission-success response carries a real created_at, not undefined', async () => {
    const booking = { id: 10, status: 'in_progress', assigned_crew_id: 99, update: jest.fn().mockResolvedValue() }
    Booking.findByPk.mockResolvedValue(booking)
    ServiceMemo.findOne.mockResolvedValue(null) // no existing memo for this booking
    ServiceMemo.create.mockResolvedValue({
      id: 5, booking_id: 10, submitted_by: 99, status: 'submitted', patient_name: 'Test Patient',
      hospital_destination: 'TTSH', service_type: 'eas', transfer_type: 'one_way_hospital',
      is_office_hours: true, oxygen_litres_used: 0, has_inconvenience_fee: false, disposables_used: false,
      resuscitation_performed: false, suction_performed: false, waiting_time_minutes: 0,
      patient_weight_kg: null, is_jurong_island: false, additional_charges_notes: null,
      hospital_stamp_image_url: null, job_start_time: '2026-07-05T00:00:00Z', job_end_time: '2026-07-05T01:00:00Z',
      overtime_hours: 0, evacuation_floors: 0,
      createdAt: KNOWN_DATE,
    })
    MemoSignature.create.mockResolvedValue({
      id: 1, signer_name: 'Jane Tan', signature_image_url: 'https://example.com/sig.png',
      signed_at: KNOWN_DATE, is_waived: false, waiver_reason: null,
    })
    User.findOne.mockResolvedValue(null) // no AR specialist found - notification skipped, not fatal

    const req = {
      user: { sub: 99, role: 'field_crew' },
      body: {
        booking_id: 10, job_start_time: '2026-07-05T00:00:00Z', job_end_time: '2026-07-05T01:00:00Z',
        overtime_hours: 0, evacuation_floors: 0, patient_name: 'Test Patient', hospital_destination: 'TTSH',
        additional_charges_notes: null, hospital_stamp_image_url: null,
        service_type: 'eas', transfer_type: 'one_way_hospital', is_office_hours: true,
        oxygen_litres_used: 0, has_inconvenience_fee: false, disposables_used: false,
        resuscitation_performed: false, suction_performed: false, waiting_time_minutes: 0,
        patient_weight_kg: null, is_jurong_island: false,
        signature: { signer_name: 'Jane Tan', signature_image_url: 'https://example.com/sig.png', signed_at: KNOWN_DATE, is_waived: false, waiver_reason: null },
      },
    }
    const res = mockRes()
    await createServiceMemo(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(payload(res).data.created_at).toEqual(KNOWN_DATE)
    expect(payload(res).data.created_at).not.toBeUndefined()
  })
})
