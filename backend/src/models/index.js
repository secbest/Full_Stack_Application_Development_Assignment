// ─── Model registry ───────────────────────────────────────────────────────────
// All models are imported here. Associations are declared BELOW the imports so
// every model class exists before any foreign-key reference is made.
// To add a new model: (1) create its file, (2) require it here, (3) add its associations.

const { User, ROLES }     = require('./User')
const Client              = require('./Client')

// Zheng Bao - Customer Intake & Booking Management
const IntakeSubmission    = require('./IntakeSubmission')
const Booking             = require('./Booking')
const Notification        = require('./Notification')

// Jasper - AR Billing, Pricing Engine & Invoice Sync
const PricingContract     = require('./PricingContract')
const PricingRate         = require('./PricingRate')
const SurchargeSchedule   = require('./SurchargeSchedule')
const Invoice             = require('./Invoice')
const InvoiceLineItem     = require('./InvoiceLineItem')

// Liang Yi - Field Operations & Executive Dashboard
const ServiceMemo         = require('./ServiceMemo')
const MemoSignature       = require('./MemoSignature')

// Kwan Hua - Xero Foundation, OCR & AP Processing
const XeroConnection      = require('./XeroConnection')
const VendorInvoice       = require('./VendorInvoice')
const VendorInvoiceItem   = require('./VendorInvoiceItem')
const XeroSyncLog         = require('./XeroSyncLog')


// ─── Associations ─────────────────────────────────────────────────────────────
//
// Convention used here:
//   belongsTo  = "this model holds the foreign key column"
//   hasMany    = "the other model holds the foreign key column pointing here"
//   hasOne     = like hasMany but enforces one child per parent
//
// All associations are in one file so you can see every relationship in a single
// place rather than hunting across individual model files.

// ── User ─────────────────────────────────────────────────────────────────────
// A User can do many things across the platform depending on their role.
User.hasMany(Notification,      { foreignKey: 'user_id' })
User.hasMany(IntakeSubmission,  { foreignKey: 'reviewed_by',    as: 'reviewedSubmissions' })
User.hasMany(Booking,           { foreignKey: 'created_by',     as: 'createdBookings' })
User.hasMany(Booking,           { foreignKey: 'assigned_crew_id', as: 'assignedJobs' })
User.hasMany(PricingContract,   { foreignKey: 'created_by',     as: 'createdContracts' })
User.hasMany(Invoice,           { foreignKey: 'approved_by',    as: 'approvedInvoices' })
User.hasMany(ServiceMemo,       { foreignKey: 'submitted_by',   as: 'submittedMemos' })
User.hasMany(ServiceMemo,       { foreignKey: 'reviewed_by',    as: 'reviewedMemos' })
User.hasMany(VendorInvoice,     { foreignKey: 'uploaded_by',    as: 'uploadedVendorInvoices' })
User.hasMany(VendorInvoice,     { foreignKey: 'approved_by',    as: 'approvedVendorInvoices' })

// ── Client ───────────────────────────────────────────────────────────────────
// A Client has many bookings over time, one active pricing contract, and many invoices.
Client.hasMany(Booking,         { foreignKey: 'client_id' })
Client.hasMany(PricingContract, { foreignKey: 'client_id' })
Client.hasMany(Invoice,         { foreignKey: 'client_id' })

// ── IntakeSubmission ──────────────────────────────────────────────────────────
// An intake form submission can become at most one booking.
// reviewed_by is set to the Quotations Specialist who actioned it.
IntakeSubmission.belongsTo(User,    { foreignKey: 'reviewed_by',         as: 'reviewedBy' })
IntakeSubmission.hasOne(Booking,    { foreignKey: 'intake_submission_id' })

// ── Booking ───────────────────────────────────────────────────────────────────
// Central job record. Connects intake → crew → memo → invoice.
// created_by is the Quotations Specialist; assigned_crew_id is the field crew member.
Booking.belongsTo(IntakeSubmission, { foreignKey: 'intake_submission_id' })
Booking.belongsTo(Client,           { foreignKey: 'client_id' })
Booking.belongsTo(User,             { foreignKey: 'created_by',      as: 'createdBy' })
Booking.belongsTo(User,             { foreignKey: 'assigned_crew_id', as: 'assignedCrew' })
Booking.hasOne(ServiceMemo,         { foreignKey: 'booking_id' })
Booking.hasOne(Invoice,             { foreignKey: 'booking_id' })

// ── Notification ──────────────────────────────────────────────────────────────
Notification.belongsTo(User, { foreignKey: 'user_id' })

