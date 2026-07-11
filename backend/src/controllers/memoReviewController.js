// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper (design/jasper/).
const sequelize = require('../config')
const { Op } = require('sequelize')
const {
  ServiceMemo, MemoSignature, Booking, Client, User,
  PricingContract, PricingRate, SurchargeSchedule,
  Invoice, InvoiceLineItem,
} = require('../models')
const { pricingService } = require('../services')
const notificationService = require('../services/notificationService')
const { success, error, notFound } = require('../utils')

const HOURS = 1000 * 60 * 60

// Finds the client's contract that is active for a given date (defaults to today).
async function findActiveContract(clientId, onDate = new Date()) {
  const day = onDate.toISOString().slice(0, 10)
  return PricingContract.findOne({
    where: {
      client_id: clientId,
      is_active: true,
      effective_from: { [Op.lte]: day },
      effective_to: { [Op.gte]: day },
    },
    order: [['effective_from', 'DESC']],
  })
}

// GET /api/service-memos/pending-review - UC-03: memos submitted and awaiting AR review
// (status 'submitted', no invoice yet).
async function listPendingReview(req, res) {
  try {
    const { page = 1, limit = 20 } = req.query
    const p = Number(page)
    const l = Number(limit)

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
      data: rows.map((m) => ({
        id: m.id,
        booking_id: m.booking_id,
        booking_reference: m.Booking ? m.Booking.reference_number : null,
        client_name: m.Booking && m.Booking.Client ? m.Booking.Client.name : null,
        job_date: m.Booking ? m.Booking.scheduled_date : null,
        service_type: m.service_type,
        transfer_type: m.transfer_type,
        submitted_at: m.createdAt,
        hours_since_submission: Math.round(((now - new Date(m.createdAt).getTime()) / HOURS) * 10) / 10,
      })),
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
    if (memo.status !== 'submitted') {
      return error(res, 'Memo has already been approved or an invoice already exists for it.', 'MEMO_ALREADY_REVIEWED', 409)
    }
    const existingInvoice = await Invoice.findOne({ where: { memo_id: memo.id } })
    if (existingInvoice) {
      return error(res, 'Memo has already been approved or an invoice already exists for it.', 'MEMO_ALREADY_REVIEWED', 409)
    }

    const booking = memo.Booking
    const clientId = booking ? booking.client_id : null
    const contract = clientId ? await findActiveContract(clientId, booking ? new Date(booking.scheduled_date) : new Date()) : null

    // No active contract -> create an unmatched invoice (needs manual pricing) and 422.
    if (!contract) {
      const invoice = await sequelize.transaction(async (t) => {
        await memo.update({ status: 'reviewed', reviewed_by: req.user.sub }, { transaction: t })
        return Invoice.create({
          memo_id: memo.id,
          booking_id: memo.booking_id,
          client_id: clientId,
          contract_id: null,
          subtotal: 0, tax_amount: 0, total_amount: 0,
          status: 'unmatched',
        }, { transaction: t })
      })
      return error(
        res,
        `No active pricing contract found for this client - invoice #${invoice.id} created as \`unmatched\`. To resolve: create/activate a pricing contract for this client, or open the invoice and add a manual line item to price it yourself.`,
        'NO_ACTIVE_CONTRACT',
        422
      )
    }

    const rates = await PricingRate.findAll({
      where: { contract_id: contract.id, service_type: memo.service_type, transfer_type: memo.transfer_type },
    })
    const surcharges = await SurchargeSchedule.findAll({ where: { contract_id: contract.id } })

    const result = pricingService.computeInvoiceLineItems(memo, rates, surcharges)

    // Active contract but no matching rate row -> unmatched invoice + 422.
    if (!result.matched) {
      const invoice = await sequelize.transaction(async (t) => {
        await memo.update({ status: 'reviewed', reviewed_by: req.user.sub }, { transaction: t })
        return Invoice.create({
          memo_id: memo.id,
          booking_id: memo.booking_id,
          client_id: clientId,
          contract_id: contract.id,
          subtotal: 0, tax_amount: 0, total_amount: 0,
          status: 'unmatched',
        }, { transaction: t })
      })
      return error(
        res,
        `Active contract found but no rate row matches this memo's service/transfer/time combination - invoice #${invoice.id} created as \`unmatched\`. To resolve: add a matching rate to the contract, or open the invoice and add a manual line item to price it yourself.`,
        'NO_MATCHING_RATE',
        422
      )
    }

    const invoice = await sequelize.transaction(async (t) => {
      await memo.update({ status: 'reviewed', reviewed_by: req.user.sub }, { transaction: t })
      const inv = await Invoice.create({
        memo_id: memo.id,
        booking_id: memo.booking_id,
        client_id: clientId,
        contract_id: contract.id,
        subtotal: result.subtotal,
        tax_amount: 0,
        total_amount: result.subtotal,
        status: 'matched',
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
      invoice: {
        id: invoice.id,
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax_amount: invoice.tax_amount,
        total_amount: invoice.total_amount,
        line_items: lineItems.map((li) => ({
          id: li.id,
          description: li.description,
          quantity: li.quantity,
          unit_price: li.unit_price,
          amount: li.amount,
          is_manual_adjustment: li.is_manual_adjustment,
        })),
      },
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// PATCH /api/service-memos/:id/return - UC-03 alt flow: return the memo to the crew
// with a correction note. Status reverts to 'submitted' and the crew is notified.
async function returnMemo(req, res) {
  try {
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : ''
    if (!note) return error(res, '`note` is required to return a memo.', 'VALIDATION_ERROR', 400)

    const memo = await ServiceMemo.findByPk(req.params.id)
    if (!memo) return notFound(res, 'No memo with this id.')

    // Block return if an invoice for this memo is already approved/synced.
    const invoice = await Invoice.findOne({ where: { memo_id: memo.id } })
    if (invoice && ['approved', 'synced_to_xero'].includes(invoice.status)) {
      return error(res, 'Memo is linked to an invoice that has already been approved or synced - cannot be returned.', 'MEMO_ALREADY_INVOICED', 409)
    }

    await memo.update({ status: 'submitted', ar_note: note, reviewed_by: req.user.sub })

    if (memo.submitted_by) {
      notificationService.create({
        user_id: memo.submitted_by,
        type: 'memo_submitted',
        title: 'A service memo was returned for correction',
        body: note,
        link: `/memos/${memo.id}`,
      })
    }

    return success(res, { memo_id: memo.id, memo_status: 'submitted', note_recorded: true })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

module.exports = { findActiveContract, listPendingReview, approveMemo, returnMemo }
