// Owner: Jasper - Field Ops (client feedback item 4, interim review 17 Jul 2026).
// "we don't just operate ambulance on its own, sometimes we also have events whereby
// there is no ambulance at all, we just have to dispatch crew, like manpower."
// The service_type enum already carried event_standby/workplace_standby, but
// patient_name and hospital_destination were unconditionally required, so a
// manpower-only memo could never submit. They are now conditionally required on
// service_type: required for eas/mts, optional (null) for the standby types.
// The pricing-engine half of this item stays with Kwan Hua and is not tested here.
const { createServiceMemoSchema } = require('../../src/validators/serviceMemoValidators')

const NOW = new Date('2026-08-04T02:00:00Z')
const TWO_HOURS_LATER = new Date('2026-08-04T04:00:00Z')

function memoPayload(overrides = {}) {
  return {
    booking_id: 1,
    job_start_time: NOW.toISOString(),
    job_end_time: TWO_HOURS_LATER.toISOString(),
    overtime_hours: 0,
    evacuation_floors: 0,
    patient_name: 'Tan Ah Kow',
    hospital_destination: 'Tan Tock Seng Hospital',
    service_type: 'eas',
    transfer_type: 'one_way_hospital',
    is_office_hours: true,
    signature: {
      signer_name: 'Tan Ah Kow',
      signature_image_url: 'https://res.cloudinary.com/demo/sig.png',
      signed_at: TWO_HOURS_LATER.toISOString(),
      is_waived: false,
      waiver_reason: null,
    },
    ...overrides,
  }
}

describe('createServiceMemoSchema - manpower-only standby jobs', () => {
  test('event_standby memo with no patient and no hospital destination validates, coercing both to null', async () => {
    const result = await createServiceMemoSchema.validate(
      memoPayload({ service_type: 'event_standby', patient_name: '', hospital_destination: '' }),
      { abortEarly: false, stripUnknown: true }
    )
    expect(result.patient_name).toBeNull()
    expect(result.hospital_destination).toBeNull()
  })

  test('workplace_standby memo with the fields omitted entirely also validates', async () => {
    const payload = memoPayload({ service_type: 'workplace_standby' })
    delete payload.patient_name
    delete payload.hospital_destination

    const result = await createServiceMemoSchema.validate(payload, { abortEarly: false, stripUnknown: true })
    expect(result.patient_name).toBeNull()
    expect(result.hospital_destination).toBeNull()
  })

  test('an event_standby WITH a patient keeps the details (event casualty transported)', async () => {
    const result = await createServiceMemoSchema.validate(
      memoPayload({ service_type: 'event_standby', patient_name: 'Injured Runner', hospital_destination: 'SGH' }),
      { abortEarly: false, stripUnknown: true }
    )
    expect(result.patient_name).toBe('Injured Runner')
    expect(result.hospital_destination).toBe('SGH')
  })

  test('eas memo still requires patient_name', async () => {
    await expect(
      createServiceMemoSchema.validate(
        memoPayload({ service_type: 'eas', patient_name: '' }),
        { abortEarly: false, stripUnknown: true }
      )
    ).rejects.toMatchObject({ errors: expect.arrayContaining(['patient_name is required']) })
  })

  test('mts memo still requires hospital_destination', async () => {
    await expect(
      createServiceMemoSchema.validate(
        memoPayload({ service_type: 'mts', transfer_type: 'two_way_hospital', hospital_destination: '' }),
        { abortEarly: false, stripUnknown: true }
      )
    ).rejects.toMatchObject({ errors: expect.arrayContaining(['hospital_destination is required']) })
  })
})
