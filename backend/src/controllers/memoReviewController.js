// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper (design/jasper/).
const sequelize = require('../config')
const {
  ServiceMemo, MemoSignature, Booking, Client, User,
  PricingRate, SurchargeSchedule,
  Invoice, InvoiceLineItem,
} = require('../models')
const { pricingService, gstService } = require('../services')
const { findActiveContract } = require('../services/activeContractService')
const notificationService = require('../services/notificationService')
const { success, error, notFound } = require('../utils')

const HOURS = 1000 * 60 * 60

function approvalInvoicePayload(invoice, lineItems = []) {
  return {
    id: invoice.id,
    status: invoice.status,
    subtotal: invoice.subtotal,
    gst_rate_percent: invoice.gst_rate_percent,
    gst_effective_date: invoice.gst_effective_date,
    tax_amount: invoice.tax_amount,
    total_amount: invoice.total_amount,
    unpriced_surcharges: invoice.unpriced_surcharges || [],
    line_items: lineItems.map((li) => ({
      id: li.id,
      description: li.description,
      quantity: li.quantity,
      unit_price: li.unit_price,
      amount: li.amount,
      is_manual_adjustment: li.is_manual_adjustment,
      was_manually_edited: li.was_manually_edited,
    })),
  }
}

// GET /api/service-memos/pending-review - UC-03: memos submitted and awaiting AR review
// (status 'submitted', no invoice yet).
async function listPendingReview(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query
    const p = Math.max(1, Number(page) || 1)
    // Bounded so ?limit=100000 can't request the whole table in one unpaginated query.
    const l = Math.min(100, Math.max(1, Number(limit) || 20))

    const { rows, count } = await ServiceMemo.findAndCountAll({
      where: { status: 'submitted' },
      include: [{ model: Booking, include: [{ model: Client, attributes: ['id', 'name'] }] }],
      order: [['created_at', 'ASC']],
      limit: l,
      offset: (p - 1) * l,
      distinct: true,
    })

    const now = Date.now()
    return success(res, {
      data: rows.map((m) => {
        // Age the memo from its resubmission when it has been corrected, so time spent with
        // the crew isn't charged against Sarah's SLA.
        const queuedSince = m.resubmitted_at ? new Date(m.resubmitted_at) : new Date(m.createdAt)
        return {
          id: m.id,
          booking_id: m.booking_id,
          booking_reference: m.Booking ? m.Booking.reference_number : null,
          client_name: m.Booking && m.Booking.Client ? m.Booking.Client.name : null,
          job_date: m.Booking ? m.Booking.scheduled_date : null,
          service_type: m.service_type,
          transfer_type: m.transfer_type,
          submitted_at: m.createdAt,
          // Flags a memo that has been round-tripped at least once, so Sarah knows she is
          // looking at a correction she asked for rather than a first submission.
          was_returned: !!m.returned_at,
          resubmitted_at: m.resubmitted_at,
          queued_since: queuedSince,
          hours_since_submission: Math.round(((now - queuedSince.getTime()) / HOURS) * 10) / 10,
        }
      }),
      meta: { total: count, page: p, limit: l },
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// PATCH /api/service-memos/:id/approve - UC-03 -> UC-04: approve a memo and run the
// pricing engine in one transaction, generating the invoice + line items.
async function approveMemo(req, res) {
  try {
    const memo = await ServiceMemo.findByPk(req.params.id, {
      include: [{ model: Booking, include: [{ model: Client, attributes: ['id', 'name'] }] }],
    })
    if (!memo) return notFound(res, 'No memo with this id.')
    if (memo.status === 'returned') {
      return error(res, 'Memo was returned to the crew for correction and has not been resubmitted yet - it cannot be approved.', 'MEMO_RETURNED', 409)
    }
    if (memo.status !== 'submitted') {
      return error(res, 'Memo has already been approved or an invoice already exists for it.', 'MEMO_ALREADY_REVIEWED', 409)
    }
    const existingInvoice = await Invoice.findOne({ where: { memo_id: memo.id } })
    if (existingInvoice) {
      return error(res, 'Memo has already been approved or an invoice already exists for it.', 'MEMO_ALREADY_REVIEWED', 409)
    }

    const booking = memo.Booking
    const clientId = booking ? booking.client_id : null
    if (!booking || !booking.scheduled_date) {
      return error(res, 'The memo has no scheduled service date, so the applicable GST rate cannot be determined.', 'INVOICE_SOURCE_MISSING', 409)
    }

    let gstSnapshot
    try {
      // The service date is EFAR's default tax-date rule. The exact chosen date and rate
      // are frozen on the invoice so a future law change cannot rewrite this document.
      gstSnapshot = await gstService.buildSnapshot(booking.scheduled_date)
    } catch (gstErr) {
      if (['GST_RATE_NOT_CONFIGURED', 'INVALID_GST_DATE'].includes(gstErr.code)) {
        return error(res, gstErr.message, gstErr.code, 422)
      }
      throw gstErr
    }

    // New bookings carry the price approved by Quotations. Consume that immutable
    // snapshot before the legacy contract lookup so AR does not have to re-enter the
    // same amount. The memo must still match the sold service combination.
    if (booking.pricing_source) {
      if (!pricingService.quotationMatchesMemo(booking, memo)) {
        const { unpriced } = pricingService.computeInvoiceLineItems(memo, [], [])
        const invoice = await sequelize.transaction(async (t) => {
          await memo.update({ status: 'reviewed', reviewed_by: req.user.sub }, { transaction: t })
          return Invoice.create({
            memo_id: memo.id,
            booking_id: memo.booking_id,
            client_id: clientId,
            contract_id: booking.pricing_contract_id || null,
            ...gstSnapshot,
            subtotal: 0, tax_amount: 0, total_amount: 0,
            status: 'unmatched',
            unpriced_surcharges: unpriced,
          }, { transaction: t })
        })
        return success(res, {
          memo_id: memo.id,
          memo_status: 'reviewed',
          invoice: approvalInvoicePayload(invoice),
          warning: {
            code: 'QUOTATION_MISMATCH',
            message: `Invoice #${invoice.id} needs review because the completed service does not match the service combination approved by Quotations. Verify the completed service and price the invoice manually.`,
          },
        })
      }

      const quotedSurcharges = booking.pricing_contract_id
        ? await SurchargeSchedule.findAll({ where: { contract_id: booking.pricing_contract_id } })
        : []
      const quotedResult = pricingService.computeQuotedInvoiceLineItems(booking, memo, quotedSurcharges)
      const totals = gstService.calculateTotals(quotedResult.lineItems, gstSnapshot.gst_rate_percent)
      const invoice = await sequelize.transaction(async (t) => {
        await memo.update({ status: 'reviewed', reviewed_by: req.user.sub }, { transaction: t })
        const inv = await Invoice.create({
          memo_id: memo.id,
          booking_id: memo.booking_id,
          client_id: clientId,
          contract_id: booking.pricing_contract_id || null,
          ...gstSnapshot,
          ...totals,
          status: 'matched',
          unpriced_surcharges: quotedResult.unpriced,
        }, { transaction: t })
        await InvoiceLineItem.bulkCreate(
          quotedResult.lineItems.map((lineItem) => ({ ...lineItem, invoice_id: inv.id })),
          { transaction: t }
        )
        return inv
      })
      const lineItems = await InvoiceLineItem.findAll({ where: { invoice_id: invoice.id }, order: [['id', 'ASC']] })
      return success(res, {
        memo_id: memo.id,
        memo_status: 'reviewed',
        invoice: approvalInvoicePayload(invoice, lineItems),
        warning: quotedResult.unpriced.length > 0 ? {
          code: 'UNPRICED_SURCHARGES',
          message: `${quotedResult.unpriced.length} recorded charge${quotedResult.unpriced.length === 1 ? '' : 's'} still need manual pricing before approval.`,
        } : null,
      })
    }
    const contract = clientId ? await findActiveContract(clientId, booking ? new Date(booking.scheduled_date) : new Date()) : null

    // No active contract -> approval still succeeds, but the created invoice needs
    // attention. This used to return 422 after committing both writes, which made the
    // frontend report a successful approval as a failure and discarded the new invoice
    // id that the AR Specialist needed in order to recover.
    if (!contract) {
      // No contract means nothing could be priced, so everything chargeable on the memo is
      // recorded as unpriced - that list is what Sarah works through to price it by hand.
      const { unpriced } = pricingService.computeInvoiceLineItems(memo, [], [])
      const invoice = await sequelize.transaction(async (t) => {
        await memo.update({ status: 'reviewed', reviewed_by: req.user.sub }, { transaction: t })
        return Invoice.create({
          memo_id: memo.id,
          booking_id: memo.booking_id,
          client_id: clientId,
          contract_id: null,
          ...gstSnapshot,
          subtotal: 0, tax_amount: 0, total_amount: 0,
          status: 'unmatched',
          unpriced_surcharges: unpriced,
        }, { transaction: t })
      })
      return success(res, {
        memo_id: memo.id,
        memo_status: 'reviewed',
        invoice: approvalInvoicePayload(invoice),
        warning: {
          code: 'NO_ACTIVE_CONTRACT',
          message: `Invoice #${invoice.id} needs pricing because no active contract covers this client's service date. Create or activate the contract, then retry matching from the invoice; alternatively, price every charge manually.`,
        },
      })
    }

    const rates = await PricingRate.findAll({
      where: { contract_id: contract.id, service_type: memo.service_type, transfer_type: memo.transfer_type },
    })
    const surcharges = await SurchargeSchedule.findAll({ where: { contract_id: contract.id } })

    const result = pricingService.computeInvoiceLineItems(memo, rates, surcharges)

    // Active contract but no matching rate row -> the approval succeeded and an
    // actionable unmatched invoice was created, so return it as a warning-bearing
    // success for the same reason as the no-contract branch above.
    if (!result.matched) {
      const invoice = await sequelize.transaction(async (t) => {
        await memo.update({ status: 'reviewed', reviewed_by: req.user.sub }, { transaction: t })
        return Invoice.create({
          memo_id: memo.id,
          booking_id: memo.booking_id,
          client_id: clientId,
          contract_id: contract.id,
          ...gstSnapshot,
          subtotal: 0, tax_amount: 0, total_amount: 0,
          status: 'unmatched',
          unpriced_surcharges: result.unpriced,
        }, { transaction: t })
      })
      return success(res, {
        memo_id: memo.id,
        memo_status: 'reviewed',
        invoice: approvalInvoicePayload(invoice),
        warning: {
          code: 'NO_MATCHING_RATE',
          message: `Invoice #${invoice.id} needs pricing because the active contract has no rate for this service, transfer and time combination. Add the rate, then retry matching from the invoice; alternatively, price every charge manually.`,
        },
      })
    }

    const totals = gstService.calculateTotals(result.lineItems, gstSnapshot.gst_rate_percent)
    const invoice = await sequelize.transaction(async (t) => {
      await memo.update({ status: 'reviewed', reviewed_by: req.user.sub }, { transaction: t })
      const inv = await Invoice.create({
        memo_id: memo.id,
        booking_id: memo.booking_id,
        client_id: clientId,
        contract_id: contract.id,
        ...gstSnapshot,
        ...totals,
        status: 'matched',
        unpriced_surcharges: result.unpriced,
      }, { transaction: t })

      await InvoiceLineItem.bulkCreate(
        result.lineItems.map((li) => ({ ...li, invoice_id: inv.id })),
        { transaction: t }
      )
      return inv
    })

    const lineItems = await InvoiceLineItem.findAll({ where: { invoice_id: invoice.id }, order: [['id', 'ASC']] })
    return success(res, {
      memo_id: memo.id,
      memo_status: 'reviewed',
      invoice: approvalInvoicePayload(invoice, lineItems),
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// PATCH /api/service-memos/:id/return - UC-03 alt flow: return the memo to the crew
// with a correction note. Status becomes 'returned' so the memo leaves the AR review
// queue until the crew resubmits it.
async function returnMemo(req, res) {
  try {
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : ''
    if (!note) return error(res, '`note` is required to return a memo.', 'VALIDATION_ERROR', 400)

    const memo = await ServiceMemo.findByPk(req.params.id)
    if (!memo) return notFound(res, 'No memo with this id.')

    // Any existing invoice blocks the return, not just an approved/synced one. Returning a
    // memo that already has a 'matched' invoice used to strand it permanently: the memo went
    // back to the crew while its invoice lived on, and re-approving then failed because an
    // invoice already existed, leaving no available action on either record. Reject the
    // return instead and make the resolution explicit.
    const invoice = await Invoice.findOne({ where: { memo_id: memo.id } })
    if (invoice) {
      const isLocked = ['approved', 'synced_to_xero'].includes(invoice.status)
      return error(
        res,
        isLocked
          ? `Memo is linked to invoice #${invoice.id}, which has already been ${invoice.status === 'approved' ? 'approved' : 'synced to Xero'} - it cannot be returned. Raise a credit note in Xero instead.`
          : `Memo has already been approved and generated invoice #${invoice.id} - it cannot be returned. Adjust the invoice's line items directly, or reject the match on invoice #${invoice.id} first.`,
        'MEMO_ALREADY_INVOICED',
        409
      )
    }

    if (memo.status === 'returned') {
      return error(res, 'Memo has already been returned to the crew and is awaiting their correction.', 'MEMO_ALREADY_RETURNED', 409)
    }
    if (memo.status !== 'submitted') {
      return error(res, `Only a memo in \`submitted\` status can be returned (this one is \`${memo.status}\`).`, 'MEMO_NOT_SUBMITTED', 409)
    }

    await memo.update({
      status: 'returned',
      ar_note: note,
      reviewed_by: req.user.sub,
      returned_at: new Date(),
    })

    if (memo.submitted_by) {
      notificationService.create({
        user_id: memo.submitted_by,
        type: 'memo_returned',
        title: 'A service memo was returned for correction',
        body: note,
        link: '/memos/history',
      })
    }

    return success(res, { memo_id: memo.id, memo_status: 'returned', note_recorded: true })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// PATCH /api/service-memos/:id/resubmit - the other half of the return loop. The crew
// corrects the billing-relevant fields AR flagged and pushes the memo back into the review
// queue. Without this a returned memo had no route forward at all: memos are created once
// per booking (unique booking_id) and there is no memo-update endpoint, so the crew could
// read the correction note and do nothing about it.
async function resubmitMemo(req, res) {
  try {
    const memo = await ServiceMemo.findByPk(req.params.id)
    if (!memo) return notFound(res, 'No memo with this id.')

    // Field crew may only resubmit their own memos. Same 404 as elsewhere so a crew member
    // can't probe which memo ids exist.
    if (req.user.role === 'field_crew' && memo.submitted_by !== req.user.sub) {
      return notFound(res, 'No memo with this id.')
    }
    if (memo.status !== 'returned') {
      return error(res, `Only a memo in \`returned\` status can be resubmitted (this one is \`${memo.status}\`).`, 'MEMO_NOT_RETURNED', 409)
    }

    // Only the fields that drive pricing are correctable here. Identity fields
    // (booking_id, submitted_by) and the signature are deliberately not editable - a
    // correction is a re-statement of what happened on the job, not a new memo.
    const CORRECTABLE = [
      'job_start_time', 'job_end_time', 'overtime_hours', 'evacuation_floors',
      'patient_name', 'hospital_destination', 'additional_charges_notes',
      'hospital_stamp_image_url', 'service_type', 'transfer_type', 'is_office_hours',
      'oxygen_litres_used', 'has_inconvenience_fee', 'disposables_used',
      'resuscitation_performed', 'suction_performed', 'waiting_time_minutes',
      'patient_weight_kg', 'is_jurong_island',
    ]
    const updates = {}
    for (const field of CORRECTABLE) {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    }

    await memo.update({
      ...updates,
      status: 'submitted',
      // The correction note has been acted on; clearing it keeps the crew's Memo History
      // showing a note only while a correction is actually outstanding. returned_at is
      // retained as the audit record that this memo was bounced once.
      ar_note: null,
      resubmitted_at: new Date(),
    })

    // The memo update is already committed. Notification lookup/delivery is best-effort
    // and must not turn a successful correction into a misleading 500 response.
    try {
      const arSpecialist = await User.findOne({ where: { role: 'ar_specialist' } })
      if (arSpecialist) {
        await notificationService.create({
          user_id: arSpecialist.id,
          type: 'memo_submitted',
          title: 'A returned service memo was corrected and resubmitted',
          body: `Memo #${memo.id} is back in the review queue.`,
          link: '/service-memos',
        })
      }
    } catch (notifyErr) {
      console.error('[resubmitMemo] Failed to notify the AR Specialist:', notifyErr.message)
    }

    return success(res, {
      memo_id: memo.id,
      memo_status: 'submitted',
      fields_updated: Object.keys(updates),
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

module.exports = { findActiveContract, listPendingReview, approveMemo, returnMemo, resubmitMemo }
