// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper (design/jasper/).
const { Op } = require('sequelize')
const sequelize = require('../config')
const {
  Invoice, InvoiceLineItem, Booking, Client, ServiceMemo, PricingContract, PricingRate,
  SurchargeSchedule, User, XeroSyncLog,
} = require('../models')
const { xeroService, pricingService, gstService } = require('../services')
const { findActiveContract } = require('../services/activeContractService')
const notificationService = require('../services/notificationService')
const { getFreshConnection } = require('./xeroController')
const { success, created, error, notFound } = require('../utils')

const round2 = (n) => Math.round(n * 100) / 100
const VALID_STATUSES = ['matched', 'adjusted', 'approved', 'synced_to_xero', 'failed', 'unmatched']
const LOCKED_STATUSES = ['approved', 'synced_to_xero']

// Realistic ceilings for a manual adjustment line so a fat-finger (e.g. an extra zero)
// can't be persisted. Unit price mirrors the pricing contract's MAX_RATE_AMOUNT; a
// single adjustment line rarely needs more than a handful of units. Mirrored in the
// frontend's InvoiceDetailPage add-adjustment form.
const MAX_LINE_ITEM_UNIT_PRICE = 50000
const MAX_LINE_ITEM_QUANTITY = 999

// Falls back to the AR Specialist when an invoice has no approved_by (e.g. retried
// after a status reset). Wrapped in its own try/catch, matching notificationService's
// own "never throw" contract - a failure resolving the fallback recipient must never
// turn a routine Xero-push failure into an unrelated 500 for whoever is retrying it.
async function resolveArSpecialistId() {
  try {
    const arSpecialist = await User.findOne({ where: { role: 'ar_specialist' } })
    return arSpecialist ? arSpecialist.id : null
  } catch (err) {
    console.error('[invoiceController] Failed to resolve the AR Specialist fallback for a Xero sync-failure notification:', err.message)
    return null
  }
}

// Upper bound on ?limit. Without one, `?limit=100000` makes the caller able to ask for the
// whole table in a single unpaginated query.
const MAX_PAGE_SIZE = 100

// created_at is a timestamp but to_date arrives as a bare 'YYYY-MM-DD', which compares
// against 00:00 on that day - so `to_date=today` used to exclude everything created today.
// Convert a date-only bound into the exclusive start of the following day.
function exclusiveEndOfDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null
  const next = new Date(`${value}T00:00:00.000Z`)
  next.setUTCDate(next.getUTCDate() + 1)
  return next
}

// Recomputes GST-exclusive subtotal, GST and total from the current line items using the
// rate frozen on the invoice. It never looks up the current rate, because doing so would
// rewrite an older invoice when a new GST period begins.
async function recalcInvoiceTotals(invoice) {
  if (invoice.gst_rate_percent === null || invoice.gst_rate_percent === undefined) {
    const err = new Error('This legacy invoice has no GST-rate snapshot. Run the GST migration before editing or approving it.')
    err.code = 'GST_RATE_NOT_SNAPSHOTTED'
    throw err
  }
  const items = await InvoiceLineItem.findAll({ where: { invoice_id: invoice.id } })
  const totals = gstService.calculateTotals(items, invoice.gst_rate_percent)
  await invoice.update(totals)
  return totals
}

