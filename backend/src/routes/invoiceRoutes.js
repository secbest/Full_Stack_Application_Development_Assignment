// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper (design/jasper/).
const router = require('express').Router()
const { authenticate, authorise } = require('../middleware')
const {
  listInvoices,
  getInvoiceById,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  batchApprove,
  retryXero,
} = require('../controllers/invoiceController')

// Static routes first so they are not shadowed by '/:id'.
router.post('/batch-approve', authenticate, authorise('ar_specialist'), batchApprove)

router.get('/', authenticate, authorise('ar_specialist', 'managing_director'), listInvoices)
router.get('/:id', authenticate, authorise('ar_specialist', 'managing_director'), getInvoiceById)
router.post('/:id/retry-xero', authenticate, authorise('ar_specialist'), retryXero)

// Invoice line items (manual adjustments)
router.post('/:invoiceId/line-items', authenticate, authorise('ar_specialist'), addLineItem)
router.put('/:invoiceId/line-items/:itemId', authenticate, authorise('ar_specialist'), updateLineItem)
router.delete('/:invoiceId/line-items/:itemId', authenticate, authorise('ar_specialist'), deleteLineItem)

module.exports = router
