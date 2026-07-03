const router = require('express').Router()
const { authenticate, authorise } = require('../middleware')
const { uploadPdf } = require('../middleware/upload')
const { uploadVendorInvoice } = require('../controllers/vendorInvoiceController')

router.post('/', authenticate, authorise('ap_specialist'), uploadPdf('file'), uploadVendorInvoice)

// TODO (Wave 3): GET /, GET /:id, PATCH /:id, POST /:id/approve, POST /:id/reject,
// POST /:id/reextract - see design/kwan-hua/api-documentation.md

module.exports = router
