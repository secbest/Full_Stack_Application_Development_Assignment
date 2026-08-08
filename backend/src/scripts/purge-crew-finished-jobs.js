// Removes a field crew member's FINISHED jobs (completed/invoiced) and everything hanging
// off them, to clear the backlog out of My Jobs.
//
// DRY RUN BY DEFAULT:
//   node src/scripts/purge-crew-finished-jobs.js                  (report only, Ravi)
//   node src/scripts/purge-crew-finished-jobs.js --apply
//   node src/scripts/purge-crew-finished-jobs.js --crew 6 --apply
//
// Excludes BKG-TEST-* by default. Those are seed-bookings.js's live demo set, re-created
// on today's date each time it runs; two of them (00003 completed, 00004 invoiced) would
// otherwise match this filter and be deleted the moment they were seeded. Pass
// --include-test to override. To remove that set specifically there is already a dedicated
// script: purge-field-crew-test-jobs.js.
//
// THIS CASCADES WELL BEYOND THE CREW MEMBER. Each booking drags its service memo,
// signature, invoice, invoice line items, Xero sync logs, milestones and originating
// intake with it. Invoices that reached Xero are counted separately in the report because
// deleting the local row does NOT retract the Xero draft. Read the impact summary before
// passing --apply - it states exactly what the AR Specialist and the Managing Director
// will lose, which is the part that is easy to underestimate.
require('dotenv').config()
const { Op } = require('sequelize')
const sequelize = require('../config')
const {
  User, Booking, ServiceMemo, MemoSignature, Invoice, InvoiceLineItem,
  JobMilestone, XeroSyncLog, IntakeSubmission,
} = require('../models')

const FINISHED = ['completed', 'invoiced']

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

async function main() {
  const apply = process.argv.includes('--apply')
  const includeTest = process.argv.includes('--include-test')
  const crewId = Number(arg('--crew', 5))

  await sequelize.authenticate()

  const crew = await User.findByPk(crewId)
  if (!crew) {
    console.error(`[purge-crew-finished-jobs] No user #${crewId}.`)
    process.exit(1)
  }

  const where = { assigned_crew_id: crewId, status: { [Op.in]: FINISHED } }
  if (!includeTest) where.reference_number = { [Op.notLike]: 'BKG-TEST-%' }

  const bookings = await Booking.findAll({ where, order: [['id', 'ASC']] })

  // Gather the full blast radius before touching anything.
  const rows = []
  const impact = { memos: 0, invoices: 0, lineItems: 0, milestones: 0, intakes: 0, xeroSynced: [], revenue: 0 }

  for (const booking of bookings) {
    const memo = await ServiceMemo.findOne({ where: { booking_id: booking.id } })
    const invoice = memo ? await Invoice.findOne({ where: { memo_id: memo.id } }) : null
    const lineItems = invoice ? await InvoiceLineItem.count({ where: { invoice_id: invoice.id } }) : 0
    const milestones = await JobMilestone.count({ where: { booking_id: booking.id } })
    const intake = booking.intake_submission_id
      ? await IntakeSubmission.findByPk(booking.intake_submission_id)
      : null

    if (memo) impact.memos += 1
    if (invoice) {
      impact.invoices += 1
      impact.revenue += Number(invoice.total_amount || 0)
      if (invoice.xero_invoice_id) impact.xeroSynced.push(`invoice #${invoice.id} -> ${invoice.xero_invoice_id}`)
    }
    impact.lineItems += lineItems
    impact.milestones += milestones
    if (intake) impact.intakes += 1

    rows.push({ booking, memo, invoice, intake })
    console.log(
      `  ${booking.reference_number.padEnd(16)} ${booking.status.padEnd(10)}` +
      ` memo:${memo ? '#' + memo.id : '-'}`.padEnd(12) +
      ` invoice:${invoice ? `#${invoice.id} ${invoice.status} $${invoice.total_amount}` : '-'}`
    )
  }

  const survivingInvoices = await Invoice.count()
  console.log(`\n  --- impact of deleting ${rows.length} finished job(s) for ${crew.name} ---`)
  console.log(`  service memos removed .......... ${impact.memos}`)
  console.log(`  invoices removed ............... ${impact.invoices} of ${survivingInvoices} in the system`)
  console.log(`  invoice line items removed ..... ${impact.lineItems}`)
  console.log(`  job milestones removed ......... ${impact.milestones}`)
  console.log(`  intake submissions removed ..... ${impact.intakes}`)
  console.log(`  revenue leaving MD reports ..... $${impact.revenue.toFixed(2)}`)
  console.log(`  invoices already in Xero ....... ${impact.xeroSynced.length}  (drafts REMAIN in Xero)`)
  impact.xeroSynced.forEach((x) => console.log(`      ${x}`))

  if (!rows.length) {
    console.log('\n  Nothing to do.\n')
    return sequelize.close()
  }

  if (!apply) {
    console.log('\n  DRY RUN - nothing was written. Re-run with --apply to delete.\n')
    return sequelize.close()
  }

  const tx = await sequelize.transaction()
  try {
    for (const { booking, memo, invoice, intake } of rows) {
      const opts = { transaction: tx }
      if (invoice) {
        await InvoiceLineItem.destroy({ where: { invoice_id: invoice.id }, ...opts })
        await XeroSyncLog.destroy({ where: { entity_type: 'ar_invoice', entity_id: invoice.id }, ...opts })
        await invoice.destroy(opts)
      }
      if (memo) {
        await MemoSignature.destroy({ where: { memo_id: memo.id }, ...opts })
        await memo.destroy(opts)
      }
      await JobMilestone.destroy({ where: { booking_id: booking.id }, ...opts })
      await booking.destroy(opts)
      // The intake goes last: leaving it behind would create a 'confirmed' submission with
      // no booking, which is the same broken half-state cleanup-demo-data.js removes.
      if (intake) await intake.destroy(opts)
    }
    await tx.commit()
    console.log(`\n  Committed - ${rows.length} finished job chain(s) removed for ${crew.name}.\n`)
  } catch (err) {
    await tx.rollback()
    console.error('\n  FAILED - rolled back, database unchanged:', err.message, '\n')
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}

main().catch((err) => {
  console.error('[purge-crew-finished-jobs] Fatal:', err.message)
  process.exit(1)
})
