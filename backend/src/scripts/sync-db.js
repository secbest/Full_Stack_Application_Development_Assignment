// Creates (or updates) all Sequelize-managed tables in Supabase.
// Safe to run on a fresh database - will NOT drop existing data.
// Run once before the first `npm start` on a new environment.
//
// Usage:  node src/scripts/sync-db.js
require('dotenv').config()
const sequelize = require('../config')
require('../models') // register all models + associations

async function main() {
  try {
    console.log('[sync-db] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[sync-db] Connected.')

    console.log('[sync-db] Syncing tables (create if not exist, alter columns)...')
    await sequelize.sync({ alter: true })
    console.log('[sync-db] All tables are up to date.')
  } catch (err) {
    console.error('[sync-db] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
