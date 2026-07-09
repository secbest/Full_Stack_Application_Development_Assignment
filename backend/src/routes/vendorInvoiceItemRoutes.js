const router = require('express').Router()
const { authenticate, authorise } = require('../middleware')
const { updateVendorInvoiceItem } = require('../controllers/vendorInvoiceItemController')

// UC-06: correct a single OCR-extracted line item in the AP review panel.
router.patch('/:id', authenticate, authorise('ap_specialist'), updateVendorInvoiceItem)

module.exports = router
