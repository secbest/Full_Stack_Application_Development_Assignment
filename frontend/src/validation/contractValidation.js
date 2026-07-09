import * as Yup from 'yup'

// Mirrors backend/src/validators/contractValidators.js field-for-field, including the
// exact enum values, so a field that fails here would fail the same way server-side -
// the backend remains the source of truth (this is a UX pre-check, not a security boundary).
export const SERVICE_TYPES = ['eas', 'mts', 'event_standby', 'workplace_standby']
export const TRANSFER_TYPES = [
  'one_way_hospital', 'two_way_hospital', 'covid_19', 'imh_psychiatric',
  'airport_no_tarmac', 'airport_with_tarmac', 'sg_jb_ground', 'air_evacuation',
]
export const TIME_OF_DAY = ['office_hours', 'non_office_hours', 'all_hours']

// Mirrors backend/src/validators/contractValidators.js's DATE_ONLY regex. The date
// fields are always populated from a native <input type="date"> today, which already
// only ever emits this format - but the schema itself should describe that constraint
// rather than relying on the input type as an implicit, undocumented guarantee (e.g. if
// a value ever came from formik.setValues fed by a differently-serialized API response).
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// Mirrors backend/src/validators/contractValidators.js's listContractsQuerySchema
// .max(100) - the list page uses this as its "fetch all in one page" limit rather than
// a second, independently-typed 100 that could silently drift from the backend's cap.
export const MAX_CONTRACTS_PER_PAGE = 100
export const SURCHARGE_TYPES = [
  'oxygen_base', 'oxygen_per_litre', 'inconvenience_fee', 'disposables_base',
  'resuscitation', 'suction', 'waiting_time_per_30min',
  'heavy_lifting_min', 'heavy_lifting_max',
  'jurong_island_min', 'jurong_island_max',
  'cancellation',
]

export const rateSchema = Yup.object({
  service_type: Yup.string().oneOf(SERVICE_TYPES, 'Select a valid service type').required('Service type is required'),
  transfer_type: Yup.string().oneOf(TRANSFER_TYPES, 'Select a valid transfer type').required('Transfer type is required'),
  time_of_day: Yup.string().oneOf(TIME_OF_DAY, 'Select a valid time of day').required('Time of day is required'),
  base_amount: Yup.number().typeError('Must be a number').positive('Base amount must be a positive number').required('Base amount is required'),
})

// Create form: rates/surcharges are handled as their own field arrays in Formik
// (not validated item-by-item here) since the mini "add rate" row uses rateSchema
// directly before a row is added to the array.
export const createContractSchema = Yup.object({
  client_id: Yup.number().typeError('Select a client').positive().required('Client is required'),
  contract_name: Yup.string().trim().required('Contract name is required'),
  effective_from: Yup.string().matches(DATE_ONLY, 'Effective from must be in YYYY-MM-DD format').required('Effective from date is required'),
  effective_to: Yup.string()
    .matches(DATE_ONLY, 'Effective to must be in YYYY-MM-DD format')
    .required('Effective to date is required')
    .test('after-from', 'Effective to must be on or after effective from', function (value) {
      const { effective_from } = this.parent
      if (!value || !effective_from) return true
      return value >= effective_from
    }),
})

// The backend's updateContractSchema (contractValidators.js) makes every field
// optional - it's a true partial PATCH, and also accepts is_active and
// acknowledge_matched_invoices. This schema deliberately requires contract_name/
// effective_from/effective_to instead of mirroring that optionality: the edit FORM
// always displays and submits all three as one full-state edit (there's no partial-
// field edit UI), so requiring them here is correct for this form's UX, not a bug.
// is_active and acknowledge_matched_invoices aren't listed below because neither is
// ever an input the user types into this form - is_active is set by the separate
// Deactivate action (ContractDetailPage.jsx) and acknowledge_matched_invoices is
// bolted on internally after a 400 HAS_MATCHED_INVOICES response, not user input - so
// there's nothing for Yup to validate on either. Documented here so it's clear this
// schema is intentionally narrower than the endpoint, not an oversight.
export const editContractSchema = Yup.object({
  contract_name: Yup.string().trim().required('Contract name is required'),
  effective_from: Yup.string().matches(DATE_ONLY, 'Effective from must be in YYYY-MM-DD format').required('Effective from date is required'),
  effective_to: Yup.string()
    .matches(DATE_ONLY, 'Effective to must be in YYYY-MM-DD format')
    .required('Effective to date is required')
    .test('after-from', 'Effective to must be on or after effective from', function (value) {
      const { effective_from } = this.parent
      if (!value || !effective_from) return true
      return value >= effective_from
    }),
})

export const updateRateSchema = Yup.object({
  base_amount: Yup.number().typeError('Must be a number').positive('Base amount must be a positive number').required('Base amount is required'),
})

export const updateSurchargeSchema = Yup.object({
  amount: Yup.number().typeError('Must be a number').min(0, 'Amount cannot be negative').required('Amount is required'),
})
