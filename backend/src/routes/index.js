const router = require('express').Router()

// ─── Shared Auth ───────────────────────────────────────────────────────────────
const authRoutes = require('./authRoutes')              // POST /auth/register, POST /auth/login
router.use('/auth', authRoutes)

const userRoutes = require('./userRoutes')               // GET /users?role= (crew list); PATCH /users/me, PATCH /users/me/password (self-service); DELETE /users/:id (managing_director only)
router.use('/users', userRoutes)

// ─── Shared: Notifications ─────────────────────────────────────────────────────
// Every role reads and marks only its own notifications. Writes happen from inside
// other controllers via notificationService.create() - this route file only reads.
const notificationRoutes = require('./notificationRoutes')
router.use('/notifications', notificationRoutes)

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
const invoiceRoutes = require('./invoiceRoutes')
router.use('/invoices', invoiceRoutes)

// Pricing-contract CRUD (Wave 2B, Jasper).
const contractRoutes = require('./contractRoutes')
router.use('/contracts', contractRoutes)

// Minimal read-only client list (needed by the contract form's client picker).
const clientRoutes = require('./clientRoutes')
router.use('/clients', clientRoutes)

// ─── Kwan Hua: Xero Foundation, OCR & AP Processing ──────────────────────────
const xeroRoutes = require('./xeroRoutes')              // Wave 1B: GET /connect only, rest is Wave 3
router.use('/xero', xeroRoutes)

const vendorInvoiceRoutes = require('./vendorInvoiceRoutes') // Wave 1B upload + Wave 3 review/approve/reject/reextract
router.use('/vendor-invoices', vendorInvoiceRoutes)

const vendorInvoiceItemRoutes = require('./vendorInvoiceItemRoutes') // Wave 3: PATCH line item
router.use('/vendor-invoice-items', vendorInvoiceItemRoutes)

module.exports = router
