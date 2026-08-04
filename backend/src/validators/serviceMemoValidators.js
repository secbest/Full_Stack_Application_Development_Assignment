const Yup = require('yup')

const SERVICE_TYPES = ['eas', 'mts', 'event_standby', 'workplace_standby']
const TRANSFER_TYPES = [
  'one_way_hospital', 'two_way_hospital', 'covid_19', 'imh_psychiatric',
  'airport_no_tarmac', 'airport_with_tarmac', 'sg_jb_ground', 'air_evacuation',
]

// Assumption: no per-booking "scheduled shift length" field exists yet on the bookings table,
// so overtime consistency (UC-03) is checked against a flat 8-hour standard shift plus the
// documented 30-minute grace period. Revisit once Zheng Bao's bookings schema exposes a real
// scheduled duration.
const STANDARD_SHIFT_HOURS = 8

// The two service types that always involve an ambulance and therefore a patient.
const AMBULANCE_SERVICE_TYPES = ['eas', 'mts']

const requiredForAmbulanceOnly = (fieldName) =>
  Yup.string().trim().when('service_type', {
    is: (v) => AMBULANCE_SERVICE_TYPES.includes(v),
    then: (schema) => schema.required(`${fieldName} is required`),
    otherwise: (schema) => schema.nullable().transform((v) => (v === '' ? null : v)).default(null),
  })

const signatureSchema = Yup.object({
  signer_name: Yup.string().trim().required('Signer name is required'),
  signature_image_url: Yup.string().url('signature_image_url must be a valid URL').nullable().default(null),
  signed_at: Yup.date().required('signed_at is required'),
  is_waived: Yup.boolean().required('is_waived is required'),
  waiver_reason: Yup.string().trim().nullable().default(null),
})
  .required('signature is required')
  // Object-level test: the doc's UC-02 rule is an XOR, not two independent required fields -
  // a waived signature must have a reason instead of an image, and vice versa.
  .test(
    'signature-required',
    'A signature image URL or a documented waiver with waiver_reason is required.',
    (value) => {
      if (!value) return false
      return value.is_waived ? !!value.waiver_reason : !!value.signature_image_url
    }
  )

const createServiceMemoSchema = Yup.object({
  booking_id: Yup.number().integer().positive().required('booking_id is required'),

  job_start_time: Yup.date().required('job_start_time is required'),
  job_end_time: Yup.date()
    .required('job_end_time is required')
    .test('after-start', 'job_end_time must be after job_start_time', function (value) {
      const { job_start_time } = this.parent
      if (!value || !job_start_time) return true // let the required() checks report those separately
      return new Date(value) > new Date(job_start_time)
    }),

  overtime_hours: Yup.number()
    .required('overtime_hours is required')
    .min(0, 'overtime_hours cannot be negative'),
  evacuation_floors: Yup.number()
    .integer()
    .min(0, 'evacuation_floors cannot be negative')
    .required('Evacuation floor count cannot be blank. Enter 0 if no evacuation occurred.'),

  // Client feedback item 4: manpower-only event/workplace standby jobs have no patient
  // and no hospital run, so both fields are required only for the ambulance service
  // types. For standby types an empty string coerces to null (a standby job CAN still
  // have a patient - an event casualty - so a provided value is kept).
  patient_name: requiredForAmbulanceOnly('patient_name'),
  hospital_destination: requiredForAmbulanceOnly('hospital_destination'),

  service_type: Yup.string().oneOf(SERVICE_TYPES, `service_type must be one of: ${SERVICE_TYPES.join(', ')}`).required('service_type is required'),
  transfer_type: Yup.string().oneOf(TRANSFER_TYPES, `transfer_type must be one of: ${TRANSFER_TYPES.join(', ')}`).required('transfer_type is required'),
  is_office_hours: Yup.boolean().required('is_office_hours is required'),

  oxygen_litres_used: Yup.number().min(0, 'oxygen_litres_used cannot be negative').default(0),
  has_inconvenience_fee: Yup.boolean().default(false),
  disposables_used: Yup.boolean().default(false),
  resuscitation_performed: Yup.boolean().default(false),
  suction_performed: Yup.boolean().default(false),
  waiting_time_minutes: Yup.number().integer().min(0, 'waiting_time_minutes cannot be negative').default(0),
  patient_weight_kg: Yup.number().min(0, 'patient_weight_kg cannot be negative').nullable().default(null),
  is_jurong_island: Yup.boolean().default(false),

  additional_charges_notes: Yup.string().trim().nullable().default(null),
  hospital_stamp_image_url: Yup.string().url('hospital_stamp_image_url must be a valid URL').nullable().default(null),

  signature: signatureSchema,
})
  // Object-level test: UC-03's overtime rule spans two fields (job duration and overtime_hours),
  // so it can't live on a single field validator.
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

const memoIdParamSchema = Yup.object({
  id: Yup.number().integer().positive().required('A valid service memo id is required'),
})

const listServiceMemosQuerySchema = Yup.object({
  status: Yup.string().oneOf(['submitted', 'reviewed', 'invoiced'], 'status must be one of: submitted, reviewed, invoiced'),
  booking_id: Yup.number().integer().positive(),
  submitted_by: Yup.number().integer().positive(),
  date_from: Yup.date(),
  date_to: Yup.date(),
  page: Yup.number().integer().min(1).default(1),
  limit: Yup.number().integer().min(1).max(100).default(20),
})
  .test('date-range', 'date_from must be before or equal to date_to.', function (values) {
    if (!values.date_from || !values.date_to) return true
    if (new Date(values.date_from) > new Date(values.date_to)) {
      return this.createError({ path: 'date_to', message: 'date_from must be before or equal to date_to.' })
    }
    return true
  })

module.exports = {
  createServiceMemoSchema,
  memoIdParamSchema,
  listServiceMemosQuerySchema,
}
