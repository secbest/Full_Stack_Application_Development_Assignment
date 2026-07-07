const { VendorInvoice, VendorInvoiceItem } = require('../models')
const { cloudinaryService, ocrService } = require('../services')
const { vendorInvoiceUploadSchema } = require('../validators')
const { created, error } = require('../utils')

const round2 = (n) => Math.round(n * 100) / 100

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
      await VendorInvoice.create({
        uploaded_by: req.user.sub,
        vendor_name: 'Unknown Vendor',
        invoice_number: `PENDING-${req.file.originalname}-${Date.now()}`,
        pdf_url: pdfUrl,
        rebate_percentage: rebatePercentage,
        status: 'extraction_failed',
      })
      return error(
        res,
        'Gemini could not extract data from this PDF. The invoice has been saved with status `extraction_failed` - use POST /api/vendor-invoices/:id/reextract to retry.',
        'OCR_EXTRACTION_FAILED',
        502
      )
    }

    const extractedTotal = extraction.extracted_total ?? null
    const { rebateAmount, verifiedTotal } = calculateRebate(extractedTotal, rebatePercentage)

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
        extraction_confidence: extraction.confidence ?? null,
        is_low_confidence: (extraction.confidence ?? 0) < 0.80,
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

    return created(res, { ...invoice.toJSON(), items: items.map((i) => i.toJSON()) })
  } catch (err) {
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 422)
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

module.exports = { uploadVendorInvoice, calculateRebate }
