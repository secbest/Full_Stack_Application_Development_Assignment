const Yup = require('yup')

const SERVICE_TYPES = ['eas', 'mts', 'event_standby', 'workplace_standby']
const TRANSFER_TYPES = [
  'one_way_hospital', 'two_way_hospital', 'covid_19', 'imh_psychiatric',
  'airport_no_tarmac', 'airport_with_tarmac', 'sg_jb_ground', 'air_evacuation',
]
const TIME_OF_DAY = ['office_hours', 'non_office_hours', 'all_hours']
const SURCHARGE_TYPES = [
  'oxygen_base', 'oxygen_per_litre', 'inconvenience_fee', 'disposables_base',
  'resuscitation', 'suction', 'waiting_time_per_30min',
  'heavy_lifting_min', 'heavy_lifting_max',
  'jurong_island_min', 'jurong_island_max',
  'overtime_per_hour',
  'cancellation',
]

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// Realistic ceilings so an amount can't be persisted with an absurd value (e.g. a
// mistyped extra zero). Seeded rates run $450-$1,800 and surcharges $1-$320, so these
// caps sit well above any genuine figure while still rejecting obvious fat-finger
// errors. Mirrored in frontend/src/validation/contractValidation.js; keep in sync.
const MAX_RATE_AMOUNT = 50000
const MAX_SURCHARGE_AMOUNT = 10000

const rateInputSchema = Yup.object({
  service_type: Yup.string().oneOf(SERVICE_TYPES, `service_type must be one of: ${SERVICE_TYPES.join(', ')}`).required('service_type is required'),
  transfer_type: Yup.string().oneOf(TRANSFER_TYPES, `transfer_type must be one of: ${TRANSFER_TYPES.join(', ')}`).required('transfer_type is required'),
  time_of_day: Yup.string().oneOf(TIME_OF_DAY, `time_of_day must be one of: ${TIME_OF_DAY.join(', ')}`).required('time_of_day is required'),
  base_amount: Yup.number().positive('base_amount must be a positive number').max(MAX_RATE_AMOUNT, `base_amount cannot exceed ${MAX_RATE_AMOUNT}`).required('base_amount is required'),
})

const surchargeInputSchema = Yup.object({
  surcharge_type: Yup.string().oneOf(SURCHARGE_TYPES, `surcharge_type must be one of: ${SURCHARGE_TYPES.join(', ')}`).required('surcharge_type is required'),
  amount: Yup.number().min(0, 'amount cannot be negative').max(MAX_SURCHARGE_AMOUNT, `amount cannot exceed ${MAX_SURCHARGE_AMOUNT}`).required('amount is required'),
})

// POST /api/contracts - UC-01. rates/surcharges default to [] so a contract can be
// saved with none (allowed per UC-01's edge case - the engine just won't match until
// rules are added), rather than forcing the whole create to fail.
const createContractSchema = Yup.object({
  client_id: Yup.number().integer().positive().required('client_id is required'),
  contract_name: Yup.string().trim().required('contract_name is required'),
  effective_from: Yup.string().matches(DATE_ONLY, 'effective_from must be in YYYY-MM-DD format').required('effective_from is required'),
  effective_to: Yup.string().matches(DATE_ONLY, 'effective_to must be in YYYY-MM-DD format').required('effective_to is required'),
  rates: Yup.array().of(rateInputSchema).default([]),
  surcharges: Yup.array().of(surchargeInputSchema).default([]),
})
  .test(
    'date-range',
    'effective_to must be on or after effective_from.',
    function (values) {
      if (!values.effective_from || !values.effective_to) return true
      if (values.effective_to < values.effective_from) {
        return this.createError({ path: 'effective_to', message: 'effective_to must be on or after effective_from.' })
      }
      return true
    }
  )

// PATCH /api/contracts/:id - UC-02. Every field optional; only fields present are applied.
// acknowledge_matched_invoices is not in the original API doc's sample body, but the doc's
// 400 HAS_MATCHED_INVOICES error implies a two-step confirm - this is that flag (see
// contractController.updateContract for how it's used).
const updateContractSchema = Yup.object({
  contract_name: Yup.string().trim(),
  effective_from: Yup.string().matches(DATE_ONLY, 'effective_from must be in YYYY-MM-DD format'),
  effective_to: Yup.string().matches(DATE_ONLY, 'effective_to must be in YYYY-MM-DD format'),
  is_active: Yup.boolean(),
  acknowledge_matched_invoices: Yup.boolean().default(false),
})

const listContractsQuerySchema = Yup.object({
  client_id: Yup.number().integer().positive(),
  is_active: Yup.boolean(),
  page: Yup.number().integer().min(1).default(1),
  limit: Yup.number().integer().min(1).max(100).default(20),
})

const contractIdParamSchema = Yup.object({
  id: Yup.number().integer().positive().required('A valid contract id is required'),
})

// POST /api/contracts/:contractId/rates
const addRateSchema = rateInputSchema

const contractIdOnlyParamSchema = Yup.object({
  contractId: Yup.number().integer().positive().required('A valid contract id is required'),
})

const rateParamSchema = Yup.object({
  contractId: Yup.number().integer().positive().required('A valid contract id is required'),
  rateId: Yup.number().integer().positive().required('A valid rate id is required'),
})

// PUT /api/contracts/:contractId/rates/:rateId - only base_amount is editable.
const updateRateSchema = Yup.object({
  base_amount: Yup.number().positive('base_amount must be a positive number').max(MAX_RATE_AMOUNT, `base_amount cannot exceed ${MAX_RATE_AMOUNT}`).required('base_amount is required'),
})

const surchargeParamSchema = Yup.object({
  contractId: Yup.number().integer().positive().required('A valid contract id is required'),
  surchargeId: Yup.number().integer().positive().required('A valid surcharge id is required'),
})

// PUT /api/contracts/:contractId/surcharges/:surchargeId
const updateSurchargeSchema = Yup.object({
  amount: Yup.number().min(0, 'amount cannot be negative').max(MAX_SURCHARGE_AMOUNT, `amount cannot exceed ${MAX_SURCHARGE_AMOUNT}`).required('amount is required'),
})

module.exports = {
  SERVICE_TYPES,
  TRANSFER_TYPES,
  TIME_OF_DAY,
  SURCHARGE_TYPES,
  createContractSchema,
  updateContractSchema,
  listContractsQuerySchema,
  contractIdParamSchema,
  contractIdOnlyParamSchema,
  addRateSchema,
  rateParamSchema,
  updateRateSchema,
  surchargeParamSchema,
  updateSurchargeSchema,
}
