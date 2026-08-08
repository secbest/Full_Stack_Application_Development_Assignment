// Idempotent migration: let a revenue-leakage row be acknowledged and closed.
//
// Why: the leakage report could only ever accumulate. Once a charge went unbilled it
// stayed on the report for good, because nothing could record the decision a human had
// already made about it. That is fine for a gap that is still recoverable, and wrong for
// one that is not - an invoice already issued to a customer through Xero cannot be
// silently re-priced (EFAR is pre-accounting; Xero is the master ledger), so the only
// honest resolutions are "we billed the difference separately" or "we are writing it off".
// Neither could be expressed, so the total drifted further from reality every month and
// the report became easy to ignore - the failure mode that matters most for a report whose
// entire job is to be acted on.
//
// Why on `invoices` and not `bookings`: Booking already carries an unused
// leakage_dismissed_at / leakage_dismissed_reason pair, added speculatively and never read
// or written by any code path. Leakage is an INVOICE-level fact - `unpriced_surcharges`
// lives on invoices, and the report is keyed by invoice_id - so the dismissal belongs
// beside the data it closes out. The dead Booking columns are deliberately left alone
// rather than repurposed; removing them is a separate cleanup.
//
// Adds a `_by` actor alongside the timestamp and reason. A write-off with no attributable
// author is not an audit trail, and this is the one action in the report that decides
// money will not be collected.
//
// Run: node src/scripts/migrate-leakage-dismissal.js
//  or: npm run db:migrate:leakage-dismissal

require('dotenv').config()
const sequelize = require('../config')

const COLUMNS = [
  { name: 'leakage_dismissed_at',     ddl: 'TIMESTAMP WITH TIME ZONE' },
  { name: 'leakage_dismissed_reason', ddl: 'TEXT' },
  { name: 'leakage_dismissed_by',     ddl: 'INTEGER REFERENCES users(id)' },
]

async function columnExists(name) {
  const [rows] = await sequelize.query(`
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'invoices' AND column_name = '${name}'
  `)
  return rows.length > 0
}

async function addColumns() {
  const added = []
  for (const column of COLUMNS) {
    if (await columnExists(column.name)) continue
    // Raw DDL, then re-read information_schema to confirm: queryInterface.addColumn can
    // resolve successfully here without the column actually appearing, which reports a
    // false success (same reason as migrate-default-surcharges.js).
    await sequelize.query(`ALTER TABLE invoices ADD COLUMN ${column.name} ${column.ddl}`)
    if (!(await columnExists(column.name))) {
      throw new Error(`ALTER TABLE ran but ${column.name} is still absent - migration aborted.`)
    }
    added.push(column.name)
  }
  return added
}

async function main() {
  try {
    await sequelize.authenticate()
    console.log('[migrate-leakage-dismissal] Connected.')

    const added = await addColumns()
    if (added.length) {
      console.log(`[migrate-leakage-dismissal] Added: ${added.join(', ')}`)
    } else {
      console.log('[migrate-leakage-dismissal] All columns already present - nothing to do.')
    }

    // No backfill. Every existing leakage row is by definition undismissed, which is
    // exactly what NULL means here - writing a value would invent a decision nobody made.
    const [[{ count }]] = await sequelize.query(`
      SELECT COUNT(*)::int AS count FROM invoices WHERE leakage_dismissed_at IS NOT NULL
    `)
    console.log(`[migrate-leakage-dismissal] Dismissed rows: ${count}.`)
    console.log('[migrate-leakage-dismissal] Done.')
  } catch (err) {
    console.error('[migrate-leakage-dismissal] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
