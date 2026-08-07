// Adds 'job_assigned', 'memo_returned', and 'job_rejected' to the notifications.type ENUM.
//
// Background: the Notification model (src/models/Notification.js) now declares these
// two additional ENUM values, but `sequelize.sync({ alter: true })` does not add values
// to an existing Postgres ENUM type - see backend/src/scripts/fix-invoice-contract-nullable.js
// for the same class of limitation with NOT NULL constraints. Without this script,
// inserting a notification with either new type fails with an invalid-input-value error
// that notificationService.create() swallows silently (by design - see notificationService.js),
// so the failure would otherwise be invisible.
//
// ADD VALUE IF NOT EXISTS is idempotent - safe to run repeatedly, and safe even on an
// environment where db:sync already created the type with these values from scratch.
//
// Usage:  node src/scripts/add-notification-enum-values.js
require('dotenv').config()
const sequelize = require('../config')

async function main() {
  try {
    console.log('[add-notification-enum-values] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[add-notification-enum-values] Connected.')

    console.log('[add-notification-enum-values] Adding job_assigned...')
    await sequelize.query('ALTER TYPE "enum_notifications_type" ADD VALUE IF NOT EXISTS \'job_assigned\';')
    console.log('[add-notification-enum-values] Adding memo_returned...')
    await sequelize.query('ALTER TYPE "enum_notifications_type" ADD VALUE IF NOT EXISTS \'memo_returned\';')
    console.log('[add-notification-enum-values] Adding job_rejected...')
    await sequelize.query('ALTER TYPE "enum_notifications_type" ADD VALUE IF NOT EXISTS \'job_rejected\';')

    console.log('[add-notification-enum-values] Done. All values are now valid.')
  } catch (err) {
    console.error('[add-notification-enum-values] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
