// Resets the demo intake submissions back to 'pending' so Camilla's Intake Queue can
// be rehearsed and re-demoed as many times as needed, instead of the queue permanently
// emptying out the first time each demo intake gets confirmed or rejected.
//
// Deletes (in FK-safe order) any Invoice + InvoiceLineItems, ServiceMemo +
// MemoSignatures, and Booking tied to each intake, then flips the intake back to
// 'pending' and clears its review fields. Safe to run repeatedly - if an intake is
// already pending with no linked booking, it's a no-op for that intake.
//
// Usage:  node src/scripts/reset-demo-intakes.js [reference_number ...]
// Defaults to EFAR-2026-00001 and EFAR-2026-00002, the two intakes seed-intakes.js
// sets up as Camilla's live pending queue.
require('dotenv').config()
const sequelize = require('../config')
const { IntakeSubmission, Booking, ServiceMemo, Invoice, InvoiceLineItem } = require('../models')

const DEFAULT_REFERENCES = ['EFAR-2026-00001', 'EFAR-2026-00002']

async function resetOne(referenceNumber) {
  const intake = await IntakeSubmission.findOne({ where: { reference_number: referenceNumber } })
  if (!intake) {
    console.log(`[reset-demo-intakes] No intake found with reference_number ${referenceNumber} - skipping.`)
    return
  }

  const booking = await Booking.findOne({ where: { intake_submission_id: intake.id } })
  if (booking) {
    const memo = await ServiceMemo.findOne({ where: { booking_id: booking.id } })
    if (memo) {
      const invoice = await Invoice.findOne({ where: { memo_id: memo.id } })
      if (invoice) {
        await InvoiceLineItem.destroy({ where: { invoice_id: invoice.id } })
        await invoice.destroy()
        console.log(`[reset-demo-intakes] ${referenceNumber}: deleted invoice #${invoice.id} and its line items.`)
      }
      await memo.destroy() // cascades to memo_signatures
      console.log(`[reset-demo-intakes] ${referenceNumber}: deleted service memo #${memo.id} and its signature.`)
    }
    await booking.destroy()
    console.log(`[reset-demo-intakes] ${referenceNumber}: deleted booking ${booking.reference_number}.`)
  } else {
    console.log(`[reset-demo-intakes] ${referenceNumber}: no linked booking - nothing to delete.`)
  }

  await intake.update({ status: 'pending', reviewed_by: null, reviewed_at: null, rejection_reason: null })
  console.log(`[reset-demo-intakes] ${referenceNumber}: reset to status 'pending' - ready to redo the Intake Queue demo.`)
}

async function main() {
  const references = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_REFERENCES

  try {
    await sequelize.authenticate()
    for (const ref of references) {
      await resetOne(ref)
    }
  } catch (err) {
    console.error('[reset-demo-intakes] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
