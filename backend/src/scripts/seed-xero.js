// Seeds demo data for the Xero Foundation / AP Processing tables
// (xero_connections, vendor_invoices, vendor_invoice_items, xero_sync_logs).
// Uses findOrCreate - safe to run multiple times; will not duplicate rows.
// Run `node src/scripts/seed-users.js` first so the ap_specialist FK exists.
//
// Usage:  node src/scripts/seed-xero.js
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const sequelize = require('../config')
const { User, XeroConnection, VendorInvoice, VendorInvoiceItem, XeroSyncLog } = require('../models')
const { cloudinaryService } = require('../services')

// The AP review screen's whole purpose is comparing the source PDF against the extracted
// fields side by side. These rows used to carry hand-written URLs on a Cloudinary cloud that
// does not exist, so the PDF pane rendered as an empty white panel on every seeded invoice -
// the one screen where that is most damaging. Upload the bundled fixture once and point every
// seeded row at the resulting real URL.
//
// Falls back to the placeholder (with a loud warning) rather than failing the seed, so the
// script still works when Cloudinary credentials are absent.
const FIXTURE_PDF = path.join(__dirname, 'fixtures', 'CMD-2026-01187.pdf')
const PLACEHOLDER_PDF = 'https://res.cloudinary.com/efar/raw/upload/v1750000000/vendor-invoices/placeholder.pdf'

async function resolveSamplePdfUrl() {
  try {
    const buffer = fs.readFileSync(FIXTURE_PDF)
    const url = await cloudinaryService.uploadPdf(buffer, 'seed-sample-vendor-invoice.pdf')
    console.log(`[seed-xero]   Uploaded sample PDF -> ${url}`)
    return url
  } catch (err) {
    console.warn(`[seed-xero]   WARNING: could not upload the sample PDF (${err.message}).`)
    console.warn('[seed-xero]   Seeded invoices will use a placeholder URL and their PDF pane will be blank.')
    return PLACEHOLDER_PDF
  }
}

