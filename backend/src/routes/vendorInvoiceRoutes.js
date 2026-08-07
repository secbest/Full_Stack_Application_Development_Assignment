const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { uploadPdf, uploadInboundPdfs } = require('../middleware/upload')
const { vendorInvoiceListQuerySchema, vendorInvoiceUpdateSchema, vendorInvoiceApproveSchema, vendorInvoiceReextractSchema, vendorInvoiceItemCreateSchema } = require('../validators')
const {
  uploadVendorInvoice,
  receiveInboundEmail,
  getInboundEmailSettings,
  listVendorInvoices,
  getVendorInvoiceById,
  updateVendorInvoice,
  approveVendorInvoice,
  rejectVendorInvoice,
  reextractVendorInvoice,
} = require('../controllers/vendorInvoiceController')
const { createVendorInvoiceItem } = require('../controllers/vendorInvoiceItemController')

// UC-03/04/05: upload + OCR + rebate
router.post('/', authenticate, authorise('ap_specialist'), uploadPdf('file'), uploadVendorInvoice)

// Automatic AP intake. Configure a mail provider to forward PDF attachments to this
// endpoint as the multipart field `attachments`, with message_id and X-AP-Inbound-Secret.
router.post('/inbound-email', uploadInboundPdfs(), receiveInboundEmail)

router.get('/intake-settings', authenticate, authorise('ap_specialist', 'managing_director'), getInboundEmailSettings)

// UC-06/07: review queue + detail
router.get('/', authenticate, authorise('ap_specialist', 'managing_director'), validate(vendorInvoiceListQuerySchema, 'query'), listVendorInvoices)
router.get('/:id', authenticate, authorise('ap_specialist', 'managing_director'), getVendorInvoiceById)
router.patch('/:id', authenticate, authorise('ap_specialist'), validate(vendorInvoiceUpdateSchema), updateVendorInvoice)
router.post('/:id/items', authenticate, authorise('ap_specialist'), validate(vendorInvoiceItemCreateSchema), createVendorInvoiceItem)
router.post('/:id/approve', authenticate, authorise('ap_specialist'), validate(vendorInvoiceApproveSchema), approveVendorInvoice)
router.post('/:id/reject', authenticate, authorise('ap_specialist'), rejectVendorInvoice)
router.post('/:id/reextract', authenticate, authorise('ap_specialist'), validate(vendorInvoiceReextractSchema), reextractVendorInvoice)

module.exports = router