// GET /api/invoices - UC-05/06/10: filterable AR invoice queue.
async function listInvoices(req, res) {
  try {
    const { status, client_id, from_date, to_date, page = 1, limit = 20 } = req.query
    if (status && !VALID_STATUSES.includes(status)) {
      return error(res, `status must be one of: ${VALID_STATUSES.join(', ')}`, 'INVALID_STATUS', 400)
    }
    const p = Math.max(1, Number(page) || 1)
    const l = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(limit) || 20))

    const where = {}
    if (status) where.status = status
    if (client_id) where.client_id = client_id
    if (from_date || to_date) {
      where.created_at = {}
      if (from_date) where.created_at[Op.gte] = from_date
      if (to_date) {
        // Inclusive of the whole end date - see exclusiveEndOfDay.
        const end = exclusiveEndOfDay(to_date)
        if (end) where.created_at[Op.lt] = end
        else where.created_at[Op.lte] = to_date
      }
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
        gst_rate_percent: inv.gst_rate_percent,
        gst_effective_date: inv.gst_effective_date,
        tax_amount: inv.tax_amount,
        total_amount: inv.total_amount,
        status: inv.status,
        xero_invoice_id: inv.xero_invoice_id,
        approved_at: inv.approved_at,
        created_at: inv.createdAt,
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
        { model: Booking, attributes: [
          'id', 'reference_number', 'scheduled_date', 'service_type', 'pricing_source',
          'pricing_contract_id', 'quoted_base_amount', 'quoted_transfer_type',
          'quoted_time_of_day', 'quoted_by', 'quoted_at',
        ] },
        { model: Client, attributes: ['id', 'name'] },
        { model: PricingContract, attributes: ['id', 'contract_name'] },
        { model: ServiceMemo, attributes: ['id', 'service_type', 'transfer_type', 'is_office_hours'] },
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
      pricing_source: invoice.Booking?.pricing_source || (invoice.contract_id ? 'legacy_contract' : null),
      quoted_base_amount: invoice.Booking?.quoted_base_amount || null,
      matching_requirements: invoice.ServiceMemo && invoice.Booking ? {
        reason: invoice.Booking.pricing_source
          && !pricingService.quotationMatchesMemo(invoice.Booking, invoice.ServiceMemo)
          ? 'quote_mismatch'
          : (invoice.contract_id ? 'missing_rate' : 'missing_contract'),
        service_date: invoice.Booking.scheduled_date,
        service_type: invoice.ServiceMemo.service_type,
        transfer_type: invoice.ServiceMemo.transfer_type,
        time_of_day: invoice.ServiceMemo.is_office_hours ? 'office_hours' : 'non_office_hours',
        quoted_service_type: invoice.Booking.service_type,
        quoted_transfer_type: invoice.Booking.quoted_transfer_type,
        quoted_time_of_day: invoice.Booking.quoted_time_of_day,
      } : null,
      subtotal: invoice.subtotal,
      gst_rate_percent: invoice.gst_rate_percent,
      gst_effective_date: invoice.gst_effective_date,
      xero_tax_type: invoice.xero_tax_type,
      tax_amount: invoice.tax_amount,
      total_amount: invoice.total_amount,
      status: invoice.status,
      xero_invoice_id: invoice.xero_invoice_id,
      unpriced_surcharges: invoice.unpriced_surcharges || [],
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
        was_manually_edited: li.was_manually_edited,
        engine_unit_price: li.engine_unit_price,
        engine_amount: li.engine_amount,
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
    if (qty > MAX_LINE_ITEM_QUANTITY) {
      return error(res, `\`quantity\` cannot exceed ${MAX_LINE_ITEM_QUANTITY}.`, 'VALIDATION_ERROR', 400)
    }
    if (price > MAX_LINE_ITEM_UNIT_PRICE) {
      return error(res, `\`unit_price\` cannot exceed ${MAX_LINE_ITEM_UNIT_PRICE}.`, 'VALIDATION_ERROR', 400)
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
        was_manually_edited: item.was_manually_edited,
        engine_unit_price: item.engine_unit_price,
        engine_amount: item.engine_amount,
      },
      invoice: { id: invoice.id, ...totals, status: invoice.status },
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
    if (quantity !== undefined && Number(quantity) > MAX_LINE_ITEM_QUANTITY) return error(res, `\`quantity\` cannot exceed ${MAX_LINE_ITEM_QUANTITY}.`, 'VALIDATION_ERROR', 400)
    if (unit_price !== undefined && Number(unit_price) > MAX_LINE_ITEM_UNIT_PRICE) return error(res, `\`unit_price\` cannot exceed ${MAX_LINE_ITEM_UNIT_PRICE}.`, 'VALIDATION_ERROR', 400)

    const updates = {}
    if (description !== undefined) updates.description = description
    if (quantity !== undefined) updates.quantity = round2(Number(quantity))
    if (unit_price !== undefined) updates.unit_price = round2(Number(unit_price))
    const newQty = updates.quantity !== undefined ? updates.quantity : Number(item.quantity)
    const newPrice = updates.unit_price !== undefined ? updates.unit_price : Number(item.unit_price)
    updates.amount = round2(newQty * newPrice)

    // An engine-generated row whose figures change stops being purely engine-derived, and
    // must stop presenting itself as such. Capture the engine's original numbers on the
    // first edit only, so repeated edits still compare against what the engine actually
    // produced rather than against the previous manual value.
    const figuresChanged = updates.amount !== Number(item.amount)
    if (!item.is_manual_adjustment && figuresChanged) {
      updates.was_manually_edited = true
      if (item.engine_unit_price === null || item.engine_unit_price === undefined) {
        updates.engine_unit_price = item.unit_price
        updates.engine_amount = item.amount
      }
    }

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
        was_manually_edited: item.was_manually_edited,
        engine_unit_price: item.engine_unit_price,
        engine_amount: item.engine_amount,
      },
      invoice: { id: invoice.id, ...totals, status: invoice.status },
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
      invoice: { id: invoice.id, ...totals, status: invoice.status },
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// The one sync-log row for an AR invoice, created on the first attempt and reused after.
//
// This deliberately does NOT create a row per attempt. Doing so meant every retry started a
// fresh log at attempt_count 1, so UC-08's "three attempts then stop" cap - which reads
// attempt_count off the log - could never be reached from this code path, and the Sync Status
// screen accumulated stale `failed` rows for invoices that had since synced successfully.
// One row per entity, incremented, keeps the attempt count and the screen truthful.
async function findOrCreateSyncLog(invoiceId) {
  const [log] = await XeroSyncLog.findOrCreate({
    where: { entity_type: 'ar_invoice', entity_id: invoiceId },
    defaults: { entity_type: 'ar_invoice', entity_id: invoiceId, status: 'pending', attempt_count: 0 },
  })
  return log
}