async function main() {
  try {
    console.log('[seed-xero] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[seed-xero] Connected.')

    const samplePdfUrl = await resolveSamplePdfUrl()

    const chloe = await User.findOne({ where: { email: 'chloe@efar.com.sg' } })
    if (!chloe) {
      throw new Error('ap_specialist user not found - run `node src/scripts/seed-users.js` first.')
    }

    const [, connCreated] = await XeroConnection.findOrCreate({
      where: { xero_tenant_id: 'demo-tenant-efar-2026' },
      defaults: {
        xero_tenant_id: 'demo-tenant-efar-2026',
        xero_org_name: 'Emergencies First Aid & Rescue Pte Ltd',
        access_token: 'demo-encrypted-access-token',
        refresh_token: 'demo-encrypted-refresh-token',
        token_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        is_connected: true,
        connected_at: new Date(),
      },
    })
    console.log(`[seed-xero] ${connCreated ? '  Created' : 'Skipped (exists)'}: xero_connections`)

    const [invoiceA, invoiceACreated] = await VendorInvoice.findOrCreate({
      where: { vendor_name: 'Esso Petroleum Pte Ltd', invoice_number: 'INV-2026-00891' },
      defaults: {
        uploaded_by: chloe.id,
        vendor_name: 'Esso Petroleum Pte Ltd',
        invoice_number: 'INV-2026-00891',
        invoice_date: '2026-06-18',
        pdf_url: samplePdfUrl,
        extracted_total: 1840.00,
        rebate_percentage: 1.00,
        rebate_amount: 18.40,
        verified_total: 1821.60,
        extraction_confidence: 0.94,
        is_low_confidence: false,
        status: 'pending_review',
      },
    })
    console.log(`[seed-xero] ${invoiceACreated ? '  Created' : 'Skipped (exists)'}: vendor_invoices #${invoiceA.id} (Esso Petroleum)`)

    if (invoiceACreated) {
      await VendorInvoiceItem.bulkCreate([
        { vendor_invoice_id: invoiceA.id, description: 'Diesel 50ppm - 1,200 litres', quantity: 1200.00, unit_price: 1.45, amount: 1740.00 },
        { vendor_invoice_id: invoiceA.id, description: 'Delivery surcharge', quantity: 1.00, unit_price: 100.00, amount: 100.00 },
      ])
    }

    const [invoiceB, invoiceBCreated] = await VendorInvoice.findOrCreate({
      where: { vendor_name: 'SBS Transit Parts', invoice_number: 'INV-2026-00450' },
      defaults: {
        uploaded_by: chloe.id,
        vendor_name: 'SBS Transit Parts',
        invoice_number: 'INV-2026-00450',
        invoice_date: '2026-06-14',
        pdf_url: samplePdfUrl,
        extracted_total: 640.00,
        rebate_percentage: 1.00,
        rebate_amount: 6.40,
        verified_total: 633.60,
        extraction_confidence: 0.97,
        is_low_confidence: false,
        status: 'synced_to_xero',
        xero_bill_id: 'c9876543-21fe-dcba-0987-654321fedcba',
        approved_at: '2026-06-21T14:20:00.000Z',
        approved_by: chloe.id,
      },
    })
    console.log(`[seed-xero] ${invoiceBCreated ? '  Created' : 'Skipped (exists)'}: vendor_invoices #${invoiceB.id} (SBS Transit Parts)`)

    if (invoiceBCreated) {
      await VendorInvoiceItem.bulkCreate([
        { vendor_invoice_id: invoiceB.id, description: 'Brake pad set - ambulance fleet', quantity: 4.00, unit_price: 160.00, amount: 640.00 },
      ])
      const [, syncCreated] = await XeroSyncLog.findOrCreate({
        where: { entity_type: 'vendor_invoice', entity_id: invoiceB.id },
        defaults: {
          entity_type: 'vendor_invoice',
          entity_id: invoiceB.id,
          xero_record_id: 'c9876543-21fe-dcba-0987-654321fedcba',
          status: 'success',
          attempt_count: 1,
          synced_at: '2026-06-21T14:22:00.000Z',
        },
      })
      console.log(`[seed-xero] ${syncCreated ? '  Created' : 'Skipped (exists)'}: xero_sync_logs (success, invoice #${invoiceB.id})`)
    }

    // A low-confidence, still-pending invoice - exercises the review queue's confidence colour coding.
    const [invoiceC, invoiceCCreated] = await VendorInvoice.findOrCreate({
      where: { vendor_name: 'Jurong Medical Supplies', invoice_number: 'INV-2026-00512' },
      defaults: {
        uploaded_by: chloe.id,
        vendor_name: 'Jurong Medical Supplies',
        invoice_number: 'INV-2026-00512',
        invoice_date: '2026-06-19',
        pdf_url: samplePdfUrl,
        extracted_total: 312.50,
        rebate_percentage: 1.00,
        rebate_amount: 3.13,
        verified_total: 309.37,
        extraction_confidence: 0.61,
        is_low_confidence: true,
        status: 'pending_review',
      },
    })
    console.log(`[seed-xero] ${invoiceCCreated ? '  Created' : 'Skipped (exists)'}: vendor_invoices #${invoiceC.id} (Jurong Medical Supplies, low confidence)`)

    if (invoiceCCreated) {
      await VendorInvoiceItem.bulkCreate([
        { vendor_invoice_id: invoiceC.id, description: 'Disposable oxygen masks (box of 50)', quantity: 5.00, unit_price: 62.50, amount: 312.50 },
      ])
    }

    // A failed sync - exercises the retry UI in the sync status panel (UC-08).
    const [invoiceD, invoiceDCreated] = await VendorInvoice.findOrCreate({
      where: { vendor_name: 'Esso Petroleum Pte Ltd', invoice_number: 'INV-2026-00893' },
      defaults: {
        uploaded_by: chloe.id,
        approved_by: chloe.id,
        vendor_name: 'Esso Petroleum Pte Ltd',
        invoice_number: 'INV-2026-00893',
        invoice_date: '2026-06-20',
        pdf_url: samplePdfUrl,
        extracted_total: 980.00,
        rebate_percentage: 1.00,
        rebate_amount: 9.80,
        verified_total: 970.20,
        extraction_confidence: 0.92,
        is_low_confidence: false,
        status: 'failed',
        approved_at: '2026-06-22T10:10:00.000Z',
      },
    })
    console.log(`[seed-xero] ${invoiceDCreated ? '  Created' : 'Skipped (exists)'}: vendor_invoices #${invoiceD.id} (Esso Petroleum, sync failed)`)

    if (invoiceDCreated) {
      await XeroSyncLog.findOrCreate({
        where: { entity_type: 'vendor_invoice', entity_id: invoiceD.id },
        defaults: {
          entity_type: 'vendor_invoice',
          entity_id: invoiceD.id,
          status: 'failed',
          attempt_count: 1,
          error_message: "ContactNotFound: The contact 'Esso Petroleum Pte Ltd' does not exist in Xero.",
        },
      })
    }

    console.log('\n[seed-xero] Done.')
  } catch (err) {
    console.error('[seed-xero] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
