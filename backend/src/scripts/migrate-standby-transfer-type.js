// Adds 'standby' to the transfer_type ENUM on both service_memos and pricing_rates.
//
// Background: client feedback item 4 (17 Jul 2026) - manpower-only event/workplace
// standby jobs have no ambulance transfer at all, so ServiceMemo.transfer_type and
// PricingRate.transfer_type now declare a 'standby' value. `sequelize.sync({ alter: true })`
// does not add values to an existing Postgres ENUM type (same class of limitation as
// add-notification-enum-values.js), so a database created before this change needs this
// script run once.
//
// ADD VALUE IF NOT EXISTS is idempotent - safe to run repeatedly, and safe even on an
// environment where db:sync already created the type with 'standby' included from scratch.
//
// Usage:  node src/scripts/migrate-standby-transfer-type.js
require('dotenv').config()
const sequelize = require('../config')

async function main() {
  try {
    console.log('[migrate-standby-transfer-type] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[migrate-standby-transfer-type] Connected.')

    console.log('[migrate-standby-transfer-type] Adding standby to enum_service_memos_transfer_type...')
    await sequelize.query('ALTER TYPE "enum_service_memos_transfer_type" ADD VALUE IF NOT EXISTS \'standby\';')
    console.log('[migrate-standby-transfer-type] Adding standby to enum_pricing_rates_transfer_type...')
    await sequelize.query('ALTER TYPE "enum_pricing_rates_transfer_type" ADD VALUE IF NOT EXISTS \'standby\';')

    console.log('[migrate-standby-transfer-type] Done. \'standby\' is now a valid transfer_type on both tables.')
  } catch (err) {
    console.error('[migrate-standby-transfer-type] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
