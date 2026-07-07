const Yup = require('yup')

const ROLES = ['managing_director', 'ar_specialist', 'ap_specialist', 'quotations_specialist', 'field_crew']

const registerSchema = Yup.object({
  name: Yup.string().min(2).max(100).required('Name is required'),
  email: Yup.string().email('Must be a valid email').required('Email is required'),
  password: Yup.string().min(8, 'Password must be at least 8 characters').required('Password is required'),
  role: Yup.string().oneOf(ROLES, `Role must be one of: ${ROLES.join(', ')}`).required('Role is required'),
})

const loginSchema = Yup.object({
  email: Yup.string().email('Must be a valid email').required('Email is required'),
  password: Yup.string().required('Password is required'),
})

const vendorInvoiceUploadSchema = Yup.object({
  rebate_percentage: Yup.number().min(0).max(100).default(1.00),
})

const intakeCreateSchema = Yup.object({
  customer_name: Yup.string().trim().required('Customer name is required'),
  organisation: Yup.string().trim().nullable(),
  contact_email: Yup.string().email('Must be a valid email').required('Contact email is required'),
  contact_phone: Yup.string()
    .matches(/^\d{8}$/, 'Contact phone must be 8 digits')
    .required('Contact phone is required'),
  service_type: Yup.string()
    .oneOf(['eas', 'mts', 'event_standby', 'workplace_standby'], 'Service type is invalid')
    .required('Service type is required'),
  service_tier: Yup.string()
    .oneOf(['basic', 'advanced', 'critical'], 'Service tier is invalid')
    .required('Service tier is required'),
  preferred_date: Yup.string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, 'Preferred date must be in YYYY-MM-DD format')
    .required('Preferred date is required'),
  preferred_time: Yup.string()
    .matches(/^\d{2}:\d{2}$/, 'Preferred time must be in HH:MM format')
    .required('Preferred time is required'),
  pickup_location: Yup.string().trim().required('Pickup location is required'),
  destination: Yup.string().trim().required('Destination is required'),
  additional_notes: Yup.string().trim().nullable(),
})

const intakeConfirmSchema = Yup.object({
  service_tier: Yup.string().oneOf(['basic', 'advanced', 'critical']).nullable(),
  scheduled_date: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'Scheduled date must be in YYYY-MM-DD format').nullable(),
  scheduled_time: Yup.string().matches(/^\d{2}:\d{2}$/, 'Scheduled time must be in HH:MM format').nullable(),
  pickup_location: Yup.string().trim().nullable(),
  destination: Yup.string().trim().nullable(),
  notes: Yup.string().trim().nullable(),
})

const intakeRejectSchema = Yup.object({
  rejection_reason: Yup.string().trim().required('Rejection reason is required'),
})

const bookingCrewSchema = Yup.object({
  assigned_crew_id: Yup.number().integer().positive().nullable(true).required('assigned_crew_id is required'),
})

// Liang Yi - Field Operations & Executive Dashboard
const {
  createServiceMemoSchema,
  memoIdParamSchema,
  listServiceMemosQuerySchema,
} = require('./serviceMemoValidators')
const { fleetOverviewQuerySchema, vendorExpensesQuerySchema } = require('./dashboardValidators')

module.exports = {
  registerSchema,
  loginSchema,
  vendorInvoiceUploadSchema,
  intakeCreateSchema,
  intakeConfirmSchema,
  intakeRejectSchema,
  bookingCrewSchema,
  createServiceMemoSchema,
  memoIdParamSchema,
  listServiceMemosQuerySchema,
  fleetOverviewQuerySchema,
  vendorExpensesQuerySchema,
}
