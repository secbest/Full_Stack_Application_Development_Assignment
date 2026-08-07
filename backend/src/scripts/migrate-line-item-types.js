// Idempotent migration: classify invoice line items as base / surcharge / adjustment.
//
// Why: an invoice can legitimately carry engine-priced surcharges while its BASE transport
// charge is still unknown (quotation mismatch, missing contract, missing rate). Adding any
// manual adjustment moves such an invoice from `unmatched` to `adjusted`, which used to be
// enough to approve and push it to Xero - so invoices reached the ledger billed for a $20
// surcharge with the ~$190 transport charge silently absent.
//
// is_manual_adjustment cannot express this: it separates "engine" from "human", not
// "transport charge" from "extra". This adds the column the approval guard reads.
//
// Backfill rules, in order:
//   is_manual_adjustment = true            -> adjustment
//   description matches a known surcharge  -> surcharge
//   otherwise (engine-generated)           -> base
//
// The description match is deliberate rather than "lowest id per invoice wins": an invoice
// created by the new no-base path has surcharge rows and NO base, and an id-based rule
// would mislabel its first surcharge as the transport charge - inventing a base that was
// never priced and defeating the guard this migration exists to enable.
//
// Run: node src/scripts/migrate-line-item-types.js

require('dotenv').config()
const sequelize = require('../config')
const { InvoiceLineItem } = require('../models')

// Prefixes the pricing engine uses for surcharge rows (see pricingService
// buildSurchargeLineItems). Anything engine-generated that does not start with one of
// these is the base rate line, whose description is "<SERVICE> - <Transfer> (<Time>)",
// optionally prefixed with "One-Off Quote - " or "Quoted Contract Rate - ".
const SURCHARGE_PREFIXES = [
  'Oxygen Charge',
  'Inconvenience Fee',
  'Disposables Charge',
  'Resuscitation Charge',
  'Suction Charge',
  'Overtime (',
  'Waiting Time (',
  'Heavy Lifting Surcharge',
  'Jurong Island Transport Surcharge',
  // Older wording from the seed scripts, which predate the current engine descriptions.
  // Without these three, seeded surcharge rows fall through to the "not a known
  // surcharge, therefore base" rule and an invoice ends up with three base charges.
  'Resuscitation Performed',
  'Suction Performed',
  'Disposables Used',
  'Heavy Patient Lifting Surcharge',
]

async function columnExists() {
  const [rows] = await sequelize.query(`
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'invoice_line_items' AND column_name = 'line_type'
  `)
  return rows.length > 0
}

async function addColumn() {
  if (await columnExists()) return false
  // Sequelize's queryInterface silently no-ops some Postgres DDL, so this is raw and
  // verified below rather than trusted.
  await sequelize.query(`
    DO $$ BEGIN
      CREATE TYPE enum_invoice_line_items_line_type AS ENUM ('base','surcharge','adjustment');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)
  await sequelize.query(`
    ALTER TABLE invoice_line_items
      ADD COLUMN line_type enum_invoice_line_items_line_type NOT NULL DEFAULT 'adjustment'
  `)
  if (!(await columnExists())) {
    throw new Error('ALTER TABLE ran but line_type is still absent - migration aborted.')
  }
  return true
}

async function backfill() {
  // Every row currently defaults to 'adjustment', so only the engine rows need correcting.
  const notLike = SURCHARGE_PREFIXES.map((p) => `description NOT LIKE '${p.replace(/'/g, "''")}%'`).join('\n       AND ')
  const like = SURCHARGE_PREFIXES.map((p) => `description LIKE '${p.replace(/'/g, "''")}%'`).join('\n           OR ')

  const [, surchargeMeta] = await sequelize.query(`
    UPDATE invoice_line_items
       SET line_type = 'surcharge'
     WHERE is_manual_adjustment = false
       AND (${like})
  `)
  const [, baseMeta] = await sequelize.query(`
    UPDATE invoice_line_items
       SET line_type = 'base'
     WHERE is_manual_adjustment = false
       AND ${notLike}
  `)
  return { surcharges: surchargeMeta.rowCount ?? 0, bases: baseMeta.rowCount ?? 0 }
}

