// One-off: uploads a realistic sample vendor invoice PDF to Cloudinary and
// creates the matching vendor_invoices + vendor_invoice_items rows directly
// (bypassing Gemini OCR), so the AP Invoice Queue has a clean, fully-populated
// example instead of an "Unknown Vendor" / extraction_failed row.
//
// Usage:  node src/scripts/seed-sample-vendor-invoice.js [path-to-pdf]
// Defaults to the bundled fixture at ./fixtures/CMD-2026-01187.pdf.
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const sequelize = require('../config')
const { User, GstRate, VendorInvoice, VendorInvoiceItem } = require('../models')
const { cloudinaryService } = require('../services')

async function main() {
  const pdfPath = process.argv[2] || path.join(__dirname, 'fixtures', 'CMD-2026-01187.pdf')

  try {
    await sequelize.authenticate()

    const existing = await VendorInvoice.findOne({
      where: { vendor_name: 'Central Medical Distributors Pte Ltd', invoice_number: 'CMD-2026-01187' },
    })
    if (existing) {
      console.log(`[seed-sample-vendor-invoice] Skipped (already exists): vendor_invoices #${existing.id}`)
      return
    }

    const chloe = await User.findOne({ where: { email: 'chloe@efar.com.sg' } })
    if (!chloe) {
      throw new Error('ap_specialist user not found - run `node src/scripts/seed-users.js` first.')
    }

    const buffer = fs.readFileSync(pdfPath)
    const pdfUrl = await cloudinaryService.uploadPdf(buffer, path.basename(pdfPath))
    console.log(`[seed-sample-vendor-invoice] Uploaded PDF -> ${pdfUrl}`)

    const gstRate = await GstRate.findOne({ where: { jurisdiction: 'SG', effective_from: '2024-01-01' } })
    if (!gstRate) throw new Error('2024 Singapore GST rate is missing - run `npm run db:migrate:gst` first.')

    const invoice = await VendorInvoice.create({
      uploaded_by: chloe.id,
      vendor_name: 'Central Medical Distributors Pte Ltd',
      invoice_number: 'CMD-2026-01187',
      invoice_date: '2026-07-05',
      due_date: '2026-08-04',
      pdf_url: pdfUrl,
      currency_code: 'SGD',
      supplier_gst_registration_no: 'M2-1234567-8',
      gst_treatment: 'standard_rated',
      gst_rate_id: gstRate.id,
      gst_rate_percent: 9.00,
      gst_effective_date: '2026-07-05',
      xero_tax_type: 'INPUTY24',
      xero_account_code: process.env.XERO_PURCHASE_ACCOUNT_CODE || '400',
      subtotal_excluding_gst: 1343.00,
      gst_amount: 120.87,
      total_including_gst: 1463.87,
      extracted_total: 1463.87,
      rebate_percentage: 1.00,
      rebate_amount: 14.64,
      verified_total: 1449.23,
      extraction_confidence: 0.96,
      is_low_confidence: false,
      status: 'pending_review',
    })

    await VendorInvoiceItem.bulkCreate([
      { vendor_invoice_id: invoice.id, description: 'Disposable oxygen masks (box of 50)', quantity: 10.00, unit_price: 62.50, amount: 625.00 },
      { vendor_invoice_id: invoice.id, description: 'Nitrile examination gloves (box of 100)', quantity: 20.00, unit_price: 8.90, amount: 178.00 },
      { vendor_invoice_id: invoice.id, description: 'Adult CPR pocket masks', quantity: 15.00, unit_price: 12.00, amount: 180.00 },
      { vendor_invoice_id: invoice.id, description: 'Spinal immobilization collars', quantity: 8.00, unit_price: 45.00, amount: 360.00 },
    ])
    console.log(`[seed-sample-vendor-invoice] Created vendor_invoices #${invoice.id} (Central Medical Distributors, GST subtotal + line items).`)
  } catch (err) {
    console.error('[seed-sample-vendor-invoice] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
