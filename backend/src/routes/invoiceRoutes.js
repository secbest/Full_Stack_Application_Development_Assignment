// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper (design/jasper/).
const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { idParamSchema, invoiceIdOnlyParamSchema, invoiceLineItemParamSchema } = require('../validators')
const {
  listInvoices,
  getInvoiceById,
  rematchInvoice,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  batchApprove,
  retryXero,
} = require('../controllers/invoiceController')

// Static routes first so they are not shadowed by '/:id'.
router.post('/batch-approve', authenticate, authorise('ar_specialist'), batchApprove)

router.get('/', authenticate, authorise('ar_specialist', 'managing_director'), listInvoices)
router.get('/:id', authenticate, authorise('ar_specialist', 'managing_director'), validate(idParamSchema, 'params'), getInvoiceById)
router.post('/:id/rematch', authenticate, authorise('ar_specialist'), validate(idParamSchema, 'params'), rematchInvoice)
router.post('/:id/retry-xero', authenticate, authorise('ar_specialist'), validate(idParamSchema, 'params'), retryXero)

// Invoice line items (manual adjustments)
router.post('/:invoiceId/line-items', authenticate, authorise('ar_specialist'), validate(invoiceIdOnlyParamSchema, 'params'), addLineItem)
router.put('/:invoiceId/line-items/:itemId', authenticate, authorise('ar_specialist'), validate(invoiceLineItemParamSchema, 'params'), updateLineItem)
router.delete('/:invoiceId/line-items/:itemId', authenticate, authorise('ar_specialist'), validate(invoiceLineItemParamSchema, 'params'), deleteLineItem)

module.exports = router
