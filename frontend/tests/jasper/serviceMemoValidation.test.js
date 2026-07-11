// Owner: Jasper - Field Ops (Wave 2A), hotfix follow-up.
// Pure Yup schema tests, no mocking needed - mirror the Memo Wizard's step schemas.
const { step1Schema, step2Schema, step3Schema } = require('@/validation/serviceMemoValidation')

function validStep1(overrides = {}) {
  return {
    job_start_time: '2026-07-11T09:00',
    job_end_time: '2026-07-11T10:00',
    overtime_hours: 0,
    evacuation_floors: 0,
    patient_name: 'Test Patient',
    hospital_destination: 'Tan Tock Seng Hospital',
    additional_charges_notes: '',
    ...overrides,
  }
}

function validStep3(overrides = {}) {
  return {
    signer_name: 'Jane Tan',
    is_waived: false,
    signature_image_url: 'https://res.cloudinary.com/demo/image/upload/signature.png',
    waiver_reason: '',
    ...overrides,
  }
}

describe('step1Schema (UC-03 mandatory revenue fields)', () => {
  test('accepts a valid Step 1 body', async () => {
    await expect(step1Schema.validate(validStep1())).resolves.toBeTruthy()
  })

  test('rejects evacuation_floors left blank (must be explicit, 0 is valid)', async () => {
    const { evacuation_floors, ...body } = validStep1()
    await expect(step1Schema.validate(body)).rejects.toThrow('Evacuation floor count cannot be blank')
  })

  test('accepts evacuation_floors of exactly 0', async () => {
    await expect(step1Schema.validate(validStep1({ evacuation_floors: 0 }))).resolves.toBeTruthy()
  })

  test('rejects job_end_time before job_start_time', async () => {
    await expect(
      step1Schema.validate(validStep1({ job_start_time: '2026-07-11T10:00', job_end_time: '2026-07-11T09:00' }))
    ).rejects.toThrow('Job end time must be after job start time')
  })

  // Cross-field UC-03 rule - was only enforced server-side originally, silently passing
  // all 4 wizard steps before failing at the final POST. Fixed with an explicit
  // createError({path: 'overtime_hours'}) so it surfaces immediately on Step 1.
  test('flags a >8.5h job with overtime_hours still 0 and no note, attached to overtime_hours', async () => {
    const body = validStep1({
      job_start_time: '2026-07-11T08:00',
      job_end_time: '2026-07-11T18:00', // 10h duration
      overtime_hours: 0,
      additional_charges_notes: '',
    })
    try {
      await step1Schema.validate(body)
      throw new Error('expected validation to reject')
    } catch (err) {
      expect(err.path).toBe('overtime_hours')
      expect(err.message).toMatch(/Job duration implies overtime/)
    }
  })

  test('a >8.5h job passes if overtime_hours is set even without a note', async () => {
    await expect(
      step1Schema.validate(validStep1({
        job_start_time: '2026-07-11T08:00',
        job_end_time: '2026-07-11T18:00',
        overtime_hours: 2,
      }))
    ).resolves.toBeTruthy()
  })

  test('a >8.5h job passes with overtime_hours 0 if a note explains it', async () => {
    await expect(
      step1Schema.validate(validStep1({
        job_start_time: '2026-07-11T08:00',
        job_end_time: '2026-07-11T18:00',
        overtime_hours: 0,
        additional_charges_notes: 'Traffic delay, no actual overtime worked.',
      }))
    ).resolves.toBeTruthy()
  })
})

describe('step2Schema (service & charges)', () => {
  test('accepts a minimal valid Step 2 body', async () => {
    await expect(step2Schema.validate({
      service_type: 'eas',
      transfer_type: 'one_way_hospital',
      is_office_hours: true,
    })).resolves.toBeTruthy()
  })

  test('rejects an invalid service_type', async () => {
    await expect(step2Schema.validate({
      service_type: 'not_a_real_type',
      transfer_type: 'one_way_hospital',
      is_office_hours: true,
    })).rejects.toThrow('Select a valid service type')
  })
})

describe('step3Schema (UC-02 signature / waiver)', () => {
  test('accepts a valid signature (not waived, signature_image_url present)', async () => {
    await expect(step3Schema.validate(validStep3())).resolves.toBeTruthy()
  })

  test('accepts a valid waiver (waived, waiver_reason present)', async () => {
    await expect(step3Schema.validate(validStep3({
      is_waived: true,
      signature_image_url: null,
      waiver_reason: 'Patient unconscious - ICU transfer',
    }))).resolves.toBeTruthy()
  })

  test('rejects a missing signer_name', async () => {
    const { signer_name, ...body } = validStep3()
    await expect(step3Schema.validate(body)).rejects.toThrow('Signer name is required')
  })

  // Regression test for the bug this hotfix branch was built to catch: checking the
  // waiver box and leaving Waiver Reason blank used to pass Step 3 validation silently
  // (the old object-level .test() had no explicit path, so Formik dropped the failure
  // entirely and the crew member sailed through to Step 4 undetected - only the backend
  // caught it, at the very final Submit). The fix attaches the error to 'waiver_reason'
  // via createError({path}) so the FieldError under that exact field lights up.
  test('rejects is_waived=true with a blank waiver_reason, attaching the error to waiver_reason', async () => {
    const body = validStep3({ is_waived: true, signature_image_url: null, waiver_reason: '' })
    try {
      await step3Schema.validate(body)
      throw new Error('expected validation to reject')
    } catch (err) {
      expect(err.path).toBe('waiver_reason')
      expect(err.message).toMatch(/Waiver reason is required/)
    }
  })

  test('rejects is_waived=true with waiver_reason of only whitespace', async () => {
    const body = validStep3({ is_waived: true, signature_image_url: null, waiver_reason: '   ' })
    try {
      await step3Schema.validate(body)
      throw new Error('expected validation to reject')
    } catch (err) {
      expect(err.path).toBe('waiver_reason')
    }
  })

  test('rejects is_waived=false with no signature_image_url, attaching the error to signature_image_url', async () => {
    const body = validStep3({ is_waived: false, signature_image_url: null })
    try {
      await step3Schema.validate(body)
      throw new Error('expected validation to reject')
    } catch (err) {
      expect(err.path).toBe('signature_image_url')
      expect(err.message).toMatch(/A drawn signature or a documented waiver is required/)
    }
  })
})
