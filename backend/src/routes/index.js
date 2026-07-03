const router = require('express').Router()

// ─── Shared Auth ───────────────────────────────────────────────────────────────
const authRoutes = require('./authRoutes')              // POST /auth/register, POST /auth/login
router.use('/auth', authRoutes)

// const userRoutes = require('./userRoutes')           // GET  /users?role=field_crew (crew list)
// router.use('/users', userRoutes)

// ─── Zheng Bao: Customer Intake & Booking Management ──────────────────────────
// const intakeRoutes = require('./intakeRoutes')
// router.use('/intake-submissions', intakeRoutes)

// TEMPORARY (Jasper, 2026-07-02): read-only GET /my-jobs and GET /:id only, to unblock
// Liang Yi's "My Jobs" screen. Zheng Bao owns this file - reconcile/replace when his
// full booking management routes (POST /, PATCH /:id/status, crew assignment) land.
const bookingRoutes = require('./bookingRoutes')
router.use('/bookings', bookingRoutes)

// ─── Liang Yi: Field Operations & Executive Dashboard (implemented by Jasper - see README) ────
const serviceMemoRoutes = require('./serviceMemoRoutes')
router.use('/service-memos', serviceMemoRoutes)

const dashboardRoutes = require('./dashboardRoutes')
router.use('/dashboard', dashboardRoutes)

// ─── Jasper: AR Billing, Pricing Engine & Invoice Sync ────────────────────────
// const pricingContractRoutes = require('./pricingContractRoutes')
// router.use('/pricing-contracts', pricingContractRoutes)

// const invoiceRoutes = require('./invoiceRoutes')
// router.use('/invoices', invoiceRoutes)

// ─── Kwan Hua: Xero Foundation, OCR & AP Processing ──────────────────────────
// const xeroRoutes = require('./xeroRoutes')
// router.use('/xero', xeroRoutes)

// const vendorInvoiceRoutes = require('./vendorInvoiceRoutes')
// router.use('/vendor-invoices', vendorInvoiceRoutes)

// const vendorInvoiceItemRoutes = require('./vendorInvoiceItemRoutes')
// router.use('/vendor-invoice-items', vendorInvoiceItemRoutes)

module.exports = router
