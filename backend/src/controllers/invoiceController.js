// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper (design/jasper/).
const { Op } = require('sequelize')
const {
  Invoice, InvoiceLineItem, Booking, Client, ServiceMemo, PricingContract, User, XeroSyncLog,
} = require('../models')
const { xeroService } = require('../services')
const notificationService = require('../services/notificationService')
const { getFreshConnection } = require('./xeroController')
const { success, created, error, notFound } = require('../utils')

const round2 = (n) => Math.round(n * 100) / 100
const VALID_STATUSES = ['matched', 'adjusted', 'approved', 'synced_to_xero', 'failed', 'unmatched']
const LOCKED_STATUSES = ['approved', 'synced_to_xero']

// Recomputes subtotal/total from the current line items and persists it.
async function recalcInvoiceTotals(invoice) {
  const items = await InvoiceLineItem.findAll({ where: { invoice_id: invoice.id } })
  const subtotal = round2(items.reduce((sum, li) => sum + Number(li.amount), 0))
  const total = round2(subtotal + Number(invoice.tax_amount || 0))
  await invoice.update({ subtotal, total_amount: total })
  return { subtotal, total_amount: total }
}

// GET /api/invoices - UC-05/06/10: filterable AR invoice queue.
async function listInvoices(req, res) {
  try {
    const { status, client_id, from_date, to_date, page = 1, limit = 20 } = req.query
    if (status && !VALID_STATUSES.includes(status)) {
      return error(res, `status must be one of: ${VALID_STATUSES.join(', ')}`, 'INVALID_STATUS', 400)
    }
    const p = Number(page)
    const l = Number(limit)

    const where = {}
    if (status) where.status = status
    if (client_id) where.client_id = client_id
    if (from_date || to_date) {
      where.created_at = {}
      if (from_date) where.created_at[Op.gte] = from_date
      if (to_date) where.created_at[Op.lte] = to_date
    }

    const { rows, count } = await Invoice.findAndCountAll({
      where,
      include: [
        { model: Booking, attributes: ['reference_number'] },
        { model: Client, attributes: ['name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: l,
      offset: (p - 1) * l,
      distinct: true,
    })

    return success(res, {
      data: rows.map((inv) => ({
        id: inv.id,
        booking_reference: inv.Booking ? inv.Booking.reference_number : null,
        client_name: inv.Client ? inv.Client.name : null,
        memo_id: inv.memo_id,
        subtotal: inv.subtotal,
        tax_amount: inv.tax_amount,
        total_amount: inv.total_amount,
        status: inv.status,
        xero_invoice_id: inv.xero_invoice_id,
        approved_at: inv.approved_at,
        created_at: inv.created_at,
      })),
      meta: { total: count, page: p, limit: l },
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// GET /api/invoices/:id - UC-05: single invoice with all line items.
async function getInvoiceById(req, res) {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        { model: Booking, attributes: ['id', 'reference_number'] },
        { model: Client, attributes: ['id', 'name'] },
        { model: PricingContract, attributes: ['id', 'contract_name'] },
        { model: User, as: 'approvedBy', attributes: ['id', 'name'] },
        { model: InvoiceLineItem },
      ],
    })
    if (!invoice) return notFound(res, 'No invoice with this id.')

    const items = await InvoiceLineItem.findAll({ where: { invoice_id: invoice.id }, order: [['id', 'ASC']] })
    return success(res, {
      id: invoice.id,
      booking_id: invoice.booking_id,
      booking_reference: invoice.Booking ? invoice.Booking.reference_number : null,
      memo_id: invoice.memo_id,
      client_id: invoice.client_id,
      client_name: invoice.Client ? invoice.Client.name : null,
      contract_id: invoice.contract_id,
      contract_name: invoice.PricingContract ? invoice.PricingContract.contract_name : null,
      subtotal: invoice.subtotal,
      tax_amount: invoice.tax_amount,
      total_amount: invoice.total_amount,
      status: invoice.status,
      xero_invoice_id: invoice.xero_invoice_id,
      approved_by: invoice.approvedBy ? { id: invoice.approvedBy.id, name: invoice.approvedBy.name } : null,
      approved_at: invoice.approved_at,
      created_at: invoice.created_at,
      updated_at: invoice.updated_at,
      line_items: items.map((li) => ({
        id: li.id,
        description: li.description,
        quantity: li.quantity,
        unit_price: li.unit_price,
        amount: li.amount,
        is_manual_adjustment: li.is_manual_adjustment,
      })),
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// POST /api/invoices/:invoiceId/line-items - UC-05: add a manual adjustment line item.
async function addLineItem(req, res) {
  try {
    const invoice = await Invoice.findByPk(req.params.invoiceId)
    if (!invoice) return notFound(res, 'No invoice with this id.')
    if (LOCKED_STATUSES.includes(invoice.status)) {
      return error(res, 'Invoice is in `approved` or `synced_to_xero` status - edits not permitted.', 'INVOICE_LOCKED', 409)
    }

    const { description, quantity, unit_price } = req.body
    const qty = Number(quantity)
    const price = Number(unit_price)
    if (!description || !description.trim() || !(qty > 0) || !(price > 0)) {
      return error(res, '`description` is required and `quantity`/`unit_price` must be positive numbers.', 'VALIDATION_ERROR', 400)
    }

    const item = await InvoiceLineItem.create({
      invoice_id: invoice.id,
      description: description.trim(),
      quantity: round2(qty),
      unit_price: round2(price),
      amount: round2(qty * price),
      is_manual_adjustment: true,
    })

    // Adding a manual adjustment moves a matched OR unmatched invoice to 'adjusted' -
    // otherwise an unmatched invoice (no rate row / no contract) could never leave that
    // status even after Sarah manually prices it, and would never become approvable.
    if (['matched', 'unmatched'].includes(invoice.status)) await invoice.update({ status: 'adjusted' })
    const totals = await recalcInvoiceTotals(invoice)

    return created(res, {
      data: {
        id: item.id,
        invoice_id: item.invoice_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        is_manual_adjustment: item.is_manual_adjustment,
      },
      invoice: { id: invoice.id, subtotal: totals.subtotal, total_amount: totals.total_amount, status: invoice.status },
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// PUT /api/invoices/:invoiceId/line-items/:itemId - UC-05: edit a line item + recalc.
async function updateLineItem(req, res) {
  try {
    const invoice = await Invoice.findByPk(req.params.invoiceId)
    if (!invoice) return notFound(res, 'No invoice with this id.')
    if (LOCKED_STATUSES.includes(invoice.status)) {
      return error(res, 'Invoice is in `approved` or `synced_to_xero` status.', 'INVOICE_LOCKED', 409)
    }

    const item = await InvoiceLineItem.findOne({ where: { id: req.params.itemId, invoice_id: invoice.id } })
    if (!item) return notFound(res, 'No line item with this id on this invoice.')

    const { description, quantity, unit_price } = req.body
    if (quantity !== undefined && Number(quantity) < 0) return error(res, 'Negative quantity is not allowed.', 'VALIDATION_ERROR', 400)
    if (unit_price !== undefined && Number(unit_price) < 0) return error(res, 'Negative unit_price is not allowed.', 'VALIDATION_ERROR', 400)

    const updates = {}
    if (description !== undefined) updates.description = description
    if (quantity !== undefined) updates.quantity = round2(Number(quantity))
    if (unit_price !== undefined) updates.unit_price = round2(Number(unit_price))
    const newQty = updates.quantity !== undefined ? updates.quantity : Number(item.quantity)
    const newPrice = updates.unit_price !== undefined ? updates.unit_price : Number(item.unit_price)
    updates.amount = round2(newQty * newPrice)
    await item.update(updates)

    if (['matched', 'unmatched'].includes(invoice.status)) await invoice.update({ status: 'adjusted' })
    const totals = await recalcInvoiceTotals(invoice)

    return success(res, {
      data: {
        id: item.id,
        invoice_id: item.invoice_id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.amount,
        is_manual_adjustment: item.is_manual_adjustment,
      },
      invoice: { id: invoice.id, subtotal: totals.subtotal, total_amount: totals.total_amount, status: invoice.status },
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// DELETE /api/invoices/:invoiceId/line-items/:itemId - UC-05: only manual items deletable.
async function deleteLineItem(req, res) {
  try {
    const invoice = await Invoice.findByPk(req.params.invoiceId)
    if (!invoice) return notFound(res, 'No invoice with this id.')
    if (LOCKED_STATUSES.includes(invoice.status)) {
      return error(res, 'Invoice is in `approved` or `synced_to_xero` status.', 'INVOICE_LOCKED', 409)
    }

    const item = await InvoiceLineItem.findOne({ where: { id: req.params.itemId, invoice_id: invoice.id } })
    if (!item) return notFound(res, 'No line item with this id on this invoice.')
    if (!item.is_manual_adjustment) {
      return error(res, 'Line item was engine-generated (`is_manual_adjustment = false`) - deletion not permitted.', 'SYSTEM_LINE_ITEM', 403)
    }

    await item.destroy()
    const totals = await recalcInvoiceTotals(invoice)
    return success(res, {
      message: 'Line item deleted.',
      invoice: { id: invoice.id, subtotal: totals.subtotal, total_amount: totals.total_amount, status: invoice.status },
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// Pushes one approved invoice to Xero, logging the attempt in xero_sync_logs
// (entity_type 'ar_invoice'). On success advances the booking to 'invoiced' and the
// memo to 'invoiced'. Returns the outcome; never throws for expected Xero errors.
async function syncInvoiceToXero(invoice, connection) {
  const client = await Client.findByPk(invoice.client_id, { attributes: ['name'] })
  const items = await InvoiceLineItem.findAll({ where: { invoice_id: invoice.id } })
  const result = await xeroService.pushArInvoice(
    { id: invoice.id, client_name: client ? client.name : null, total_amount: invoice.total_amount, InvoiceLineItems: items },
    connection
  )

  if (result.ok) {
    await invoice.update({ status: 'synced_to_xero', xero_invoice_id: result.xeroRecordId })
    await XeroSyncLog.create({
      entity_type: 'ar_invoice', entity_id: invoice.id, xero_record_id: result.xeroRecordId,
      status: 'success', attempt_count: 1, synced_at: new Date(),
    })
    // Advance the operational records now that billing is in Xero.
    await Booking.update({ status: 'invoiced' }, { where: { id: invoice.booking_id, status: 'completed' } })
    await ServiceMemo.update({ status: 'invoiced' }, { where: { id: invoice.memo_id } })
    return { ok: true, xeroRecordId: result.xeroRecordId }
  }

  await invoice.update({ status: 'failed' })
  await XeroSyncLog.create({
    entity_type: 'ar_invoice', entity_id: invoice.id, status: 'failed', attempt_count: 1, error_message: result.error,
  })
  notificationService.create({
    user_id: invoice.approved_by || null,
    type: 'xero_sync_failed',
    title: `Xero sync failed for invoice #${invoice.id}`,
    body: result.error,
    link: '/xero/sync-status',
  })
  return { ok: false, error: result.error }
}

// POST /api/invoices/batch-approve - UC-06: approve matched/adjusted invoices and push
// each to Xero. Others in the array are skipped and reported.
async function batchApprove(req, res) {
  try {
    const { invoice_ids } = req.body
    if (!Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return error(res, '`invoice_ids` must be a non-empty array.', 'VALIDATION_ERROR', 400)
    }

    const conn = await getFreshConnection()
    if (!conn) return error(res, 'Xero is not connected. Ask the Managing Director to reconnect before approving.', 'XERO_NOT_CONNECTED', 503)

    const approved = []
    const skipped = []
    const queued_for_xero = []

    for (const id of invoice_ids) {
      const invoice = await Invoice.findByPk(id)
      if (!invoice || !['matched', 'adjusted'].includes(invoice.status)) {
        skipped.push(id)
        continue
      }
      await invoice.update({ status: 'approved', approved_by: req.user.sub, approved_at: new Date() })
      approved.push(id)
      const result = await syncInvoiceToXero(invoice, conn)
      if (result.ok) queued_for_xero.push(id)
    }

    return success(res, { approved, skipped, queued_for_xero })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// POST /api/invoices/:id/retry-xero - UC-07 alt / UC-10: retry a failed Xero push.
async function retryXero(req, res) {
  try {
    const invoice = await Invoice.findByPk(req.params.id)
    if (!invoice) return notFound(res, 'No invoice with this id.')
    if (invoice.status !== 'failed') {
      return error(res, 'Invoice is not in `failed` status - retry not applicable.', 'INVOICE_NOT_FAILED', 409)
    }

    const conn = await getFreshConnection()
    if (!conn) return error(res, 'Xero is not connected. Ask the Managing Director to reconnect before retrying.', 'XERO_NOT_CONNECTED', 503)

    const result = await syncInvoiceToXero(invoice, conn)
    if (!result.ok) {
      return error(res, `Xero rejected the push: ${result.error}`, 'XERO_SYNC_ERROR', 502)
    }

    return success(res, {
      invoice_id: invoice.id,
      status: 'synced_to_xero',
      xero_invoice_id: result.xeroRecordId,
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

module.exports = {
  recalcInvoiceTotals,
  listInvoices,
  getInvoiceById,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  batchApprove,
  retryXero,
}
