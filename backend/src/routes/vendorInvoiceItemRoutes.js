const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { vendorInvoiceItemUpdateSchema } = require('../validators')
const { updateVendorInvoiceItem, deleteVendorInvoiceItem } = require('../controllers/vendorInvoiceItemController')

// UC-06: correct a single OCR-extracted line item in the AP review panel.
router.patch('/:id', authenticate, authorise('ap_specialist'), validate(vendorInvoiceItemUpdateSchema), updateVendorInvoiceItem)
router.delete('/:id', authenticate, authorise('ap_specialist'), deleteVendorInvoiceItem)

module.exports = router
