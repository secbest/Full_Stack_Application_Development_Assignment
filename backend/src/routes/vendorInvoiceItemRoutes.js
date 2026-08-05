const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { vendorInvoiceItemUpdateSchema } = require('../validators')
const { updateVendorInvoiceItem } = require('../controllers/vendorInvoiceItemController')

// UC-06: correct a single OCR-extracted line item in the AP review panel.
router.patch('/:id', authenticate, authorise('ap_specialist'), validate(vendorInvoiceItemUpdateSchema), updateVendorInvoiceItem)

module.exports = router
