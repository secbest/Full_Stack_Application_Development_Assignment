const { VendorInvoice, VendorInvoiceItem } = require('../models')
const { calculateRebate } = require('./vendorInvoiceController')
const { success, error, notFound, round2 } = require('../utils')

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

    // `amount` is never taken from the request (the validator strips it): it is derived
    // from the line's own figures. Persisting a client-supplied amount let a line item
    // claim a total its quantity and unit price did not support - qty 2 x $10 could be
    // stored as $999, and that $999 then became the invoice's extracted_total.
    const { description, quantity, unit_price } = req.body

    const updates = {}
    if (description !== undefined) updates.description = description
    if (quantity !== undefined) updates.quantity = quantity
    if (unit_price !== undefined) updates.unit_price = unit_price

    // Recompute this line's amount whenever either factor moves. Previously the parent
    // total was only refreshed when `amount` was supplied, so editing unit_price alone
    // left both the line's amount and the invoice total stale.
    const newQuantity = quantity !== undefined ? Number(quantity) : Number(item.quantity)
    const newUnitPrice = unit_price !== undefined ? Number(unit_price) : Number(item.unit_price)
    updates.amount = round2(newQuantity * newUnitPrice)

    await item.update(updates)

    // The parent's extracted_total is the sum of its line items, so it is recomputed on
    // every line edit - not just the ones that happened to send an amount.
    const items = await VendorInvoiceItem.findAll({ where: { vendor_invoice_id: parent.id } })
    const total = round2(items.reduce((sum, i) => sum + Number(i.amount), 0))
    const { rebateAmount, verifiedTotal } = calculateRebate(total, Number(parent.rebate_percentage))
    await parent.update({ extracted_total: total, rebate_amount: rebateAmount, verified_total: verifiedTotal })
    const parentSummary = { id: parent.id, extracted_total: total, rebate_amount: rebateAmount, verified_total: verifiedTotal }

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
