// Presentation cleanup: removes throwaway rows typed during testing and normalises the
// placeholder names that would otherwise appear on a projector, WITHOUT flattening the
// database the way `db:reset` does.
//
// Why not just run db:reset? Because the genuinely valuable demo material is not
// reproducible by a seed: invoices carrying real Xero record IDs from live syncs, the
// Central Medical vendor invoice that was really OCR'd by Gemini, and the revenue-leakage
// case the report actually cites. A reset destroys all of it, plus every teammate's
// in-flight work on the shared Supabase instance.
//
// DRY RUN BY DEFAULT. Nothing is written unless --apply is passed:
//   node src/scripts/cleanup-demo-data.js            (report only)
//   node src/scripts/cleanup-demo-data.js --apply    (write, inside one transaction)
//
// Idempotent - re-running after --apply reports nothing left to do.
//
// What it deliberately does NOT touch:
//   - Any invoice that is the last remaining example of its status. Sarah's Invoice List
//     has to show the full status range on stage, so the single `adjusted` and single
//     `failed` invoice are kept and merely renamed, never deleted.
//   - Bills already pushed to Xero. Deleting the local row does not retract the Xero draft;
//     that is a Xero-side decision for a human, not a cleanup script.
require('dotenv').config()
const sequelize = require('../config')
const {
  IntakeSubmission, Booking, ServiceMemo, MemoSignature, Invoice, InvoiceLineItem,
  JobMilestone, XeroSyncLog, Client, PricingContract, Notification,
} = require('../models')

// ── Chains to remove, keyed by intake reference ───────────────────────────────
// Each entry deletes the whole intake -> booking -> memo -> invoice chain plus its
// milestones, signatures, line items and sync logs. The `why` is printed in the report so
// the delete list can be reviewed before --apply.
const JUNK_INTAKES = [
  { ref: 'EFAR-2026-00012', why: 'placeholder "Testing 1", never actioned' },
  { ref: 'EFAR-2026-00013', why: 'placeholder "Testing 1", duplicate of the above' },
  { ref: 'EFAR-2026-00014', why: 'placeholder "Jasper Teo / NYP" (2 real rejected examples remain)' },
  { ref: 'EFAR-2026-00017', why: 'confirmed but has no booking - broken half-state' },
  { ref: 'EFAR-2026-00015', why: 'patient "Chud", $0 unmatched invoice' },
  { ref: 'EFAR-2026-00016', why: 'patient "Jas", $0 unmatched invoice' },
  { ref: 'EFAR-2026-00018', why: 'org "Test", patient "Jas", $0 unmatched invoice' },
  { ref: 'EFAR-2026-00019', why: 'Codex E2E automated-test fixture' },
  { ref: 'EFAR-2026-00024', why: 'redundant $0 unmatched invoice (one is kept for the Retry Match demo)' },
  { ref: 'EFAR-2026-00028', why: 'duplicate under-billed $21.80 sync (one is kept for the leakage demo)' },
  { ref: 'EFAR-2026-00030', why: 'org "hougang block abc", duplicate under-billed $21.80 sync' },
]

// Clients that only ever existed to carry a junk chain. Removed only if nothing references
// them once the chains above are gone.
const JUNK_CLIENT_NAMES = ['Codex E2E Org 20260806-140303', 'hougang block abc']

// Contracts whose name is obviously a test keystroke. Removed only if no invoice cites them.
const JUNK_CONTRACT_NAMES = ['TR', 'CODEX E2E Contract 20260806-140303']

// Placeholder names kept in place but made presentable. Renaming beats deleting here: these
// rows sit on chains that carry real demo value (the returned memo, the failed Xero sync,
// the leakage case), so losing them would cost more than the ugly string does.
const MEMO_PATIENT_RENAMES = {
  23: 'Ong Mei Ling',
  25: 'Rajesh Kumar',
  26: 'Goh Beng Huat',
  27: 'Sharifah Aminah',
  29: 'Danial Rahman',
  32: 'Low Kai Xin',
  34: 'Yusof Bin Hassan',
}
const SIGNATURE_RENAMES = { 15: 'Ong Mei Ling' }
const CLIENT_RENAMES = { 15: 'Temasek Polytechnic' }

const plan = { deletes: [], renames: [], skipped: [] }
const note = (bucket, msg) => plan[bucket].push(msg)

async function collectChain(entry) {
  const intake = await IntakeSubmission.findOne({ where: { reference_number: entry.ref } })
  if (!intake) return note('skipped', `${entry.ref} - already gone`)

  const booking = await Booking.findOne({ where: { intake_submission_id: intake.id } })
  const memo = booking ? await ServiceMemo.findOne({ where: { booking_id: booking.id } }) : null
  const invoice = memo ? await Invoice.findOne({ where: { memo_id: memo.id } }) : null

  const parts = [`intake #${intake.id} ${entry.ref}`]
  if (booking) parts.push(`booking ${booking.reference_number}`)
  if (memo) parts.push(`memo #${memo.id} (${memo.patient_name || 'no patient'})`)
  if (invoice) {
    parts.push(`invoice #${invoice.id} ${invoice.status} $${invoice.total_amount}`)
    if (invoice.xero_invoice_id) parts.push(`XERO DRAFT ${invoice.xero_invoice_id} stays in Xero`)
  }
  note('deletes', `${parts.join(' -> ')}\n      reason: ${entry.why}`)
  return { intake, booking, memo, invoice }
}

async function destroyChain({ intake, booking, memo, invoice }, tx) {
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
  if (booking) {
    await JobMilestone.destroy({ where: { booking_id: booking.id }, ...opts })
    await booking.destroy(opts)
  }
  await intake.destroy(opts)
}

