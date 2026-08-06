const Yup = require('yup')

const ROLES = ['managing_director', 'ar_specialist', 'ap_specialist', 'quotations_specialist', 'field_crew']

// Every account on this platform is an EFAR staff account, so registration is
// restricted to the company's own email domain.
const EFAR_EMAIL_DOMAIN = /@efar\.com\.sg$/i

const registerSchema = Yup.object({
  name: Yup.string().min(2).max(100).required('Name is required'),
  email: Yup.string().email('Must be a valid email').matches(EFAR_EMAIL_DOMAIN, 'Email must be an @efar.com.sg address').required('Email is required'),
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

// PATCH /api/vendor-invoices/:id - AP corrections to the OCR-extracted header.
//
// The bounds here are load-bearing, not decorative. This route used to read req.body
// directly, and the only downstream guard was "reject a negative verified_total" - which
// a NEGATIVE rebate_percentage can never trip, because it makes verified_total LARGER:
// calculateRebate(1000, -50) yields a rebate of -500 and a verified_total of 1500, i.e.
// EFAR would pay 1500 on a 1000 invoice. Non-numeric input was just as bad, coercing to
// NaN and reaching a DECIMAL column. Both are now rejected before the controller runs.
//
// Every field is optional (a PATCH may touch one field) but must be valid if present.
const vendorInvoiceUpdateSchema = Yup.object({
  vendor_name: Yup.string().trim().min(1, 'vendor_name cannot be blank').max(255),
  invoice_number: Yup.string().trim().min(1, 'invoice_number cannot be blank').max(100),
  invoice_date: Yup.string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, 'invoice_date must be in YYYY-MM-DD format')
    .nullable(),
  extracted_total: Yup.number()
    .typeError('extracted_total must be a number')
    .positive('extracted_total must be a positive number'),
  rebate_percentage: Yup.number()
    .typeError('rebate_percentage must be a number')
    .min(0, 'rebate_percentage cannot be negative')
    .max(100, 'rebate_percentage cannot exceed 100'),
})

// PATCH /api/vendor-invoice-items/:id - AP corrections to one extracted line item.
//
// `amount` is deliberately NOT accepted from the client: it is derived server-side as
// quantity x unit_price so a line item can never claim a total its own figures do not
// support (previously `amount` was persisted verbatim, so qty 2 x $10 could be stored
// with amount $999, and that $999 then became the invoice total).
const vendorInvoiceItemUpdateSchema = Yup.object({
  description: Yup.string().trim().min(1, 'description cannot be blank').max(500),
  quantity: Yup.number()
    .typeError('quantity must be a number')
    .positive('quantity must be a positive number'),
  unit_price: Yup.number()
    .typeError('unit_price must be a number')
    .min(0, 'unit_price cannot be negative'),
})

const VENDOR_INVOICE_STATUSES = ['pending_review', 'extraction_failed', 'approved', 'rejected', 'synced_to_xero', 'failed']

// GET /api/vendor-invoices - list query. Applied via validate(..., 'query') so the
// controller receives page/limit as numbers with defaults already filled in.
const vendorInvoiceListQuerySchema = Yup.object({
  status: Yup.string().oneOf(VENDOR_INVOICE_STATUSES, 'Invalid status filter').nullable(),
  vendor_name: Yup.string().trim().nullable(),
  date_from: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'date_from must be in YYYY-MM-DD format').nullable(),
  date_to: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'date_to must be in YYYY-MM-DD format').nullable(),
  page: Yup.number().integer().min(1).default(1),
  limit: Yup.number().integer().min(1).max(100).default(20),
})

// GET /api/xero/sync-logs - list query (shared by AP + AR).
const syncLogListQuerySchema = Yup.object({
  status: Yup.string().oneOf(['pending', 'success', 'failed'], 'Invalid status filter').nullable(),
  entity_type: Yup.string().oneOf(['ar_invoice', 'vendor_invoice', 'bank_feed'], 'Invalid entity_type filter').nullable(),
  page: Yup.number().integer().min(1).default(1),
  limit: Yup.number().integer().min(1).max(200).default(50),
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
  service_tier: Yup.string()
    .oneOf(['basic', 'advanced', 'critical'], 'Service tier is invalid')
    .required('Service tier is required'),
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
const { fleetOverviewQuerySchema, vendorExpensesQuerySchema, revenueLeakageQuerySchema, cycleTimeQuerySchema, revenueTrendQuerySchema } = require('./dashboardValidators')

// Jasper - Field Operations follow-up (client feedback item 1: live job milestones)
const { MILESTONE_TYPES, milestoneBodySchema, bookingIdParamSchema } = require('./milestoneValidators')
const { userIdParamSchema } = require('./userValidators')

// Jasper - AR Billing, Pricing Engine & Invoice Sync (Wave 2B: pricing contracts)
const {
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
} = require('./contractValidators')

module.exports = {
  registerSchema,
  loginSchema,
  vendorInvoiceUploadSchema,
  vendorInvoiceUpdateSchema,
  vendorInvoiceItemUpdateSchema,
  vendorInvoiceListQuerySchema,
  syncLogListQuerySchema,
  intakeCreateSchema,
  intakeConfirmSchema,
  intakeRejectSchema,
  bookingCrewSchema,
  createServiceMemoSchema,
  memoIdParamSchema,
  listServiceMemosQuerySchema,
  fleetOverviewQuerySchema,
  vendorExpensesQuerySchema,
  revenueLeakageQuerySchema,
  cycleTimeQuerySchema,
  revenueTrendQuerySchema,
  userIdParamSchema,
  MILESTONE_TYPES,
  milestoneBodySchema,
  bookingIdParamSchema,
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
