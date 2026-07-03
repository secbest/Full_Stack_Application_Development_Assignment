import * as Yup from 'yup'

// Mirrors backend/src/validators/serviceMemoValidators.js field-for-field, including the
// exact message text, so a field that fails here would fail the same way server-side -
// the backend remains the source of truth (this is a UX pre-check, not a security boundary).
export const SERVICE_TYPES = ['eas', 'mts', 'event_standby', 'workplace_standby']
export const TRANSFER_TYPES = [
  'one_way_hospital', 'two_way_hospital', 'covid_19', 'imh_psychiatric',
  'airport_no_tarmac', 'airport_with_tarmac', 'sg_jb_ground', 'air_evacuation',
]

// Matches backend/src/validators/serviceMemoValidators.js's STANDARD_SHIFT_HOURS assumption
// exactly - see that file's comment for why 8 hours is used (no scheduled-duration field
// exists on bookings yet).
const STANDARD_SHIFT_HOURS = 8

export const step1Schema = Yup.object({
  job_start_time: Yup.date().required('Job start time is required'),
  job_end_time: Yup.date()
    .required('Job end time is required')
    .test('after-start', 'Job end time must be after job start time', function (value) {
      const { job_start_time } = this.parent
      if (!value || !job_start_time) return true
      return new Date(value) > new Date(job_start_time)
    }),
  overtime_hours: Yup.number()
    .typeError('Overtime hours must be a number')
    .required('Overtime hours is required')
    .min(0, 'Overtime hours cannot be negative'),
  evacuation_floors: Yup.number()
    .typeError('Evacuation floor count must be a number')
    .integer()
    .min(0, 'Evacuation floor count cannot be negative')
    .required('Evacuation floor count cannot be blank. Enter 0 if no evacuation occurred.'),
  patient_name: Yup.string().trim().required('Patient name is required'),
  hospital_destination: Yup.string().trim().required('Hospital destination is required'),
  additional_charges_notes: Yup.string().trim().nullable(),
})
  // Cross-field UC-03 rule, previously only enforced server-side - it was passing all 4
  // wizard steps silently and only failing at the final POST, which is confusing because
  // the fields it complains about (job times, overtime) were filled in 3 steps earlier.
  // Mirrored here so the crew member sees it immediately on Step 1 instead.
  .test(
    'overtime-consistency',
    'Job duration implies overtime but overtime_hours is 0. Add a note or correct the hours.',
    function (values) {
      if (!values.job_start_time || !values.job_end_time || values.overtime_hours == null) return true
      const durationHours = (new Date(values.job_end_time) - new Date(values.job_start_time)) / 3_600_000
      const exceedsGracePeriod = durationHours > STANDARD_SHIFT_HOURS + 0.5
      const hasReasonNote = !!(values.additional_charges_notes && values.additional_charges_notes.trim())
      if (exceedsGracePeriod && Number(values.overtime_hours) === 0 && !hasReasonNote) {
        return this.createError({
          path: 'overtime_hours',
          message: 'Job duration implies overtime but overtime_hours is 0. Add a note in additional_charges_notes or correct the hours.',
        })
      }
      return true
    }
  )

export const step2Schema = Yup.object({
  service_type: Yup.string().oneOf(SERVICE_TYPES, 'Select a valid service type').required('Service type is required'),
  transfer_type: Yup.string().oneOf(TRANSFER_TYPES, 'Select a valid transfer type').required('Transfer type is required'),
  is_office_hours: Yup.boolean().required(),
  oxygen_litres_used: Yup.number().typeError('Must be a number').min(0, 'Cannot be negative').default(0),
  has_inconvenience_fee: Yup.boolean().default(false),
  disposables_used: Yup.boolean().default(false),
  resuscitation_performed: Yup.boolean().default(false),
  suction_performed: Yup.boolean().default(false),
  waiting_time_minutes: Yup.number().typeError('Must be a number').integer().min(0, 'Cannot be negative').default(0),
  patient_weight_kg: Yup.number().typeError('Must be a number').min(0, 'Cannot be negative').nullable(),
  is_jurong_island: Yup.boolean().default(false),
})

export const step3Schema = Yup.object({
  signer_name: Yup.string().trim().required('Signer name is required'),
  is_waived: Yup.boolean().required(),
  signature_image_url: Yup.string().nullable(),
  waiver_reason: Yup.string().trim().nullable(),
}).test(
  'signature-required',
  'A signature or a documented waiver reason is required.',
  (value) => (value.is_waived ? !!value.waiver_reason : !!value.signature_image_url)
)
