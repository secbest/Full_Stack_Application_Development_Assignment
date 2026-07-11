// Resets a single booking back to a clean 'in_progress' state with no service memo,
// so the Field Crew "My Jobs -> Memo Wizard" segment can be rehearsed and re-demoed
// live as many times as needed, instead of being a one-shot booking that's consumed
// the first time a memo is submitted against it.
//
// Deletes (in FK-safe order) any Invoice + InvoiceLineItems and ServiceMemo +
// MemoSignatures tied to the booking, then flips the booking back to 'in_progress'.
// Safe to run repeatedly - if the booking is already clean, it's a no-op.
//
// Usage:  node src/scripts/reset-demo-memo-booking.js [reference_number]
// Defaults to BKG-TEST-00001, the booking seed-bookings.js sets up for this purpose.
require('dotenv').config()
const sequelize = require('../config')
const { Booking, ServiceMemo, Invoice, InvoiceLineItem } = require('../models')

async function main() {
  const referenceNumber = process.argv[2] || 'BKG-TEST-00001'

  try {
    await sequelize.authenticate()

    const booking = await Booking.findOne({ where: { reference_number: referenceNumber } })
    if (!booking) {
      console.error(`[reset-demo-memo-booking] No booking found with reference_number ${referenceNumber}.`)
      process.exit(1)
    }

    const memo = await ServiceMemo.findOne({ where: { booking_id: booking.id } })

    if (memo) {
      const invoice = await Invoice.findOne({ where: { memo_id: memo.id } })
      if (invoice) {
        await InvoiceLineItem.destroy({ where: { invoice_id: invoice.id } })
        await invoice.destroy()
        console.log(`[reset-demo-memo-booking] Deleted invoice #${invoice.id} and its line items.`)
      }
      await memo.destroy() // cascades to memo_signatures
      console.log(`[reset-demo-memo-booking] Deleted service memo #${memo.id} and its signature.`)
    } else {
      console.log('[reset-demo-memo-booking] No existing memo found - nothing to delete.')
    }

    await booking.update({ status: 'in_progress' })
    console.log(`[reset-demo-memo-booking] ${referenceNumber} reset to status 'in_progress' - ready to redo the Memo Wizard demo.`)
  } catch (err) {
    console.error('[reset-demo-memo-booking] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
