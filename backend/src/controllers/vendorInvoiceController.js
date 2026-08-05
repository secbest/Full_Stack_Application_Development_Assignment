const { Op } = require('sequelize')
const sequelize = require('../config')
const { VendorInvoice, VendorInvoiceItem, User, XeroSyncLog } = require('../models')
const { cloudinaryService, ocrService, xeroService } = require('../services')
const notificationService = require('../services/notificationService')
const { getFreshConnection } = require('./xeroController')
const { vendorInvoiceUploadSchema } = require('../validators')
const { success, created, error, notFound, round2 } = require('../utils')

const EDITABLE_STATUSES = ['pending_review', 'extraction_failed']

// Rebate Calculation (UC-05): rebate_amount = extracted_total * (rebate_percentage / 100),
// verified_total = extracted_total - rebate_amount. Deferred (returns nulls) if extracted_total is missing.
function calculateRebate(extractedTotal, rebatePercentage) {
  if (extractedTotal === null || extractedTotal === undefined) {
    return { rebateAmount: null, verifiedTotal: null }
  }
  const rebateAmount = round2(extractedTotal * (rebatePercentage / 100))
  const verifiedTotal = round2(extractedTotal - rebateAmount)
  return { rebateAmount, verifiedTotal }
}

// Turns the reconciliation result into one line an AP Specialist can act on. Prefers the
// failed check's own detail (e.g. "Line items sum to 980.00 but the invoice total reads
// 1080.00") over a bare confidence percentage, which says nothing about what to fix.
function lowConfidenceReason(rec) {
  const failed = (rec.checks || []).filter((c) => !c.passed)
  if (failed.length) return failed.map((c) => c.detail).join(' ')
  return `Extraction confidence ${Math.round((rec.confidence || 0) * 100)}% - please verify the extracted totals.`
}

// Full detail shape for the two-panel AP review interface (UC-06).
function serializeInvoice(invoice) {
  const json = invoice.toJSON()
  return {
    id: json.id,
    uploaded_by: json.uploadedBy ? { id: json.uploadedBy.id, name: json.uploadedBy.name } : json.uploaded_by,
    approved_by: json.approvedBy ? { id: json.approvedBy.id, name: json.approvedBy.name } : json.approved_by,
    vendor_name: json.vendor_name,
    invoice_number: json.invoice_number,
    invoice_date: json.invoice_date,
    pdf_url: json.pdf_url,
    extracted_total: json.extracted_total,
    rebate_percentage: json.rebate_percentage,
    rebate_amount: json.rebate_amount,
    verified_total: json.verified_total,
    extraction_confidence: json.extraction_confidence,
    is_low_confidence: json.is_low_confidence,
    // The reasons behind is_low_confidence, so the review panel can show what failed
    // rather than only a percentage.
    extraction_checks: json.extraction_checks || [],
    extracted_items_sum: json.extracted_items_sum,
    reconciliation_delta: json.reconciliation_delta,
    status: json.status,
    xero_bill_id: json.xero_bill_id,
    rejection_reason: json.rejection_reason,
    approved_at: json.approved_at,
    items: (json.VendorInvoiceItems || []).map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
      amount: i.amount,
    })),
    created_at: json.created_at,
    updated_at: json.updated_at,
  }
}

