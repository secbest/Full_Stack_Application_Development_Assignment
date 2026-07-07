const router = require('express').Router()

// ─── Shared Auth ───────────────────────────────────────────────────────────────
const authRoutes = require('./authRoutes')              // POST /auth/register, POST /auth/login
router.use('/auth', authRoutes)

// const userRoutes = require('./userRoutes')           // GET  /users?role=field_crew (crew list)
// router.use('/users', userRoutes)

// ─── Zheng Bao: Customer Intake & Booking Management ──────────────────────────
const intakeRoutes = require('./intakeRoutes')
router.use('/intake', intakeRoutes)

const bookingRoutes = require('./bookingRoutes')
router.use('/bookings', bookingRoutes)

// ─── Liang Yi: Field Operations & Executive Dashboard (implemented by Jasper - see README) ────
const serviceMemoRoutes = require('./serviceMemoRoutes')
router.use('/service-memos', serviceMemoRoutes)

const dashboardRoutes = require('./dashboardRoutes')
router.use('/dashboard', dashboardRoutes)

// ─── AR Billing, Pricing Engine & Invoice Sync (Wave 3) ───────────────────────
// Design by Jasper (design/jasper/); Wave 3 implemented by Kwan Hua (took over Wave 3).
// Memo review (pending-review, approve, return) lives on serviceMemoRoutes above.
// Pricing-contract CRUD is Wave 2 (not implemented); the engine reads seeded pricing data.
const invoiceRoutes = require('./invoiceRoutes')
router.use('/invoices', invoiceRoutes)

// ─── Kwan Hua: Xero Foundation, OCR & AP Processing ──────────────────────────
const xeroRoutes = require('./xeroRoutes')              // Wave 1B: GET /connect only, rest is Wave 3
router.use('/xero', xeroRoutes)

const vendorInvoiceRoutes = require('./vendorInvoiceRoutes') // Wave 1B upload + Wave 3 review/approve/reject/reextract
router.use('/vendor-invoices', vendorInvoiceRoutes)

const vendorInvoiceItemRoutes = require('./vendorInvoiceItemRoutes') // Wave 3: PATCH line item
router.use('/vendor-invoice-items', vendorInvoiceItemRoutes)

module.exports = router
