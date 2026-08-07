const { Op } = require('sequelize')
const crypto = require('crypto')
const sequelize = require('../config')
const { VendorInvoice, VendorInvoiceItem, VendorInvoiceAudit, User, XeroSyncLog } = require('../models')
const {
  cloudinaryService,
  ocrService,
  xeroService,
  apInvoiceService,
  vendorInvoiceAuditService,
} = require('../services')
const notificationService = require('../services/notificationService')
const { getFreshConnection } = require('./xeroController')
const { vendorInvoiceUploadSchema } = require('../validators')
const { success, created, error, notFound, round2 } = require('../utils')

const HEADER_EDITABLE_STATUSES = ['pending_review', 'extraction_failed', 'failed']
const PRE_APPROVAL_EDITABLE_STATUSES = ['pending_review', 'extraction_failed']
const VENDOR_INVOICE_STATUSES = ['pending_review', 'extraction_failed', 'approved', 'rejected', 'synced_to_xero', 'failed']

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

async function taxFieldsFromExtraction(extraction, rebatePercentage, { transaction } = {}) {
  const items = extraction.items || []
  const printedGst = Number(extraction.gst_amount)
  const treatment = Number.isFinite(printedGst) && printedGst > 0 ? 'standard_rated' : 'non_gst'
  let snapshot = {
    gst_rate_id: null,
    gst_rate_percent: 0,
    gst_effective_date: extraction.invoice_date || null,
    xero_tax_type: 'NRINPUT',
  }
  if (extraction.invoice_date) {
    snapshot = await apInvoiceService.resolveTaxSnapshot(extraction.invoice_date, treatment, { transaction })
  }
  const itemSubtotal = round2(items.reduce((sum, item) => sum + Number(item.amount || 0), 0))
  const subtotal = extraction.subtotal_excluding_gst ?? (treatment === 'standard_rated' ? itemSubtotal : extraction.extracted_total)
  const gstAmount = extraction.gst_amount ?? 0
  const totalIncludingGst = extraction.total_including_gst ?? extraction.extracted_total ?? round2(Number(subtotal || 0) + Number(gstAmount || 0))
  const { rebateAmount, verifiedTotal } = calculateRebate(totalIncludingGst, rebatePercentage)
  return {
    ...snapshot,
    gst_treatment: treatment,
    currency_code: String(extraction.currency_code || 'SGD').toUpperCase().slice(0, 3),
    supplier_gst_registration_no: extraction.supplier_gst_registration_no || null,
    due_date: extraction.due_date || null,
    xero_account_code: process.env.XERO_PURCHASE_ACCOUNT_CODE || null,
    subtotal_excluding_gst: subtotal,
    gst_amount: gstAmount,
    total_including_gst: totalIncludingGst,
    extracted_total: totalIncludingGst,
    rebate_amount: rebateAmount,
    verified_total: verifiedTotal,
  }
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
    due_date: json.due_date,
    pdf_url: json.pdf_url,
    currency_code: json.currency_code,
    supplier_gst_registration_no: json.supplier_gst_registration_no,
    gst_treatment: json.gst_treatment,
    gst_rate_id: json.gst_rate_id,
    gst_rate_percent: json.gst_rate_percent,
    gst_effective_date: json.gst_effective_date,
    xero_tax_type: json.xero_tax_type,
    xero_account_code: json.xero_account_code,
    subtotal_excluding_gst: json.subtotal_excluding_gst,
    gst_amount: json.gst_amount,
    total_including_gst: json.total_including_gst,
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
    audit_trail: (json.auditTrail || []).map((entry) => ({
      id: entry.id,
      action: entry.action,
      changes: entry.changes || {},
      note: entry.note,
      actor: entry.actor ? { id: entry.actor.id, name: entry.actor.name } : null,
      created_at: entry.created_at || entry.createdAt,
    })),
    created_at: json.created_at || json.createdAt,
    updated_at: json.updated_at || json.updatedAt,
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
      const failed = await sequelize.transaction(async (t) => {
        const row = await VendorInvoice.create({
          uploaded_by: req.user.sub,
          vendor_name: 'Unknown Vendor',
          invoice_number: `PENDING-${Date.now()}`,
          pdf_url: pdfUrl,
          rebate_percentage: rebatePercentage,
          status: 'extraction_failed',
        }, { transaction: t })
        await vendorInvoiceAuditService.record({
          invoiceId: row.id, userId: req.user.sub, action: 'upload_failed_extraction',
          note: 'PDF saved, but OCR extraction failed.', transaction: t,
        })
        return row
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

    const taxFields = await taxFieldsFromExtraction(extraction, rebatePercentage)
    const rec = extraction.reconciliation

    let invoice
    let items
    try {
      ({ invoice, items } = await sequelize.transaction(async (t) => {
        const row = await VendorInvoice.create({
          uploaded_by: req.user.sub,
          vendor_name: extraction.vendor_name,
          invoice_number: extraction.invoice_number,
          invoice_date: extraction.invoice_date,
          pdf_url: pdfUrl,
          ...taxFields,
          rebate_percentage: rebatePercentage,
          // Confidence and the low-confidence flag now come from ocrService.reconcile(),
          // which cross-checks the extraction's own arithmetic. A model cannot vouch for an
          // invoice whose line items do not add up to its stated total.
          extraction_confidence: rec.confidence,
          is_low_confidence: rec.isLowConfidence,
          extraction_checks: rec.checks,
          extracted_items_sum: rec.itemsSum,
          reconciliation_delta: rec.discrepancy,
          status: 'pending_review',
        }, { transaction: t })
        const createdItems = await Promise.all(
          (extraction.items || []).map((item) => VendorInvoiceItem.create({
            vendor_invoice_id: row.id,
            description: item.description,
            quantity: item.quantity ?? 1,
            unit_price: item.unit_price,
            amount: item.amount,
          }, { transaction: t }))
        )
        await vendorInvoiceAuditService.record({
          invoiceId: row.id, userId: req.user.sub, action: 'uploaded',
          note: 'PDF uploaded and OCR extraction completed.', transaction: t,
        })
        return { invoice: row, items: createdItems }
      }))
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        return error(res, 'An invoice with this number from this vendor already exists.', 'DUPLICATE_INVOICE', 409)
      }
      throw err
    }

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

    const baseWhere = {}
    if (vendor_name) baseWhere.vendor_name = { [Op.iLike]: `%${vendor_name}%` }
    if (date_from || date_to) {
      baseWhere.invoice_date = {}
      if (date_from) baseWhere.invoice_date[Op.gte] = date_from
      if (date_to) baseWhere.invoice_date[Op.lte] = date_to
    }
    const where = statusFilter ? { ...baseWhere, status: statusFilter } : baseWhere

    const offset = (page - 1) * limit
    const [{ rows, count }, groupedCounts] = await Promise.all([
      VendorInvoice.findAndCountAll({
        where,
        order: [['created_at', 'DESC']],
        limit,
        offset,
      }),
      // Counts intentionally omit only the status filter. Vendor/date search filters
      // still apply, but selecting one status must not make every other badge read zero.
      VendorInvoice.count({ where: baseWhere, group: ['status'] }),
    ])
    const statusCounts = Object.fromEntries(VENDOR_INVOICE_STATUSES.map((status) => [status, 0]))
    for (const row of groupedCounts || []) {
      if (row.status in statusCounts) statusCounts[row.status] = Number(row.count)
    }

    return success(res, {
      data: rows.map((v) => ({
        id: v.id,
        vendor_name: v.vendor_name,
        invoice_number: v.invoice_number,
        invoice_date: v.invoice_date,
        due_date: v.due_date,
        currency_code: v.currency_code,
        gst_treatment: v.gst_treatment,
        gst_amount: v.gst_amount,
        total_including_gst: v.total_including_gst,
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
      status_counts: statusCounts,
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
        {
          model: VendorInvoiceAudit,
          as: 'auditTrail',
          include: [{ model: User, as: 'actor', attributes: ['id', 'name'] }],
          order: [['created_at', 'DESC']],
          separate: true,
        },
      ],
    })
    if (!invoice) return notFound(res, 'Vendor invoice not found.')
    const approvalValidation = await apInvoiceService.validateForApproval(invoice)
    return success(res, { ...serializeInvoice(invoice), approval_validation: approvalValidation })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// PATCH /api/vendor-invoices/:id - UC-06: correct OCR-extracted header fields.
// Recalculates the rebate when extracted_total or rebate_percentage change.
async function updateVendorInvoice(req, res) {
  try {
    const invoice = await VendorInvoice.findByPk(req.params.id, { include: [{ model: VendorInvoiceItem }] })
    if (!invoice) return notFound(res, 'Vendor invoice not found.')
    if (!HEADER_EDITABLE_STATUSES.includes(invoice.status)) {
      return error(res, 'Invoice cannot be edited in its current status. Only `pending_review`, `extraction_failed`, and failed Xero-sync invoices are editable.', 'INVALID_STATUS', 409)
    }

    const {
      vendor_name,
      invoice_number,
      invoice_date,
      due_date,
      currency_code,
      supplier_gst_registration_no,
      gst_treatment,
      xero_account_code,
      subtotal_excluding_gst,
      gst_amount,
      total_including_gst,
      extracted_total,
      rebate_percentage,
    } = req.body
    const updates = {}
    if (vendor_name !== undefined) updates.vendor_name = vendor_name
    if (invoice_number !== undefined) updates.invoice_number = invoice_number
    if (invoice_date !== undefined) updates.invoice_date = invoice_date
    if (due_date !== undefined) updates.due_date = due_date
    if (currency_code !== undefined) updates.currency_code = currency_code.toUpperCase()
    if (supplier_gst_registration_no !== undefined) updates.supplier_gst_registration_no = supplier_gst_registration_no || null
    if (xero_account_code !== undefined) updates.xero_account_code = xero_account_code

    if (extracted_total !== undefined && !(Number(extracted_total) > 0)) {
      return error(res, '`extracted_total` must be a positive number', 'INVALID_TOTAL', 400)
    }

    const totalChanged = extracted_total !== undefined || total_including_gst !== undefined
    const pctChanged = rebate_percentage !== undefined
    const taxChanged = [invoice_date, gst_treatment, subtotal_excluding_gst, gst_amount, total_including_gst, extracted_total]
      .some((value) => value !== undefined)
    if (taxChanged) {
      const nextDate = invoice_date !== undefined ? invoice_date : invoice.invoice_date
      const nextTreatment = gst_treatment !== undefined ? gst_treatment : invoice.gst_treatment
      let snapshot
      try {
        snapshot = await apInvoiceService.resolveTaxSnapshot(nextDate, nextTreatment)
      } catch (err) {
        return error(res, err.message, err.code || 'INVALID_GST_CONFIGURATION', 400)
      }
      Object.assign(updates, snapshot, { gst_treatment: nextTreatment })

      const items = invoice.VendorInvoiceItems || []
      const nextSubtotal = subtotal_excluding_gst !== undefined
        ? Number(subtotal_excluding_gst)
        : Number(invoice.subtotal_excluding_gst ?? invoice.extracted_total)
      const nextGst = gst_amount !== undefined
        ? Number(gst_amount)
        : apInvoiceService.calculateTax(items, snapshot.gst_rate_percent)
      const explicitTotal = total_including_gst !== undefined ? total_including_gst : extracted_total
      const nextTotal = explicitTotal !== undefined
        ? Number(explicitTotal)
        : round2(nextSubtotal + nextGst)
      updates.subtotal_excluding_gst = nextSubtotal
      updates.gst_amount = nextGst
      updates.total_including_gst = nextTotal
      updates.extracted_total = nextTotal
    }

    if (totalChanged || pctChanged || taxChanged) {
      const newTotal = taxChanged
        ? updates.total_including_gst
        : (invoice.total_including_gst !== null && invoice.total_including_gst !== undefined
            ? Number(invoice.total_including_gst)
            : Number(invoice.extracted_total))
      const newPct = pctChanged ? Number(rebate_percentage) : Number(invoice.rebate_percentage)
      const { rebateAmount, verifiedTotal } = calculateRebate(newTotal, newPct)
      if (verifiedTotal !== null && verifiedTotal < 0) {
        return error(res, 'Rebate calculation results in a negative verified total. Please check the extracted total.', 'NEGATIVE_VERIFIED_TOTAL', 400)
      }
      if (pctChanged) updates.rebate_percentage = newPct
      updates.rebate_amount = rebateAmount
      updates.verified_total = verifiedTotal
    }

    try {
      const auditedFields = [
        'vendor_name', 'invoice_number', 'invoice_date', 'due_date', 'currency_code',
        'supplier_gst_registration_no', 'gst_treatment', 'gst_rate_percent', 'xero_tax_type',
        'xero_account_code', 'subtotal_excluding_gst', 'gst_amount', 'total_including_gst',
        'extracted_total', 'rebate_percentage', 'rebate_amount', 'verified_total',
      ]
      const before = auditedFields.reduce((copy, field) => ({ ...copy, [field]: invoice[field] }), {})
      await sequelize.transaction(async (t) => {
        await invoice.update(updates, { transaction: t })
        const changes = vendorInvoiceAuditService.diff(before, invoice, auditedFields)
        if (Object.keys(changes).length) {
          await vendorInvoiceAuditService.record({
            invoiceId: invoice.id,
            userId: req.user?.sub || null,
            action: 'header_updated',
            changes,
            transaction: t,
          })
        }
      })
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
      due_date: invoice.due_date,
      currency_code: invoice.currency_code,
      supplier_gst_registration_no: invoice.supplier_gst_registration_no,
      gst_treatment: invoice.gst_treatment,
      gst_rate_percent: invoice.gst_rate_percent,
      xero_tax_type: invoice.xero_tax_type,
      xero_account_code: invoice.xero_account_code,
      subtotal_excluding_gst: invoice.subtotal_excluding_gst,
      gst_amount: invoice.gst_amount,
      total_including_gst: invoice.total_including_gst,
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
    let log
    try {
      ({ invoice, approvedAt, log } = await sequelize.transaction(async (t) => {
        const inv = await VendorInvoice.findByPk(req.params.id, {
          include: [{ model: VendorInvoiceItem }],
          // PostgreSQL cannot lock the nullable (item) side of Sequelize's LEFT JOIN.
          // Lock only the invoice row; its status is the resource that prevents a
          // concurrent approval from creating a duplicate Xero bill.
          lock: { level: t.LOCK.UPDATE, of: VendorInvoice },
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

        const approvalValidation = await apInvoiceService.validateForApproval(inv, { transaction: t })
        if (!approvalValidation.can_approve) {
          throw Object.assign(
            new Error('Resolve the invoice validation issues before approving.'),
            { httpCode: 409, code: 'APPROVAL_VALIDATION_FAILED', details: approvalValidation }
          )
        }
        if (approvalValidation.requires_low_confidence_confirmation && req.body?.confirm_low_confidence !== true) {
          throw Object.assign(
            new Error('Confirm that the low-confidence invoice was checked against the source PDF before approving.'),
            { httpCode: 409, code: 'LOW_CONFIDENCE_CONFIRMATION_REQUIRED', details: approvalValidation }
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
        await vendorInvoiceAuditService.record({
          invoiceId: inv.id,
          userId: req.user.sub,
          action: 'approved',
          changes: { status: { from: 'pending_review', to: 'approved' } },
          note: approvalValidation.requires_low_confidence_confirmation
            ? 'Approved after the AP Specialist confirmed manual verification against the source PDF.'
            : null,
          transaction: t,
        })
        const syncLog = await XeroSyncLog.create({
          entity_type: 'vendor_invoice',
          entity_id: inv.id,
          status: 'pending',
          attempt_count: 1,
        }, { transaction: t })
        return { invoice: inv, approvedAt: at, log: syncLog }
      }))
    } catch (err) {
      if (err.httpCode) {
        return error(res, err.message, err.code || 'NOT_FOUND', err.httpCode, err.details ? { data: err.details } : {})
      }
      throw err
    }

    // From here the invoice is committed as `approved` and owned by this request. A
    // connection failure now leaves it approved-but-unsynced, which is a state the sync
    // status screen shows and the retry endpoint can recover - not a silent dead end.
    const conn = await getFreshConnection()
    if (!conn) {
      await log.update({ status: 'failed', error_message: 'Xero is not connected.' })
      await invoice.update({ status: 'failed' })
      await vendorInvoiceAuditService.record({
        invoiceId: invoice.id,
        userId: req.user.sub,
        action: 'sync_failed',
        changes: { status: { from: 'approved', to: 'failed' } },
        note: 'Xero is not connected.',
      })
      return error(res, 'Xero is not connected. Ask the Managing Director to reconnect, then retry the sync from the Xero Sync Status screen.', 'XERO_NOT_CONNECTED', 503, {
        data: { id: invoice.id, status: 'failed', sync_log: { id: log.id, status: 'failed', attempt_count: 1 } },
      })
    }

    const result = await xeroService.pushBill(invoice, conn)

    if (result.ok) {
      const syncedAt = new Date()
      await invoice.update({ status: 'synced_to_xero', xero_bill_id: result.xeroRecordId })
      await log.update({ status: 'success', xero_record_id: result.xeroRecordId, synced_at: syncedAt })
      await vendorInvoiceAuditService.record({
        invoiceId: invoice.id,
        userId: req.user.sub,
        action: 'sync_succeeded',
        changes: { status: { from: 'approved', to: 'synced_to_xero' }, xero_bill_id: { from: null, to: result.xeroRecordId } },
        note: 'Draft bill created in Xero.',
      })
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
    await vendorInvoiceAuditService.record({
      invoiceId: invoice.id,
      userId: req.user.sub,
      action: 'sync_failed',
      changes: { status: { from: 'approved', to: 'failed' } },
      note: result.error,
    })
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

    if (!PRE_APPROVAL_EDITABLE_STATUSES.includes(invoice.status)) {
      return error(res, 'Only invoices with status `pending_review` or `extraction_failed` can be rejected', 'INVALID_STATUS', 409)
    }

    const previousStatus = invoice.status
    await sequelize.transaction(async (t) => {
      await invoice.update({ status: 'rejected', rejection_reason: reason }, { transaction: t })
      await vendorInvoiceAuditService.record({
        invoiceId: invoice.id,
        userId: req.user?.sub || null,
        action: 'rejected',
        changes: {
          status: { from: previousStatus, to: 'rejected' },
          rejection_reason: { from: null, to: reason },
        },
        note: reason,
        transaction: t,
      })
    })
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
    if (req.body?.confirm_replace !== true) {
      return error(
        res,
        'Confirm that the existing extracted fields and line items may be replaced.',
        'REEXTRACTION_CONFIRMATION_REQUIRED',
        409
      )
    }

    const invoice = await VendorInvoice.findByPk(req.params.id)
    if (!invoice) return notFound(res, 'Vendor invoice not found.')
    if (!PRE_APPROVAL_EDITABLE_STATUSES.includes(invoice.status)) {
      return error(res, 'Re-extraction is only available for invoices with status `pending_review` or `extraction_failed`', 'INVALID_STATUS', 409)
    }
    const startedUpdatedAt = invoice.updatedAt ? new Date(invoice.updatedAt).getTime() : null

    let extraction
    try {
      const resp = await fetch(invoice.pdf_url)
      if (!resp.ok) throw new Error(`PDF fetch returned ${resp.status}`)
      const buffer = Buffer.from(await resp.arrayBuffer())
      extraction = await ocrService.extractVendorInvoice(buffer)
    } catch {
      await vendorInvoiceAuditService.record({
        invoiceId: invoice.id,
        userId: req.user?.sub || null,
        action: 'reextraction_failed',
        note: 'OCR retry failed. Existing invoice fields, status, and line items were preserved.',
      })
      return error(
        res,
        'Re-extraction failed. Your existing invoice fields and line items were kept unchanged.',
        'OCR_EXTRACTION_FAILED',
        502
      )
    }

    const rec = extraction.reconciliation
    let taxFields
    try {
      taxFields = await taxFieldsFromExtraction(extraction, Number(invoice.rebate_percentage))
    } catch (err) {
      await vendorInvoiceAuditService.record({
        invoiceId: invoice.id,
        userId: req.user?.sub || null,
        action: 'reextraction_failed',
        note: `OCR retry completed, but its accounting fields could not be validated: ${err.message}. Existing invoice data was preserved.`,
      })
      return error(res, `Re-extraction could not be applied: ${err.message} Existing invoice data was kept unchanged.`, err.code || 'INVALID_GST_CONFIGURATION', 400)
    }

    const headerFields = [
      'vendor_name', 'invoice_number', 'invoice_date', 'due_date', 'currency_code',
      'supplier_gst_registration_no', 'gst_treatment', 'gst_rate_id', 'gst_rate_percent',
      'gst_effective_date', 'xero_tax_type', 'xero_account_code', 'subtotal_excluding_gst',
      'gst_amount', 'total_including_gst', 'extracted_total', 'rebate_amount',
      'verified_total', 'extraction_confidence', 'is_low_confidence', 'extraction_checks',
      'extracted_items_sum', 'reconciliation_delta', 'status',
    ]
    const snapshotHeader = (record) => headerFields.reduce((snapshot, field) => {
      snapshot[field] = record[field] ?? null
      return snapshot
    }, {})
    const snapshotItems = (items) => items.map((item) => ({
      id: item.id ?? null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      amount: item.amount,
    }))

    let appliedInvoice
    await sequelize.transaction(async (t) => {
      const current = await VendorInvoice.findByPk(invoice.id, { transaction: t, lock: t.LOCK.UPDATE })
      if (!current) throw Object.assign(new Error('Vendor invoice not found.'), { httpCode: 404, code: 'NOT_FOUND' })
      if (!PRE_APPROVAL_EDITABLE_STATUSES.includes(current.status)) {
        throw Object.assign(
          new Error('The invoice is no longer editable, so its data was not replaced.'),
          { httpCode: 409, code: 'INVALID_STATUS' }
        )
      }
      const currentUpdatedAt = current.updatedAt ? new Date(current.updatedAt).getTime() : null
      if (startedUpdatedAt !== null && currentUpdatedAt !== null && currentUpdatedAt !== startedUpdatedAt) {
        throw Object.assign(
          new Error('The invoice changed while OCR was running. Review the latest data before retrying.'),
          { httpCode: 409, code: 'INVOICE_CHANGED' }
        )
      }

      const previousItems = await VendorInvoiceItem.findAll({
        where: { vendor_invoice_id: current.id },
        transaction: t,
      })
      const previousHeader = snapshotHeader(current)
      const replacementItems = extraction.items || []
      await VendorInvoiceItem.destroy({ where: { vendor_invoice_id: invoice.id }, transaction: t })
      await current.update({
        vendor_name: extraction.vendor_name,
        invoice_number: extraction.invoice_number,
        invoice_date: extraction.invoice_date,
        ...taxFields,
        extraction_confidence: rec.confidence,
        is_low_confidence: rec.isLowConfidence,
        extraction_checks: rec.checks,
        extracted_items_sum: rec.itemsSum,
        reconciliation_delta: rec.discrepancy,
        status: 'pending_review',
      }, { transaction: t })

      await Promise.all(
        replacementItems.map((item) => VendorInvoiceItem.create({
          vendor_invoice_id: current.id,
          description: item.description,
          quantity: item.quantity ?? 1,
          unit_price: item.unit_price,
          amount: item.amount,
        }, { transaction: t }))
      )
      await vendorInvoiceAuditService.record({
        invoiceId: current.id,
        userId: req.user?.sub || null,
        action: 'reextracted',
        changes: {
          previous_header: previousHeader,
          previous_line_items: snapshotItems(previousItems),
          replacement_header: snapshotHeader(current),
          replacement_line_items: snapshotItems(replacementItems),
        },
        note: 'OCR data and line items were replaced from the source PDF.',
        transaction: t,
      })
      appliedInvoice = current
    })

    if (appliedInvoice.is_low_confidence) {
      notificationService.create({
        user_id: appliedInvoice.uploaded_by,
        type: 'ocr_low_confidence',
        title: `Low-confidence OCR on ${appliedInvoice.vendor_name}`,
        body: `Re-extraction: ${lowConfidenceReason(rec)}`,
        link: `/vendor-invoices/${appliedInvoice.id}`,
      })
    }

    const reloaded = await VendorInvoice.findByPk(appliedInvoice.id, {
      include: [
        { model: VendorInvoiceItem },
        { model: VendorInvoiceAudit, as: 'auditTrail', include: [{ model: User, as: 'actor', attributes: ['id', 'name'] }] },
      ],
    })
    return success(res, serializeInvoice(reloaded))
  } catch (err) {
    if (err.httpCode) return error(res, err.message, err.code || 'REEXTRACTION_FAILED', err.httpCode)
    if (err.name === 'SequelizeUniqueConstraintError') {
      return error(res, 'The re-extracted vendor and invoice number already belong to another invoice. Existing data was kept unchanged.', 'DUPLICATE_INVOICE', 409)
    }
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

function matchesInboundSecret(provided, expected) {
  if (!provided || !expected) return false
  const actual = Buffer.from(String(provided))
  const configured = Buffer.from(String(expected))
  return actual.length === configured.length && crypto.timingSafeEqual(actual, configured)
}

async function inboundApUserId() {
  const configuredId = Number(process.env.AP_INBOUND_UPLOADED_BY)
  if (Number.isInteger(configuredId) && configuredId > 0) return configuredId

  const specialist = await User.findOne({
    where: { role: 'ap_specialist' },
    order: [['id', 'ASC']],
    attributes: ['id'],
  })
  return specialist?.id || null
}

// POST /api/vendor-invoices/inbound-email. An email provider forwards PDF
// attachments here as multipart `attachments`, with its retry-safe message id in
// `message_id` and the shared secret in X-AP-Inbound-Secret. This endpoint does
// not accept browser authentication: it is intentionally for the mail adapter.
async function receiveInboundEmail(req, res) {
  try {
    if (!req.internal_email_intake && !process.env.AP_INBOUND_EMAIL_SECRET) {
      return error(res, 'Inbound email intake is not configured.', 'INBOUND_EMAIL_DISABLED', 503)
    }
    if (!req.internal_email_intake && !matchesInboundSecret(req.get?.('X-AP-Inbound-Secret') || req.headers?.['x-ap-inbound-secret'], process.env.AP_INBOUND_EMAIL_SECRET)) {
      return error(res, 'Invalid inbound email credentials.', 'UNAUTHORIZED', 401)
    }

    const messageId = String(req.body?.message_id || req.get?.('X-AP-Message-Id') || '').trim()
    if (!messageId || messageId.length > 450) {
      return error(res, 'A valid message_id is required for inbound email intake.', 'INVALID_MESSAGE_ID', 400)
    }
    const files = req.files || []
    if (!files.length) return error(res, 'No PDF invoice attachments were received.', 'FILE_REQUIRED', 400)

    const { rebate_percentage: rebatePercentage } = await vendorInvoiceUploadSchema.validate(req.body || {}, {
      abortEarly: false,
      stripUnknown: true,
    })
    const uploadedBy = await inboundApUserId()
    if (!uploadedBy) return error(res, 'No AP specialist is available to own inbound invoices.', 'AP_SPECIALIST_NOT_FOUND', 503)

    const results = []
    for (const [index, file] of files.entries()) {
      const inboundEmailId = `${messageId}:${index + 1}`
      const alreadyReceived = await VendorInvoice.findOne({ where: { inbound_email_id: inboundEmailId } })
      if (alreadyReceived) {
        results.push({ id: alreadyReceived.id, status: alreadyReceived.status, duplicate: true })
        continue
      }

      let pdfUrl
      try {
        pdfUrl = await cloudinaryService.uploadPdf(file.buffer, file.originalname)
      } catch {
        results.push({ filename: file.originalname, status: 'failed', code: 'CLOUDINARY_UPLOAD_FAILED' })
        continue
      }

      let extraction
      try {
        extraction = await ocrService.extractVendorInvoice(file.buffer)
      } catch {
        const failed = await sequelize.transaction(async (t) => {
          const row = await VendorInvoice.create({
            uploaded_by: uploadedBy,
            vendor_name: 'Unknown Vendor',
            invoice_number: `PENDING-${Date.now()}-${index + 1}`,
            pdf_url: pdfUrl,
            inbound_email_id: inboundEmailId,
            rebate_percentage: rebatePercentage,
            status: 'extraction_failed',
          }, { transaction: t })
          await vendorInvoiceAuditService.record({
            invoiceId: row.id, userId: uploadedBy, action: 'received_by_email',
            note: 'PDF received by email, but OCR extraction failed.', transaction: t,
          })
          return row
        })
        results.push({ id: failed.id, status: failed.status, needs_manual_review: true })
        continue
      }

      try {
        const taxFields = await taxFieldsFromExtraction(extraction, rebatePercentage)
        const rec = extraction.reconciliation
        const invoice = await sequelize.transaction(async (t) => {
          const row = await VendorInvoice.create({
            uploaded_by: uploadedBy,
            vendor_name: extraction.vendor_name,
            invoice_number: extraction.invoice_number,
            invoice_date: extraction.invoice_date,
            pdf_url: pdfUrl,
            inbound_email_id: inboundEmailId,
            ...taxFields,
            rebate_percentage: rebatePercentage,
            extraction_confidence: rec.confidence,
            is_low_confidence: rec.isLowConfidence,
            extraction_checks: rec.checks,
            extracted_items_sum: rec.itemsSum,
            reconciliation_delta: rec.discrepancy,
            status: 'pending_review',
          }, { transaction: t })
          await Promise.all((extraction.items || []).map((item) => VendorInvoiceItem.create({
            vendor_invoice_id: row.id,
            description: item.description,
            quantity: item.quantity ?? 1,
            unit_price: item.unit_price,
            amount: item.amount,
          }, { transaction: t })))
          await vendorInvoiceAuditService.record({
            invoiceId: row.id, userId: uploadedBy, action: 'received_by_email',
            note: 'PDF received by email and OCR extraction completed.', transaction: t,
          })
          return row
        })
        if (invoice.is_low_confidence) {
          notificationService.create({
            user_id: uploadedBy,
            type: 'ocr_low_confidence',
            title: `Low-confidence OCR on ${invoice.vendor_name}`,
            body: lowConfidenceReason(rec),
            link: `/vendor-invoices/${invoice.id}`,
          })
        }
        results.push({ id: invoice.id, status: invoice.status, needs_manual_review: invoice.is_low_confidence })
      } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError') {
          const duplicate = await VendorInvoice.findOne({ where: { inbound_email_id: inboundEmailId } })
          results.push(duplicate
            ? { id: duplicate.id, status: duplicate.status, duplicate: true }
            : { filename: file.originalname, status: 'failed', code: 'DUPLICATE_INVOICE' })
          continue
        }
        throw err
      }
    }

    return created(res, { received: results, received_count: results.filter((row) => row.id && !row.duplicate).length })
  } catch (err) {
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 422)
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// Exposes only the forwarding address and readiness state to staff. The webhook
// secret is deliberately never returned to the browser.
function getInboundEmailSettings(req, res) {
  return success(res, {
    configured: Boolean(process.env.AP_INBOUND_EMAIL_ADDRESS && process.env.AP_INBOUND_EMAIL_SECRET),
    forwarding_address: process.env.AP_INBOUND_EMAIL_ADDRESS || null,
    max_attachment_size_mb: 10,
    accepted_attachment_type: 'application/pdf',
  })
}

module.exports = {
  calculateRebate,
  receiveInboundEmail,
  getInboundEmailSettings,
  uploadVendorInvoice,
  listVendorInvoices,
  getVendorInvoiceById,
  updateVendorInvoice,
  approveVendorInvoice,
  rejectVendorInvoice,
  reextractVendorInvoice,
}