// ── PricingContract ───────────────────────────────────────────────────────────
// A contract groups a client's rate rows and surcharge rows.
// Deleting a contract cascades to its rates and surcharges (no orphaned rate rows).
PricingContract.belongsTo(Client, { foreignKey: 'client_id' })
PricingContract.belongsTo(User,   { foreignKey: 'created_by', as: 'createdBy' })
PricingContract.hasMany(PricingRate,      { foreignKey: 'contract_id', onDelete: 'CASCADE' })
PricingContract.hasMany(SurchargeSchedule, { foreignKey: 'contract_id', onDelete: 'CASCADE' })
PricingContract.hasMany(Invoice,          { foreignKey: 'contract_id' })

// ── PricingRate ───────────────────────────────────────────────────────────────
// Each rate row belongs to exactly one contract.
PricingRate.belongsTo(PricingContract, { foreignKey: 'contract_id' })

// ── SurchargeSchedule ─────────────────────────────────────────────────────────
SurchargeSchedule.belongsTo(PricingContract, { foreignKey: 'contract_id' })

// ── Invoice ───────────────────────────────────────────────────────────────────
// Auto-generated from a service memo. One invoice per memo (unique FK on memo_id).
Invoice.belongsTo(ServiceMemo,    { foreignKey: 'memo_id' })
Invoice.belongsTo(Booking,        { foreignKey: 'booking_id' })
Invoice.belongsTo(Client,         { foreignKey: 'client_id' })
Invoice.belongsTo(PricingContract, { foreignKey: 'contract_id' })
Invoice.belongsTo(User,           { foreignKey: 'approved_by', as: 'approvedBy' })
Invoice.hasMany(InvoiceLineItem,  { foreignKey: 'invoice_id', onDelete: 'CASCADE' })
// Polymorphic: AR invoices use XeroSyncLog with entity_type = 'ar_invoice'
Invoice.hasMany(XeroSyncLog, { foreignKey: 'entity_id', scope: { entity_type: 'ar_invoice' }, as: 'syncLogs' })

// ── InvoiceLineItem ───────────────────────────────────────────────────────────
InvoiceLineItem.belongsTo(Invoice, { foreignKey: 'invoice_id' })

// ── ServiceMemo ───────────────────────────────────────────────────────────────
// One memo per booking. submitted_by is the field crew; reviewed_by is the AR Specialist.
ServiceMemo.belongsTo(Booking, { foreignKey: 'booking_id' })
ServiceMemo.belongsTo(User,    { foreignKey: 'submitted_by', as: 'submittedBy' })
ServiceMemo.belongsTo(User,    { foreignKey: 'reviewed_by',  as: 'reviewedBy' })
ServiceMemo.hasMany(MemoSignature, { foreignKey: 'memo_id', onDelete: 'CASCADE' })
ServiceMemo.hasOne(Invoice,        { foreignKey: 'memo_id' })

// ── MemoSignature ─────────────────────────────────────────────────────────────
// Cascades with the parent memo. is_waived = true when the patient cannot sign.
MemoSignature.belongsTo(ServiceMemo, { foreignKey: 'memo_id' })

// ── VendorInvoice ─────────────────────────────────────────────────────────────
// uploaded_by is the AP Specialist who uploaded the PDF.
// approved_by is the AP Specialist who reviewed and approved the OCR result.
VendorInvoice.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploadedBy' })
VendorInvoice.belongsTo(User, { foreignKey: 'approved_by', as: 'approvedBy' })
VendorInvoice.hasMany(VendorInvoiceItem, { foreignKey: 'vendor_invoice_id', onDelete: 'CASCADE' })
// Polymorphic: vendor invoices use XeroSyncLog with entity_type = 'vendor_invoice'
VendorInvoice.hasMany(XeroSyncLog, { foreignKey: 'entity_id', scope: { entity_type: 'vendor_invoice' }, as: 'syncLogs' })

// ── VendorInvoiceItem ─────────────────────────────────────────────────────────
VendorInvoiceItem.belongsTo(VendorInvoice, { foreignKey: 'vendor_invoice_id' })

// ── XeroConnection ────────────────────────────────────────────────────────────
// Standalone - no FK associations. Queried as a singleton (WHERE id = 1 or first()).

// ── XeroSyncLog ───────────────────────────────────────────────────────────────
// Polymorphic - no static belongsTo. Always query with both entity_type AND entity_id.
// Scoped hasMany associations are declared on Invoice and VendorInvoice above.


// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  // Shared / group
  User,
  ROLES,
  Client,

  // Zheng Bao
  IntakeSubmission,
  Booking,
  Notification,

  // Jasper
  PricingContract,
  PricingRate,
  SurchargeSchedule,
  Invoice,
  InvoiceLineItem,

  // Liang Yi
  ServiceMemo,
  MemoSignature,

  // Kwan Hua
  XeroConnection,
  VendorInvoice,
  VendorInvoiceItem,
  XeroSyncLog,
}
