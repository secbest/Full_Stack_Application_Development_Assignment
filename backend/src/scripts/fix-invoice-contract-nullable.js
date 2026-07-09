// Drops the stale NOT NULL constraint on invoices.contract_id.
//
// Background: the Invoice model (src/models/Invoice.js) declares contract_id as
// nullable so that 'unmatched' invoices - created when a client has no active
// pricing contract, or no rate row matches the memo - can be saved with a null
// contract_id. The column was originally created NOT NULL, and `sync({ alter: true })`
// does not reliably drop NOT NULL constraints in Postgres, so approving such a memo
// fails with: null value in column "contract_id" ... violates not-null constraint.
//
// This script applies the fix explicitly. It is idempotent - safe to run repeatedly.
//
// Usage:  node src/scripts/fix-invoice-contract-nullable.js
require('dotenv').config()
const sequelize = require('../config')

async function main() {
  try {
    console.log('[fix-invoice-contract-nullable] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[fix-invoice-contract-nullable] Connected.')

    // DROP NOT NULL is a no-op if the column is already nullable, so this is idempotent.
    console.log('[fix-invoice-contract-nullable] Dropping NOT NULL on invoices.contract_id...')
    await sequelize.query('ALTER TABLE invoices ALTER COLUMN contract_id DROP NOT NULL;')
    console.log('[fix-invoice-contract-nullable] Done. contract_id is now nullable.')
  } catch (err) {
    console.error('[fix-invoice-contract-nullable] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
