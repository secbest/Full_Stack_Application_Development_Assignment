// Idempotent migration: global default surcharge schedule.
//
// Surcharges are published rates, not negotiated ones - EFAR's pricing table lists a
// single rate card for oxygen, inconvenience, disposables, resuscitation, suction,
// waiting time, heavy lifting and Jurong Island. Only the base transport rates vary per
// contract. Until now surcharge_schedules had no way to express that: every row required
// a contract_id, so a booking priced by one-off quotation had NO schedule at all and each
// charge the crew recorded came back unpriced, warning the AR Specialist on every invoice.
//
// This migration:
//   1. relaxes surcharge_schedules.contract_id to allow NULL (NULL = global default), and
//   2. seeds the published rate card as global rows.
//
// Existing per-contract rows are left untouched - they now act as overrides of the
// published rate, which is what a negotiated schedule actually is.
//
// Run: node src/scripts/migrate-default-surcharges.js

require('dotenv').config()
const sequelize = require('../config')
const { SurchargeSchedule } = require('../models')
const { PUBLISHED_SURCHARGE_RATES } = require('../services/surchargeScheduleService')

// Reads the live nullability straight from the catalogue rather than trusting an ORM
// helper. Sequelize's queryInterface.changeColumn resolves successfully here without
// actually dropping the NOT NULL constraint, so an unverified migration reports success
// and then fails at the first insert.
async function isContractIdNullable() {
  const [rows] = await sequelize.query(`
    SELECT is_nullable
      FROM information_schema.columns
     WHERE table_name = 'surcharge_schedules' AND column_name = 'contract_id'
  `)
  if (rows.length === 0) throw new Error('surcharge_schedules.contract_id is missing - run sync-db first.')
  return rows[0].is_nullable === 'YES'
}

async function relaxContractIdNullability() {
  if (await isContractIdNullable()) return false

  await sequelize.query('ALTER TABLE surcharge_schedules ALTER COLUMN contract_id DROP NOT NULL')

  if (!(await isContractIdNullable())) {
    throw new Error('ALTER TABLE ran but contract_id is still NOT NULL - migration aborted before seeding.')
  }
  return true
}

async function seedGlobalDefaults() {
  let created = 0
  let existing = 0
  for (const rate of PUBLISHED_SURCHARGE_RATES) {
    // findOrCreate rather than upsert: if a previous run seeded a rate and someone has
    // since corrected the amount, that correction is deliberate and must survive re-runs.
    const [, wasCreated] = await SurchargeSchedule.findOrCreate({
      where: { contract_id: null, surcharge_type: rate.surcharge_type },
      defaults: { contract_id: null, ...rate },
    })
    if (wasCreated) created += 1
    else existing += 1
  }
  return { created, existing }
}

async function main() {
  try {
    await sequelize.authenticate()

    const relaxed = await relaxContractIdNullability()
    console.log(relaxed
      ? '[migrate] surcharge_schedules.contract_id now allows NULL (global defaults).'
      : '[migrate] surcharge_schedules.contract_id already nullable - skipped.')

    const { created, existing } = await seedGlobalDefaults()
    console.log(`[migrate] Global surcharge defaults: ${created} created, ${existing} already present.`)

    const globals = await SurchargeSchedule.findAll({
      where: { contract_id: null },
      attributes: ['surcharge_type', 'amount'],
      order: [['surcharge_type', 'ASC']],
      raw: true,
    })
    console.log('[migrate] Published rate card now in effect:')
    for (const row of globals) console.log(`           ${row.surcharge_type.padEnd(24)} $${Number(row.amount).toFixed(2)}`)

    console.log('\n[migrate] Done. One-off-quote bookings will now price surcharges from this card.')
  } catch (err) {
    console.error('[migrate] Failed:', err.message)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}

main()