// Pushes one approved invoice to Xero, recording the attempt on the invoice's sync log
// (entity_type 'ar_invoice'). On success advances the booking to 'invoiced' and the
// memo to 'invoiced'. Returns the outcome; never throws for expected Xero errors.
async function syncInvoiceToXero(invoice, connection) {
  const client = await Client.findByPk(invoice.client_id, { attributes: ['name'] })
  const items = await InvoiceLineItem.findAll({ where: { invoice_id: invoice.id } })
  // Booking reference + service date travel with the push so the Xero record carries a
  // Reference and the date of service rather than arriving auto-numbered and stamped with
  // whenever the sync happened to run.
  const booking = invoice.booking_id
    ? await Booking.findByPk(invoice.booking_id, { attributes: ['reference_number', 'scheduled_date'] })
    : null

  // Already in Xero: never push a second time. Xero does not deduplicate ACCREC invoices,
  // so a re-entrant call (double-clicked Sync, a batch that includes an already-synced id)
  // would otherwise bill the client twice for one job.
  if (invoice.xero_invoice_id) {
    const existing = await findOrCreateSyncLog(invoice.id)
    await existing.update({ status: 'success', xero_record_id: invoice.xero_invoice_id, error_message: null, synced_at: existing.synced_at || new Date() })
    return { ok: true, xeroRecordId: invoice.xero_invoice_id, attempt_count: Number(existing.attempt_count || 0), alreadySynced: true }
  }

  const log = await findOrCreateSyncLog(invoice.id)
  const attempt_count = Number(log.attempt_count || 0) + 1

  const result = await xeroService.pushArInvoice(
    {
      id: invoice.id,
      client_name: client ? client.name : null,
      subtotal: invoice.subtotal,
      gst_rate_percent: invoice.gst_rate_percent,
      tax_amount: invoice.tax_amount,
      total_amount: invoice.total_amount,
      xero_tax_type: invoice.xero_tax_type,
      InvoiceLineItems: items,
      booking_reference: booking ? booking.reference_number : null,
      service_date: booking ? booking.scheduled_date : null,
    },
    connection
  )

  if (result.ok) {
    await invoice.update({ status: 'synced_to_xero', xero_invoice_id: result.xeroRecordId })
    await log.update({
      status: 'success', attempt_count, xero_record_id: result.xeroRecordId,
      error_message: null, synced_at: new Date(),
    })
    // Advance the operational records now that billing is in Xero.
    await Booking.update({ status: 'invoiced' }, { where: { id: invoice.booking_id, status: 'completed' } })
    await ServiceMemo.update({ status: 'invoiced' }, { where: { id: invoice.memo_id } })
    return { ok: true, xeroRecordId: result.xeroRecordId, attempt_count }
  }

  await invoice.update({ status: 'failed' })
  await log.update({ status: 'failed', attempt_count, error_message: result.error })
  const recipientId = invoice.approved_by || (await resolveArSpecialistId())
  if (recipientId) {
    notificationService.create({
      user_id: recipientId,
      type: 'xero_sync_failed',
      title: `Xero sync failed for invoice #${invoice.id}`,
      body: result.error,
      link: '/xero/sync-status',
    })
  }
  return { ok: false, error: result.error, attempt_count }
}