// POST /api/vendor-invoices - UC-03/04/05: accepts a vendor PDF upload,
// forwards it to Cloudinary, runs Gemini OCR, calculates the rebate, and
// returns the fully populated invoice + line items ready for AP review.
async function uploadVendorInvoice(req, res) {
  try {
    if (!req.file) {
      return error(res, 'Only PDF files are accepted. Please scan the invoice and upload as a PDF.', 'INVALID_FILE_TYPE', 400)
    }

    const { rebate_percentage: rebatePercentage } = await vendorInvoiceUploadSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    })

    let pdfUrl
    try {
      pdfUrl = await cloudinaryService.uploadPdf(req.file.buffer, req.file.originalname)
    } catch {
      return error(res, 'Failed to upload PDF to storage. Please retry.', 'CLOUDINARY_UPLOAD_FAILED', 502)
    }

    let extraction
    try {
      extraction = await ocrService.extractVendorInvoice(req.file.buffer)
    } catch {
      // The placeholder invoice_number must stay inside the column's 100 chars and must
      // not embed the raw upload filename (it is user-controlled and can be arbitrarily
      // long). A timestamped marker is enough to keep the unique index happy.
      const failed = await VendorInvoice.create({
        uploaded_by: req.user.sub,
        vendor_name: 'Unknown Vendor',
        invoice_number: `PENDING-${Date.now()}`,
        pdf_url: pdfUrl,
        rebate_percentage: rebatePercentage,
        status: 'extraction_failed',
      })
      // The id is returned in the payload: the message tells the caller to retry via
      // /vendor-invoices/:id/reextract, and previously never said what :id was.
      return error(
        res,
        'Gemini could not extract data from this PDF. The invoice has been saved with status `extraction_failed` - retry with POST /api/vendor-invoices/:id/reextract, or enter the fields manually.',
        'OCR_EXTRACTION_FAILED',
        502,
        { data: { id: failed.id, status: failed.status, pdf_url: failed.pdf_url } }
      )
    }

    const extractedTotal = extraction.extracted_total ?? null
    const { rebateAmount, verifiedTotal } = calculateRebate(extractedTotal, rebatePercentage)
    const rec = extraction.reconciliation

    let invoice
    try {
      invoice = await VendorInvoice.create({
        uploaded_by: req.user.sub,
        vendor_name: extraction.vendor_name,
        invoice_number: extraction.invoice_number,
        invoice_date: extraction.invoice_date,
        pdf_url: pdfUrl,
        extracted_total: extractedTotal,
        rebate_percentage: rebatePercentage,
        rebate_amount: rebateAmount,
        verified_total: verifiedTotal,
        // Confidence and the low-confidence flag now come from ocrService.reconcile(),
        // which cross-checks the extraction's own arithmetic. A model cannot vouch for an
        // invoice whose line items do not add up to its stated total.
        extraction_confidence: rec.confidence,
        is_low_confidence: rec.isLowConfidence,
        extraction_checks: rec.checks,
        extracted_items_sum: rec.itemsSum,
        reconciliation_delta: rec.discrepancy,
        status: 'pending_review',
      })
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return error(res, 'An invoice with this number from this vendor already exists.', 'DUPLICATE_INVOICE', 409)
      }
      throw err
    }

    const items = await Promise.all(
      (extraction.items || []).map((item) =>
        VendorInvoiceItem.create({
          vendor_invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity ?? 1,
          unit_price: item.unit_price,
          amount: item.amount,
        })
      )
    )

    // UC-04 edge case: flag low-confidence extractions for closer manual review. The body
    // names the specific check that failed rather than just a percentage, so the AP
    // Specialist knows what to look at before opening the PDF.
    if (invoice.is_low_confidence) {
      notificationService.create({
        user_id: invoice.uploaded_by,
        type: 'ocr_low_confidence',
        title: `Low-confidence OCR on ${invoice.vendor_name}`,
        body: lowConfidenceReason(rec),
        link: `/vendor-invoices/${invoice.id}`,
      })
    }

    return created(res, { ...invoice.toJSON(), items: items.map((i) => i.toJSON()) })
  } catch (err) {
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 422)
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// GET /api/vendor-invoices - UC-06/07: paginated, filterable AP review queue.
async function listVendorInvoices(req, res) {
  try {
    const { status: statusFilter, vendor_name, date_from, date_to, page, limit } = req.query
    if (date_from && date_to && date_from > date_to) {
      return error(res, '`date_from` must be before or equal to `date_to`', 'INVALID_DATE_RANGE', 400)
    }

    const where = {}
    if (statusFilter) where.status = statusFilter
    if (vendor_name) where.vendor_name = { [Op.iLike]: `%${vendor_name}%` }
    if (date_from || date_to) {
      where.invoice_date = {}
      if (date_from) where.invoice_date[Op.gte] = date_from
      if (date_to) where.invoice_date[Op.lte] = date_to
    }

    const offset = (page - 1) * limit
    const { rows, count } = await VendorInvoice.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    })

    return success(res, {
      data: rows.map((v) => ({
        id: v.id,
        vendor_name: v.vendor_name,
        invoice_number: v.invoice_number,
        invoice_date: v.invoice_date,
        extracted_total: v.extracted_total,
        verified_total: v.verified_total,
        // The list's colour-coded confidence column reads this. Sending only the boolean
        // is_low_confidence left that column permanently blank even though the percentage
        // was stored and shown correctly on the detail screen.
        extraction_confidence: v.extraction_confidence,
        is_low_confidence: v.is_low_confidence,
        status: v.status,
        created_at: v.createdAt,
      })),
      pagination: { page, limit, total: count, total_pages: Math.ceil(count / limit) || 1 },
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// GET /api/vendor-invoices/:id - UC-06: full detail + line items.
async function getVendorInvoiceById(req, res) {
  try {
    const invoice = await VendorInvoice.findByPk(req.params.id, {
      include: [
        { model: VendorInvoiceItem },
        { model: User, as: 'uploadedBy', attributes: ['id', 'name'] },
        { model: User, as: 'approvedBy', attributes: ['id', 'name'] },
      ],
    })
    if (!invoice) return notFound(res, 'Vendor invoice not found.')
    return success(res, serializeInvoice(invoice))
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// PATCH /api/vendor-invoices/:id - UC-06: correct OCR-extracted header fields.
// Recalculates the rebate when extracted_total or rebate_percentage change.
async function updateVendorInvoice(req, res) {
  try {
    const invoice = await VendorInvoice.findByPk(req.params.id)
    if (!invoice) return notFound(res, 'Vendor invoice not found.')
    if (!EDITABLE_STATUSES.includes(invoice.status)) {
      return error(res, 'Invoice cannot be edited in its current status. Only `pending_review` and `extraction_failed` invoices are editable.', 'INVALID_STATUS', 409)
    }

    const { vendor_name, invoice_number, invoice_date, extracted_total, rebate_percentage } = req.body
    const updates = {}
    if (vendor_name !== undefined) updates.vendor_name = vendor_name
    if (invoice_number !== undefined) updates.invoice_number = invoice_number
    if (invoice_date !== undefined) updates.invoice_date = invoice_date

    if (extracted_total !== undefined && !(Number(extracted_total) > 0)) {
      return error(res, '`extracted_total` must be a positive number', 'INVALID_TOTAL', 400)
    }

    const totalChanged = extracted_total !== undefined
    const pctChanged = rebate_percentage !== undefined
    if (totalChanged || pctChanged) {
      const newTotal = totalChanged
        ? Number(extracted_total)
        : (invoice.extracted_total !== null ? Number(invoice.extracted_total) : null)
      const newPct = pctChanged ? Number(rebate_percentage) : Number(invoice.rebate_percentage)
      const { rebateAmount, verifiedTotal } = calculateRebate(newTotal, newPct)
      if (verifiedTotal !== null && verifiedTotal < 0) {
        return error(res, 'Rebate calculation results in a negative verified total. Please check the extracted total.', 'NEGATIVE_VERIFIED_TOTAL', 400)
      }
      if (totalChanged) updates.extracted_total = newTotal
      if (pctChanged) updates.rebate_percentage = newPct
      updates.rebate_amount = rebateAmount
      updates.verified_total = verifiedTotal
    }

    try {
      await invoice.update(updates)
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return error(res, 'An invoice with this number from this vendor already exists.', 'DUPLICATE_INVOICE', 409)
      }
      throw err
    }

    return success(res, {
      id: invoice.id,
      vendor_name: invoice.vendor_name,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      extracted_total: invoice.extracted_total,
      rebate_percentage: invoice.rebate_percentage,
      rebate_amount: invoice.rebate_amount,
      verified_total: invoice.verified_total,
      status: invoice.status,
      updated_at: invoice.updatedAt,
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// POST /api/vendor-invoices/:id/approve - UC-06/07: approve then immediately
// push to Xero as a draft bill. The response reflects the post-sync status.
async function approveVendorInvoice(req, res) {
  try {
    // Claim the invoice inside a transaction with a row lock before doing anything
    // external. Xero does not deduplicate ACCPAY bills, so two concurrent approvals
    // (a double-clicked button, a retried request) previously both read
    // status='pending_review', both pushed, and created two bills for one PDF. The lock
    // serialises them; the loser sees the status check fail and is rejected.
    let invoice
    let approvedAt
    try {
      ({ invoice, approvedAt } = await sequelize.transaction(async (t) => {
        const inv = await VendorInvoice.findByPk(req.params.id, {
          include: [{ model: VendorInvoiceItem }],
          lock: t.LOCK.UPDATE,
          transaction: t,
        })
        if (!inv) throw Object.assign(new Error('Vendor invoice not found.'), { httpCode: 404 })
        if (inv.status !== 'pending_review') {
          throw Object.assign(
            new Error('Only invoices with status `pending_review` can be approved'),
            { httpCode: 409, code: 'INVALID_STATUS' }
          )
        }
        if (inv.extracted_total === null || inv.extracted_total === undefined) {
          throw Object.assign(
            new Error('`extracted_total` must be set before the invoice can be approved'),
            { httpCode: 409, code: 'MISSING_TOTAL' }
          )
        }

        // Duplicate guard: another already-approved/synced invoice with the same identity.
        const dup = await VendorInvoice.findOne({
          where: {
            id: { [Op.ne]: inv.id },
            vendor_name: inv.vendor_name,
            invoice_number: inv.invoice_number,
            status: { [Op.in]: ['approved', 'synced_to_xero'] },
          },
          transaction: t,
        })
        if (dup) {
          throw Object.assign(
            new Error('An invoice with this number from this vendor already exists. Please verify before approving.'),
            { httpCode: 409, code: 'DUPLICATE_INVOICE' }
          )
        }

        const at = new Date()
        await inv.update({ status: 'approved', approved_by: req.user.sub, approved_at: at }, { transaction: t })
        return { invoice: inv, approvedAt: at }
      }))
    } catch (err) {
      if (err.httpCode) return error(res, err.message, err.code || 'NOT_FOUND', err.httpCode)
      throw err
    }

    // From here the invoice is committed as `approved` and owned by this request. A
    // connection failure now leaves it approved-but-unsynced, which is a state the sync
    // status screen shows and the retry endpoint can recover - not a silent dead end.
    const conn = await getFreshConnection()
    if (!conn) {
      const log = await XeroSyncLog.create({
        entity_type: 'vendor_invoice',
        entity_id: invoice.id,
        status: 'failed',
        attempt_count: 1,
        error_message: 'Xero is not connected.',
      })
      await invoice.update({ status: 'failed' })
      return error(res, 'Xero is not connected. Ask the Managing Director to reconnect, then retry the sync from the Xero Sync Status screen.', 'XERO_NOT_CONNECTED', 503, {
        data: { id: invoice.id, status: 'failed', sync_log: { id: log.id, status: 'failed', attempt_count: 1 } },
      })
    }

    const log = await XeroSyncLog.create({ entity_type: 'vendor_invoice', entity_id: invoice.id, status: 'pending', attempt_count: 1 })
    const result = await xeroService.pushBill(invoice, conn)

    if (result.ok) {
      const syncedAt = new Date()
      await invoice.update({ status: 'synced_to_xero', xero_bill_id: result.xeroRecordId })
      await log.update({ status: 'success', xero_record_id: result.xeroRecordId, synced_at: syncedAt })
      return success(res, {
        id: invoice.id,
        status: 'synced_to_xero',
        xero_bill_id: result.xeroRecordId,
        approved_at: approvedAt,
        sync_log: { id: log.id, status: 'success', attempt_count: 1, synced_at: syncedAt },
      })
    }

    await invoice.update({ status: 'failed' })
    await log.update({ status: 'failed', error_message: result.error })
    notificationService.create({
      user_id: invoice.uploaded_by,
      type: 'xero_sync_failed',
      title: `Xero sync failed for ${invoice.vendor_name}`,
      body: result.error,
      link: '/xero/sync-status',
    })
    return success(res, {
      id: invoice.id,
      status: 'failed',
      xero_bill_id: null,
      approved_at: approvedAt,
      sync_log: { id: log.id, status: 'failed', attempt_count: 1, error_message: result.error, synced_at: null },
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// POST /api/vendor-invoices/:id/reject - UC-06: reject with a mandatory reason.
async function rejectVendorInvoice(req, res) {
  try {
    const invoice = await VendorInvoice.findByPk(req.params.id)
    if (!invoice) return notFound(res, 'Vendor invoice not found.')

    const reason = typeof req.body.rejection_reason === 'string' ? req.body.rejection_reason.trim() : ''
    if (!reason) return error(res, '`rejection_reason` is required when rejecting an invoice', 'MISSING_REASON', 400)

    if (!EDITABLE_STATUSES.includes(invoice.status)) {
      return error(res, 'Only invoices with status `pending_review` or `extraction_failed` can be rejected', 'INVALID_STATUS', 409)
    }

    await invoice.update({ status: 'rejected', rejection_reason: reason })
    return success(res, {
      id: invoice.id,
      status: 'rejected',
      rejection_reason: reason,
      updated_at: invoice.updatedAt,
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// POST /api/vendor-invoices/:id/reextract - UC-04: re-run Gemini OCR on the
// stored PDF, replacing the previously extracted header + line items.
async function reextractVendorInvoice(req, res) {
  try {
    const invoice = await VendorInvoice.findByPk(req.params.id)
    if (!invoice) return notFound(res, 'Vendor invoice not found.')
    if (!EDITABLE_STATUSES.includes(invoice.status)) {
      return error(res, 'Re-extraction is only available for invoices with status `pending_review` or `extraction_failed`', 'INVALID_STATUS', 409)
    }

    let buffer
    try {
      const resp = await fetch(invoice.pdf_url)
      if (!resp.ok) throw new Error(`PDF fetch returned ${resp.status}`)
      buffer = Buffer.from(await resp.arrayBuffer())
    } catch {
      await invoice.update({ status: 'extraction_failed' })
      return error(res, 'Gemini failed to extract data again. Invoice status has been set to `extraction_failed`. Please enter fields manually.', 'OCR_EXTRACTION_FAILED', 502)
    }

    let extraction
    try {
      extraction = await ocrService.extractVendorInvoice(buffer)
    } catch {
      await invoice.update({ status: 'extraction_failed' })
      return error(res, 'Gemini failed to extract data again. Invoice status has been set to `extraction_failed`. Please enter fields manually.', 'OCR_EXTRACTION_FAILED', 502)
    }

    await VendorInvoiceItem.destroy({ where: { vendor_invoice_id: invoice.id } })

    const extractedTotal = extraction.extracted_total ?? null
    const { rebateAmount, verifiedTotal } = calculateRebate(extractedTotal, Number(invoice.rebate_percentage))
    const rec = extraction.reconciliation
    await invoice.update({
      vendor_name: extraction.vendor_name,
      invoice_number: extraction.invoice_number,
      invoice_date: extraction.invoice_date,
      extracted_total: extractedTotal,
      rebate_amount: rebateAmount,
      verified_total: verifiedTotal,
      extraction_confidence: rec.confidence,
      is_low_confidence: rec.isLowConfidence,
      extraction_checks: rec.checks,
      extracted_items_sum: rec.itemsSum,
      reconciliation_delta: rec.discrepancy,
      status: 'pending_review',
    })

    await Promise.all(
      (extraction.items || []).map((item) =>
        VendorInvoiceItem.create({
          vendor_invoice_id: invoice.id,
          description: item.description,
          quantity: item.quantity ?? 1,
          unit_price: item.unit_price,
          amount: item.amount,
        })
      )
    )

    if (invoice.is_low_confidence) {
      notificationService.create({
        user_id: invoice.uploaded_by,
        type: 'ocr_low_confidence',
        title: `Low-confidence OCR on ${invoice.vendor_name}`,
        body: `Re-extraction: ${lowConfidenceReason(rec)}`,
        link: `/vendor-invoices/${invoice.id}`,
      })
    }

    const reloaded = await VendorInvoice.findByPk(invoice.id, { include: [{ model: VendorInvoiceItem }] })
    return success(res, serializeInvoice(reloaded))
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

module.exports = {
  calculateRebate,
  uploadVendorInvoice,
  listVendorInvoices,
  getVendorInvoiceById,
  updateVendorInvoice,
  approveVendorInvoice,
  rejectVendorInvoice,
  reextractVendorInvoice,
}
