// Resets a single vendor invoice back to a clean 'pending_review' state with no
// approval/sync history, so the AP Invoice Review "Approve -> Sync to Xero" segment
// can be rehearsed and re-demoed live as many times as needed, instead of being a
// one-shot invoice that's consumed the first time it's approved.
//
// Deletes any XeroSyncLog rows tied to the invoice (entity_type 'vendor_invoice'),
// then clears status/approved_by/approved_at/xero_bill_id back to pending_review.
// Safe to run repeatedly - if the invoice is already pending_review, it's a no-op
// on the invoice fields but still clears any stray sync logs.
//
// Usage:  node src/scripts/reset-demo-vendor-invoice-sync.js [vendor_name] [invoice_number]
// Defaults to Central Medical Distributors Pte Ltd / CMD-2026-01187, the invoice
// seed-sample-vendor-invoice.js sets up for this purpose.
require('dotenv').config()
const sequelize = require('../config')
const { VendorInvoice, XeroSyncLog } = require('../models')

async function main() {
  const vendorName = process.argv[2] || 'Central Medical Distributors Pte Ltd'
  const invoiceNumber = process.argv[3] || 'CMD-2026-01187'

  try {
    await sequelize.authenticate()

    const invoice = await VendorInvoice.findOne({ where: { vendor_name: vendorName, invoice_number: invoiceNumber } })
    if (!invoice) {
      console.error(`[reset-demo-vendor-invoice-sync] No vendor invoice found for ${vendorName} / ${invoiceNumber}.`)
      process.exit(1)
    }

    const deleted = await XeroSyncLog.destroy({ where: { entity_type: 'vendor_invoice', entity_id: invoice.id } })
    if (deleted) {
      console.log(`[reset-demo-vendor-invoice-sync] Deleted ${deleted} xero_sync_logs row(s) for vendor_invoice #${invoice.id}.`)
    }

    await invoice.update({ status: 'pending_review', approved_by: null, approved_at: null, xero_bill_id: null })
    console.log(`[reset-demo-vendor-invoice-sync] ${vendorName} / ${invoiceNumber} reset to status 'pending_review' - ready to redo the Approve/Sync demo.`)
  } catch (err) {
    console.error('[reset-demo-vendor-invoice-sync] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
