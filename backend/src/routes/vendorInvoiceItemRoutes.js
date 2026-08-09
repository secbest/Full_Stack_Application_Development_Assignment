const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { vendorInvoiceItemUpdateSchema, idParamSchema } = require('../validators')
const { updateVendorInvoiceItem, deleteVendorInvoiceItem } = require('../controllers/vendorInvoiceItemController')

// UC-06: correct a single OCR-extracted line item in the AP review panel.
router.patch('/:id', authenticate, authorise('ap_specialist'), validate(idParamSchema, 'params'), validate(vendorInvoiceItemUpdateSchema), updateVendorInvoiceItem)
router.delete('/:id', authenticate, authorise('ap_specialist'), validate(idParamSchema, 'params'), deleteVendorInvoiceItem)

module.exports = router
