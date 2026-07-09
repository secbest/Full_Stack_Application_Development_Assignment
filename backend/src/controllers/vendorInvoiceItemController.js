const { VendorInvoice, VendorInvoiceItem } = require('../models')
const { calculateRebate } = require('./vendorInvoiceController')
const { success, error, notFound } = require('../utils')

const round2 = (n) => Math.round(n * 100) / 100
const EDITABLE_STATUSES = ['pending_review', 'extraction_failed']

// PATCH /api/vendor-invoice-items/:id - UC-06: correct one OCR-extracted line item.
// When amount changes, the parent invoice's extracted_total (and rebate) is recomputed
// from the sum of all its line items.
async function updateVendorInvoiceItem(req, res) {
  try {
    const item = await VendorInvoiceItem.findByPk(req.params.id, { include: [{ model: VendorInvoice }] })
    if (!item) return notFound(res, 'Invoice line item not found.')

    const parent = item.VendorInvoice
    if (!parent || !EDITABLE_STATUSES.includes(parent.status)) {
      return error(res, 'Line items cannot be edited - parent invoice is not in an editable status', 'INVALID_STATUS', 409)
    }

    const { description, quantity, unit_price, amount } = req.body
    if (amount !== undefined && !(Number(amount) > 0)) {
      return error(res, '`amount` must be a positive number', 'INVALID_AMOUNT', 400)
    }

    const updates = {}
    if (description !== undefined) updates.description = description
    if (quantity !== undefined) updates.quantity = quantity
    if (unit_price !== undefined) updates.unit_price = unit_price
    if (amount !== undefined) updates.amount = amount
    await item.update(updates)

    // Recompute the parent total from all line items when the amount changed.
    let parentSummary = {
      id: parent.id,
      extracted_total: parent.extracted_total,
      rebate_amount: parent.rebate_amount,
      verified_total: parent.verified_total,
    }
    if (amount !== undefined) {
      const items = await VendorInvoiceItem.findAll({ where: { vendor_invoice_id: parent.id } })
      const total = round2(items.reduce((sum, i) => sum + Number(i.amount), 0))
      const { rebateAmount, verifiedTotal } = calculateRebate(total, Number(parent.rebate_percentage))
      await parent.update({ extracted_total: total, rebate_amount: rebateAmount, verified_total: verifiedTotal })
      parentSummary = { id: parent.id, extracted_total: total, rebate_amount: rebateAmount, verified_total: verifiedTotal }
    }

    return success(res, {
      id: item.id,
      vendor_invoice_id: item.vendor_invoice_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      updated_at: item.updatedAt,
      parent_invoice: parentSummary,
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

module.exports = { updateVendorInvoiceItem }
