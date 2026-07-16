// Master demo reset - wipes the database back to a pristine, known demo state so the
// full story (intake -> booking -> memo -> invoice -> Xero, plus the AP vendor-invoice
// flow) can be run start-to-finish in front of an audience, repeatably.
//
// Unlike `npm run db:setup`, this does NOT rely on the idempotent findOrCreate seeds
// leaving prior demo actions in place - it DROPS every table first (sequelize.sync with
// force: true), so a confirmed intake, a submitted memo, or a synced invoice from the
// last run-through is gone and every flow starts fresh again.
//
// DESTRUCTIVE. Guarded so it can't wipe a real database by accident:
//   npm run db:reset -- --yes           (from backend/)
//   node src/scripts/reset-all.js --yes
//   CONFIRM_RESET=1 node src/scripts/reset-all.js
// Without the confirmation flag/env it prints instructions and exits without touching
// anything.
//
// Note: this resets the Postgres data only. Images already uploaded to Cloudinary during
// a demo (memo signatures, hospital stamps, vendor PDFs) are not deleted - they simply
// become orphaned and are harmless. The seed data references its own sample assets.
require('dotenv').config()
const { spawnSync } = require('child_process')
const path = require('path')
const sequelize = require('../config')
require('../models') // register all models + associations so force-sync knows every table

// Same order as package.json's db:setup, minus db:sync (force-sync below replaces it).
// Order matters: users before clients/bookings (created_by), clients before intakes/
// pricing, bookings before memos/invoices, etc.
const SEED_STEPS = [
  'seed-users.js',
  'seed-clients.js',
  'seed-intakes.js',
  'seed-bookings.js',
  'seed-xero.js',
  'seed-pricing.js',
  'seed-sample-vendor-invoice.js',
  'reset-demo-vendor-invoice-sync.js',
]

function isConfirmed() {
  const args = process.argv.slice(2)
  if (args.includes('--yes') || args.includes('-y')) return true
  if (process.env.CONFIRM_RESET === '1') return true
  return false
}

function printUnconfirmed() {
  console.log('')
  console.log('  This will DROP EVERY TABLE and reseed the database from scratch.')
  console.log('  All demo progress (bookings, memos, invoices, Xero syncs) will be lost.')
  console.log('')
  console.log('  Re-run with a confirmation to proceed:')
  console.log('    npm run db:reset -- --yes')
  console.log('    (or)  CONFIRM_RESET=1 npm run db:reset')
  console.log('')
}

async function dropAndRecreate() {
  console.log('[reset-all] Connecting...')
  await sequelize.authenticate()
  console.log('[reset-all] Connected. Dropping and recreating all tables (force sync)...')
  await sequelize.sync({ force: true })
  console.log('[reset-all] Schema rebuilt - all tables are empty.')
  await sequelize.close()
}

function runSeeds() {
  const scriptsDir = __dirname
  for (const step of SEED_STEPS) {
    console.log(`\n[reset-all] ---- ${step} ----`)
    // Spawn each seed as its own node process: every seed script self-runs main() on
    // require and closes the shared sequelize pool in its finally block, so requiring
    // them in-process would tear down the connection for the ones that follow.
    const result = spawnSync(process.execPath, [path.join(scriptsDir, step)], {
      stdio: 'inherit',
      cwd: path.resolve(scriptsDir, '..', '..'), // backend/ so dotenv finds .env
    })
    if (result.status !== 0) {
      console.error(`\n[reset-all] FAILED at ${step} (exit ${result.status}). Aborting - the database is partially seeded.`)
      process.exit(1)
    }
  }
}

async function main() {
  if (!isConfirmed()) {
    printUnconfirmed()
    process.exit(1)
  }

  try {
    await dropAndRecreate()
  } catch (err) {
    console.error('[reset-all] Failed to rebuild schema:', err.message)
    process.exit(1)
  }

  runSeeds()

  console.log('\n========================================================')
  console.log('  Demo database reset complete - pristine and ready.')
  console.log('  Log in at the frontend with password: Efar@2026')
  console.log('    Managing Director   doris@efar.com.sg')
  console.log('    AR Specialist       sarah@efar.com.sg')
  console.log('    AP Specialist       chloe@efar.com.sg')
  console.log('    Quotations          camilla@efar.com.sg')
  console.log('    Field Crew          ravi@efar.com.sg')
  console.log('========================================================\n')
}

main()