// POST /api/invoices/:id/rematch - rerun automatic pricing for an invoice that was
// created unmatched. This is the missing second half of the recovery instruction shown
// after memo approval: creating a contract or rate does not mutate an already-created
// invoice by itself, so AR needs an explicit, auditable action to try the engine again.
async function rematchInvoice(req, res) {
  try {
    const outcome = await sequelize.transaction(async (t) => {
      const invoice = await Invoice.findByPk(req.params.id, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      })
      if (!invoice) {
        return { error: { message: 'No invoice with this id.', code: 'NOT_FOUND', status: 404 } }
      }
      if (invoice.status !== 'unmatched') {
        return {
          error: {
            message: `Only an \`unmatched\` invoice can be matched again (this one is \`${invoice.status}\`).`,
            code: 'INVOICE_NOT_UNMATCHED',
            status: 409,
          },
        }
      }

      const [memo, booking, existingLineCount] = await Promise.all([
        ServiceMemo.findByPk(invoice.memo_id, { transaction: t }),
        Booking.findByPk(invoice.booking_id, { transaction: t }),
        InvoiceLineItem.count({ where: { invoice_id: invoice.id }, transaction: t }),
      ])
      if (!memo || !booking) {
        return {
          error: {
            message: 'The invoice is missing its source memo or booking and cannot be matched automatically.',
            code: 'INVOICE_SOURCE_MISSING',
            status: 409,
          },
        }
      }
      // An unmatched invoice normally has no line items. Refuse to replace unexpected
      // rows rather than silently deleting pricing work that may have been written by a
      // previous version or an administrator.
      if (existingLineCount > 0) {
        return {
          error: {
            message: 'This unmatched invoice already has line items. Remove or reconcile them before retrying automatic matching.',
            code: 'INVOICE_HAS_LINE_ITEMS',
            status: 409,
          },
        }
      }

      let contractId = null
      let result
      if (booking.pricing_source) {
        if (!pricingService.quotationMatchesMemo(booking, memo)) {
          return {
            error: {
              message: 'The completed service still does not match the combination approved by Quotations. Verify it and price the invoice manually.',
              code: 'QUOTATION_MISMATCH',
              status: 422,
            },
          }
        }
        contractId = booking.pricing_contract_id || null
        const surcharges = contractId
          ? await SurchargeSchedule.findAll({ where: { contract_id: contractId }, transaction: t })
          : []
        result = pricingService.computeQuotedInvoiceLineItems(booking, memo, surcharges)
      } else {
        // Legacy bookings created before Quotations captured an immutable price retain
        // the original contract-rematch path.
        const serviceDate = new Date(booking.scheduled_date)
        const contract = await findActiveContract(invoice.client_id, serviceDate, { transaction: t })
        if (!contract) {
          return {
            error: {
              message: 'No active pricing contract covers this client and service date yet.',
              code: 'NO_ACTIVE_CONTRACT',
              status: 422,
            },
          }
        }
        contractId = contract.id
        const [rates, surcharges] = await Promise.all([
          PricingRate.findAll({
            where: {
              contract_id: contract.id,
              service_type: memo.service_type,
              transfer_type: memo.transfer_type,
            },
            transaction: t,
          }),
          SurchargeSchedule.findAll({ where: { contract_id: contract.id }, transaction: t }),
        ])
        result = pricingService.computeInvoiceLineItems(memo, rates, surcharges)
        if (!result.matched) {
          return {
            error: {
              message: "The active contract still has no rate for this memo's service, transfer and time combination.",
              code: 'NO_MATCHING_RATE',
              status: 422,
            },
          }
        }
      }

      let gstSnapshot = {
        gst_rate_id: invoice.gst_rate_id,
        gst_rate_percent: invoice.gst_rate_percent === null || invoice.gst_rate_percent === undefined
          ? null
          : Number(invoice.gst_rate_percent),
        gst_effective_date: invoice.gst_effective_date,
        xero_tax_type: invoice.xero_tax_type,
      }
      if (gstSnapshot.gst_rate_percent === null) {
        gstSnapshot = await gstService.buildSnapshot(booking.scheduled_date, { transaction: t })
      }
      const totals = gstService.calculateTotals(result.lineItems, gstSnapshot.gst_rate_percent)

      await InvoiceLineItem.bulkCreate(
        result.lineItems.map((li) => ({ ...li, invoice_id: invoice.id })),
        { transaction: t }
      )
      await invoice.update({
        contract_id: contractId,
        ...gstSnapshot,
        ...totals,
        status: 'matched',
        unpriced_surcharges: result.unpriced,
      }, { transaction: t })

      return {
        invoice,
        warning: result.unpriced.length > 0
          ? {
              code: 'UNPRICED_SURCHARGES',
              message: `${result.unpriced.length} recorded charge${result.unpriced.length === 1 ? '' : 's'} still need manual pricing before approval.`,
            }
          : null,
      }
    })

    if (outcome.error) {
      return error(res, outcome.error.message, outcome.error.code, outcome.error.status)
    }

    const lineItems = await InvoiceLineItem.findAll({
      where: { invoice_id: outcome.invoice.id },
      order: [['id', 'ASC']],
    })
    return success(res, {
      invoice_id: outcome.invoice.id,
      status: outcome.invoice.status,
      contract_id: outcome.invoice.contract_id,
      subtotal: outcome.invoice.subtotal,
      gst_rate_percent: outcome.invoice.gst_rate_percent,
      gst_effective_date: outcome.invoice.gst_effective_date,
      tax_amount: outcome.invoice.tax_amount,
      total_amount: outcome.invoice.total_amount,
      unpriced_surcharges: outcome.invoice.unpriced_surcharges || [],
      line_items: lineItems,
      warning: outcome.warning,
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
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

    // Same cap as POST /api/xero/sync-logs/:id/retry. Both routes retry the same push, so
    // both must honour UC-08's attempt limit - otherwise retrying from this screen is an
    // unlimited loop around the ceiling the other screen enforces.
    const existingLog = await XeroSyncLog.findOne({ where: { entity_type: 'ar_invoice', entity_id: invoice.id } })
    if (existingLog && Number(existingLog.attempt_count) >= xeroService.MAX_SYNC_ATTEMPTS) {
      return error(
        res,
        `This invoice has failed to sync ${existingLog.attempt_count} times. Please contact support - this likely indicates a configuration issue in Xero.`,
        'RETRY_LIMIT_REACHED',
        409
      )
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
  rematchInvoice,
  addLineItem,
  updateLineItem,
  deleteLineItem,
  batchApprove,
  retryXero,
}
