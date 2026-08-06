// Customers no longer choose a service tier on the public intake form. The raw
// intake therefore keeps service_tier null until a Quotations Specialist selects
// the required tier while confirming the booking.
//
// Sequelize sync({ alter: true }) does not reliably remove PostgreSQL NOT NULL
// constraints, so deployment applies this explicit, idempotent schema change.
//
// Usage: npm run db:fix-intake-tier-nullable
require('dotenv').config()
const sequelize = require('../config')

async function main() {
  try {
    console.log('[fix-intake-tier-nullable] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[fix-intake-tier-nullable] Connected.')

    await sequelize.query('ALTER TABLE intake_submissions ALTER COLUMN service_tier DROP NOT NULL;')
    console.log('[fix-intake-tier-nullable] Done. intake_submissions.service_tier is now nullable.')
  } catch (err) {
    console.error('[fix-intake-tier-nullable] Failed:', err.message)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}

main()