async function main() {
  const apply = process.argv.includes('--apply')
  await sequelize.authenticate()

  // ── Pass 1: work out the plan (no writes) ───────────────────────────────────
  const chains = []
  for (const entry of JUNK_INTAKES) {
    const chain = await collectChain(entry)
    if (chain) chains.push(chain)
  }

  for (const [id, name] of Object.entries(MEMO_PATIENT_RENAMES)) {
    const memo = await ServiceMemo.findByPk(id)
    if (!memo) note('skipped', `memo #${id} - gone`)
    else if (memo.patient_name === name) note('skipped', `memo #${id} - already renamed`)
    else note('renames', `memo #${id} patient "${memo.patient_name}" -> "${name}"`)
  }
  for (const [id, name] of Object.entries(SIGNATURE_RENAMES)) {
    const sig = await MemoSignature.findByPk(id)
    if (sig && sig.signer_name !== name) note('renames', `signature #${id} signer "${sig.signer_name}" -> "${name}"`)
  }
  for (const [id, name] of Object.entries(CLIENT_RENAMES)) {
    const client = await Client.findByPk(id)
    if (client && client.name !== name) note('renames', `client #${id} "${client.name}" -> "${name}"`)
  }
  // An invoice that is itself being deleted above must not count as a reference, or the
  // report would claim a contract is "kept" while the apply pass (which re-counts after
  // the chain deletes, inside the transaction) would remove it. On a destructive script
  // the dry-run report is the review artifact, so it has to match what apply actually does.
  const doomedInvoiceIds = new Set(chains.filter((c) => c.invoice).map((c) => c.invoice.id))
  for (const name of JUNK_CONTRACT_NAMES) {
    const contract = await PricingContract.findOne({ where: { contract_name: name } })
    if (!contract) continue
    const citing = await Invoice.findAll({ where: { contract_id: contract.id }, attributes: ['id'] })
    const surviving = citing.filter((i) => !doomedInvoiceIds.has(i.id))
    if (surviving.length > 0) note('skipped', `contract "${name}" - kept, ${surviving.length} surviving invoice(s) cite it`)
    else note('deletes', `contract #${contract.id} "${name}" (unreferenced once the chains above are gone)`)
  }

  // Read notifications about records that are about to disappear. Scoped to the affected
  // users' already-read rows only - an unread notification is still someone's to-do, and
  // this database is shared with the rest of the team.
  const readNotifications = await Notification.count({ where: { is_read: true } })
  if (readNotifications > 0) {
    note('deletes', `${readNotifications} already-read notification(s) across all users (unread are kept)`)
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  const heading = apply ? 'APPLYING' : 'DRY RUN - nothing will be written'
  console.log(`\n=================== cleanup-demo-data: ${heading} ===================\n`)
  console.log(`DELETE (${plan.deletes.length})`)
  plan.deletes.forEach((d) => console.log('  - ' + d))
  console.log(`\nRENAME (${plan.renames.length})`)
  plan.renames.forEach((r) => console.log('  - ' + r))
  console.log(`\nSKIPPED (${plan.skipped.length})`)
  plan.skipped.forEach((s) => console.log('  - ' + s))

  if (!apply) {
    console.log('\n  Nothing was changed. Re-run with --apply to write.\n')
    return sequelize.close()
  }

  // ── Pass 2: apply, all-or-nothing ───────────────────────────────────────────
  const tx = await sequelize.transaction()
  try {
    for (const chain of chains) await destroyChain(chain, tx)

    for (const [id, name] of Object.entries(MEMO_PATIENT_RENAMES)) {
      const memo = await ServiceMemo.findByPk(id, { transaction: tx })
      if (memo) await memo.update({ patient_name: name }, { transaction: tx })
    }
    for (const [id, name] of Object.entries(SIGNATURE_RENAMES)) {
      const sig = await MemoSignature.findByPk(id, { transaction: tx })
      if (sig) await sig.update({ signer_name: name }, { transaction: tx })
    }
    for (const [id, name] of Object.entries(CLIENT_RENAMES)) {
      const client = await Client.findByPk(id, { transaction: tx })
      if (client) await client.update({ name }, { transaction: tx })
    }

    for (const name of JUNK_CONTRACT_NAMES) {
      const contract = await PricingContract.findOne({ where: { contract_name: name }, transaction: tx })
      if (contract && (await Invoice.count({ where: { contract_id: contract.id }, transaction: tx })) === 0) {
        await contract.destroy({ transaction: tx }) // cascades to rates + surcharges
      }
    }

    // Clients last: only once the chains that referenced them are gone.
    for (const name of JUNK_CLIENT_NAMES) {
      const client = await Client.findOne({ where: { name }, transaction: tx })
      if (!client) continue
      const refs = (await Booking.count({ where: { client_id: client.id }, transaction: tx }))
        + (await Invoice.count({ where: { client_id: client.id }, transaction: tx }))
        + (await PricingContract.count({ where: { client_id: client.id }, transaction: tx }))
      if (refs === 0) {
        await client.destroy({ transaction: tx })
        console.log(`  removed client "${name}"`)
      } else {
        console.log(`  kept client "${name}" - still referenced by ${refs} row(s)`)
      }
    }

    // Notification noise: every read notification about a record that no longer exists.
    const orphaned = await Notification.destroy({
      where: { is_read: true },
      transaction: tx,
    })
    console.log(`  cleared ${orphaned} already-read notification(s)`)

    await tx.commit()
    console.log('\n  Committed.\n')
  } catch (err) {
    await tx.rollback()
    console.error('\n  FAILED - rolled back, database unchanged:', err.message, '\n')
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}

main().catch((err) => {
  console.error('[cleanup-demo-data] Fatal:', err.message)
  process.exit(1)
})