async function report() {
  // A priced invoice has exactly one transport charge. More than one means the backfill's
  // description matching missed a surcharge wording and promoted it to base - which would
  // let the approval guard pass on an invoice that has no real base at all.
  const [dupes] = await sequelize.query(`
    SELECT invoice_id, COUNT(*)::int AS n
      FROM invoice_line_items
     WHERE line_type = 'base'
     GROUP BY invoice_id
    HAVING COUNT(*) > 1
     ORDER BY invoice_id
  `)
  if (dupes.length > 0) {
    console.log('\n[migrate] WARNING - invoice(s) with more than one base charge:')
    for (const d of dupes) console.log(`           invoice ${d.invoice_id}: ${d.n} base rows`)
    console.log('           Add the missing surcharge wording to SURCHARGE_PREFIXES and re-run.')
  }

  const [rows] = await sequelize.query(`
    SELECT line_type, COUNT(*)::int AS n FROM invoice_line_items GROUP BY line_type ORDER BY line_type
  `)
  console.log('[migrate] Line items by type:')
  for (const r of rows) console.log(`           ${String(r.line_type).padEnd(11)} ${r.n}`)

  // Invoices that would now be refused approval. Surfaced explicitly because this is a
  // behaviour change: they were approvable before and are not any more.
  const [blocked] = await sequelize.query(`
    SELECT i.id, i.status, i.total_amount
      FROM invoices i
     WHERE NOT EXISTS (
             SELECT 1 FROM invoice_line_items li
              WHERE li.invoice_id = i.id AND li.line_type = 'base'
           )
       AND i.status IN ('matched','adjusted')
     ORDER BY i.id
  `)
  if (blocked.length === 0) {
    console.log('\n[migrate] No pending invoice is missing its base charge.')
  } else {
    console.log(`\n[migrate] ${blocked.length} pending invoice(s) have NO base charge and can no longer be approved:`)
    for (const b of blocked) console.log(`           invoice ${b.id} (${b.status}, total $${Number(b.total_amount).toFixed(2)})`)
    console.log('           Add the base charge or retry matching before approving these.')
  }

  // Already-synced invoices with no base are historical under-billings: the guard cannot
  // undo them, and correcting a document Xero already holds is a credit-note decision.
  const [synced] = await sequelize.query(`
    SELECT i.id, i.total_amount, b.reference_number, b.quoted_base_amount
      FROM invoices i
      LEFT JOIN bookings b ON b.id = i.booking_id
     WHERE NOT EXISTS (
             SELECT 1 FROM invoice_line_items li
              WHERE li.invoice_id = i.id AND li.line_type = 'base'
           )
       AND i.status IN ('approved','synced_to_xero','failed')
     ORDER BY i.id
  `)
  if (synced.length > 0) {
    console.log(`\n[migrate] WARNING - ${synced.length} already-approved/synced invoice(s) have no base charge:`)
    for (const s of synced) {
      const quoted = s.quoted_base_amount === null ? 'n/a' : `$${Number(s.quoted_base_amount).toFixed(2)}`
      console.log(`           invoice ${s.id} (${s.reference_number || 'no booking'}) billed $${Number(s.total_amount).toFixed(2)}, base quoted ${quoted}`)
    }
    console.log('           These predate the guard. Xero is the master ledger - correcting them is a credit-note decision.')
  }
}

async function main() {
  try {
    await sequelize.authenticate()
    const added = await addColumn()
    console.log(added
      ? '[migrate] Added invoice_line_items.line_type.'
      : '[migrate] invoice_line_items.line_type already present - skipped.')

    const { surcharges, bases } = await backfill()
    console.log(`[migrate] Backfilled ${bases} base and ${surcharges} surcharge row(s); manual rows keep 'adjustment'.`)

    await report()
  } catch (err) {
    console.error('[migrate] Failed:', err.message)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}

main()
