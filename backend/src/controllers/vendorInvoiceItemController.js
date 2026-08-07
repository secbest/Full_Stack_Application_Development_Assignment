const { VendorInvoice, VendorInvoiceItem } = require('../models')
const sequelize = require('../config')
const { calculateRebate } = require('./vendorInvoiceController')
const { apInvoiceService, vendorInvoiceAuditService } = require('../services')
const { success, created, error, notFound, round2 } = require('../utils')

const EDITABLE_STATUSES = ['pending_review', 'extraction_failed']

async function recalculateParentInvoice(parent, transaction, { recoverExtractionFailure = false } = {}) {
  const items = await VendorInvoiceItem.findAll({
    where: { vendor_invoice_id: parent.id },
    transaction,
  })
  const subtotal = round2(items.reduce((sum, item) => sum + Number(item.amount), 0))
  const tax = apInvoiceService.calculateTax(items, Number(parent.gst_rate_percent || 0))
  const total = round2(subtotal + tax)
  const { rebateAmount, verifiedTotal } = calculateRebate(total, Number(parent.rebate_percentage))
  const recovered = recoverExtractionFailure && parent.status === 'extraction_failed' && items.length > 0

  await parent.update({
    subtotal_excluding_gst: subtotal,
    gst_amount: tax,
    total_including_gst: total,
    extracted_total: total,
    rebate_amount: rebateAmount,
    verified_total: verifiedTotal,
    ...(recovered ? { status: 'pending_review' } : {}),
  }, { transaction })

  return {
    id: parent.id,
    status: parent.status,
    extracted_total: total,
    subtotal_excluding_gst: subtotal,
    gst_amount: tax,
    total_including_gst: total,
    rebate_amount: rebateAmount,
    verified_total: verifiedTotal,
  }
}

// POST /api/vendor-invoices/:id/items - add a line when OCR omitted it or failed.
async function createVendorInvoiceItem(req, res) {
  try {
    const parent = await VendorInvoice.findByPk(req.params.id)
    if (!parent) return notFound(res, 'Vendor invoice not found.')
    if (!EDITABLE_STATUSES.includes(parent.status)) {
      return error(res, 'Line items cannot be added - parent invoice is not in an editable status', 'INVALID_STATUS', 409)
    }

    const quantity = Number(req.body.quantity)
    const unitPrice = Number(req.body.unit_price)
    const amount = round2(quantity * unitPrice)
    const previousStatus = parent.status
    let item
    let parentSummary

    await sequelize.transaction(async (transaction) => {
      item = await VendorInvoiceItem.create({
        vendor_invoice_id: parent.id,
        description: req.body.description,
        quantity,
        unit_price: unitPrice,
        amount,
      }, { transaction })
      parentSummary = await recalculateParentInvoice(parent, transaction, { recoverExtractionFailure: true })
      await vendorInvoiceAuditService.record({
        invoiceId: parent.id,
        userId: req.user?.sub || null,
        action: 'line_item_added',
        changes: {
          item_id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          ...(previousStatus !== parent.status ? { status: { from: previousStatus, to: parent.status } } : {}),
        },
        transaction,
      })
    })

    return created(res, {
      id: item.id,
      vendor_invoice_id: item.vendor_invoice_id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
      created_at: item.createdAt,
      parent_invoice: parentSummary,
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

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

    let parentSummary
    await sequelize.transaction(async (t) => {
      const before = {
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
      }
      await item.update(updates, { transaction: t })

      // AP line amounts are GST-exclusive. Recompute the full invoice so the amount
      // approved in EFAR is exactly the amount the exclusive Xero payload will create.
      parentSummary = await recalculateParentInvoice(parent, t, { recoverExtractionFailure: true })
      await vendorInvoiceAuditService.record({
        invoiceId: parent.id,
        userId: req.user?.sub || null,
        action: 'line_item_updated',
        changes: {
          item_id: item.id,
          ...vendorInvoiceAuditService.diff(before, item, ['description', 'quantity', 'unit_price', 'amount']),
        },
        transaction: t,
      })
    })

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

// DELETE /api/vendor-invoice-items/:id - remove an incorrect OCR/manual line.
async function deleteVendorInvoiceItem(req, res) {
  try {
    const item = await VendorInvoiceItem.findByPk(req.params.id, { include: [{ model: VendorInvoice }] })
    if (!item) return notFound(res, 'Invoice line item not found.')

    const parent = item.VendorInvoice
    if (!parent || !EDITABLE_STATUSES.includes(parent.status)) {
      return error(res, 'Line items cannot be deleted - parent invoice is not in an editable status', 'INVALID_STATUS', 409)
    }

    const deletedItem = {
      item_id: item.id,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
    }
    let parentSummary
    await sequelize.transaction(async (transaction) => {
      await item.destroy({ transaction })
      parentSummary = await recalculateParentInvoice(parent, transaction)
      await vendorInvoiceAuditService.record({
        invoiceId: parent.id,
        userId: req.user?.sub || null,
        action: 'line_item_deleted',
        changes: deletedItem,
        transaction,
      })
    })

    return success(res, { id: item.id, parent_invoice: parentSummary })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

module.exports = { createVendorInvoiceItem, updateVendorInvoiceItem, deleteVendorInvoiceItem }
