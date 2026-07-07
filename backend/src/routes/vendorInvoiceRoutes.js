const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { uploadPdf } = require('../middleware/upload')
const { vendorInvoiceListQuerySchema } = require('../validators')
const {
  uploadVendorInvoice,
  listVendorInvoices,
  getVendorInvoiceById,
  updateVendorInvoice,
  approveVendorInvoice,
  rejectVendorInvoice,
  reextractVendorInvoice,
} = require('../controllers/vendorInvoiceController')

// UC-03/04/05: upload + OCR + rebate
router.post('/', authenticate, authorise('ap_specialist'), uploadPdf('file'), uploadVendorInvoice)

// UC-06/07: review queue + detail
router.get('/', authenticate, authorise('ap_specialist', 'managing_director'), validate(vendorInvoiceListQuerySchema, 'query'), listVendorInvoices)
router.get('/:id', authenticate, authorise('ap_specialist', 'managing_director'), getVendorInvoiceById)
router.patch('/:id', authenticate, authorise('ap_specialist'), updateVendorInvoice)
router.post('/:id/approve', authenticate, authorise('ap_specialist'), approveVendorInvoice)
router.post('/:id/reject', authenticate, authorise('ap_specialist'), rejectVendorInvoice)
router.post('/:id/reextract', authenticate, authorise('ap_specialist'), reextractVendorInvoice)

module.exports = router
