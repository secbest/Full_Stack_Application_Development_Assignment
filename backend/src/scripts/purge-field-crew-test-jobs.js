// Removes ONLY the 5 BKG-TEST-* seed bookings seed-bookings.js creates for Field
// Crew (Ravi) - the ones causing "Raffles Medical Group" to keep reappearing as
// Current Job in My Jobs. Everything else (clients, intake submissions, the
// BKG-2026-*/BK-LEAK-*/BKG-REV-* bookings, pricing contracts, vendor invoices,
// the demo Xero connection) is left untouched - use purge-seed-data.js instead
// if you want the full pre-launch cleanup.
//
// Deletes (in FK-safe order) any job milestones, service memo + signature, and
// invoice + line items tied to each of the 5 bookings, then the booking itself.
// Note: BKG-TEST-00003 carries a seeded "unmatched invoice" demo memo (used to
// exercise the NO_ACTIVE_CONTRACT path in AR's Memo Review) - deleting it removes
// that demo case too.
//
// Safe to run more than once - a booking already gone is simply skipped.
//
// Usage:  node src/scripts/purge-field-crew-test-jobs.js
require('dotenv').config()
const sequelize = require('../config')
const { Booking, JobMilestone, ServiceMemo, MemoSignature, Invoice, InvoiceLineItem, XeroSyncLog } = require('../models')

const REFS = ['BKG-TEST-00001', 'BKG-TEST-00002', 'BKG-TEST-00003', 'BKG-TEST-00004', 'BKG-TEST-00005']

async function purgeOne(referenceNumber) {
  const booking = await Booking.findOne({ where: { reference_number: referenceNumber } })
  if (!booking) {
    console.log(`[purge-field-crew-test-jobs] ${referenceNumber}: not found - already clean.`)
    return
  }

  const memo = await ServiceMemo.findOne({ where: { booking_id: booking.id } })
  if (memo) {
    const invoice = await Invoice.findOne({ where: { memo_id: memo.id } })
    if (invoice) {
      await XeroSyncLog.destroy({ where: { entity_type: 'ar_invoice', entity_id: invoice.id } })
      await InvoiceLineItem.destroy({ where: { invoice_id: invoice.id } })
      await invoice.destroy()
      console.log(`[purge-field-crew-test-jobs] ${referenceNumber}: deleted invoice #${invoice.id} and its line items.`)
    }
    await MemoSignature.destroy({ where: { memo_id: memo.id } })
    await memo.destroy()
    console.log(`[purge-field-crew-test-jobs] ${referenceNumber}: deleted service memo #${memo.id}.`)
  }

  await JobMilestone.destroy({ where: { booking_id: booking.id } })
  await booking.destroy()
  console.log(`[purge-field-crew-test-jobs] ${referenceNumber}: deleted booking.`)
}

async function main() {
  try {
    await sequelize.authenticate()
    for (const ref of REFS) {
      await purgeOne(ref)
    }
    console.log('\n[purge-field-crew-test-jobs] Done. My Jobs will no longer show the seeded Raffles Medical Group test jobs.')
  } catch (err) {
    console.error('[purge-field-crew-test-jobs] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
