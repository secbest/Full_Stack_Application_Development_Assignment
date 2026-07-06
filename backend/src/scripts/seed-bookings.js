// Seeds sample bookings into Supabase, linked to the confirmed intake submissions
// created by seed-intakes.js. Requires seed-users.js, seed-clients.js, and
// seed-intakes.js to have run first (client_id / created_by / assigned_crew_id /
// intake_submission_id FKs reference their real IDs).
//
// Uses findOrCreate on reference_number - safe to run multiple times.
//
// Usage:  node src/scripts/seed-bookings.js
require('dotenv').config()
const sequelize = require('../config')
const { User, Client, IntakeSubmission, Booking } = require('../models')

async function main() {
  try {
    console.log('[seed-bookings] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[seed-bookings] Connected.')

    // IDs are not fixed - look them up rather than hardcoding them.
    const camilla = await User.findOne({ where: { email: 'camilla@efar.com.sg' } })
    if (!camilla) {
      console.error('[seed-bookings] Camilla not found. Run seed-users.js first.')
      process.exit(1)
    }
    const ravi = await User.findOne({ where: { email: 'ravi@efar.com.sg' } })
    if (!ravi) {
      console.error('[seed-bookings] Ravi not found. Run seed-users.js first.')
      process.exit(1)
    }
    const ttsh = await Client.findOne({ where: { contact_email: 'ops@ttsh.com.sg' } })
    if (!ttsh) {
      console.error('[seed-bookings] Tan Tock Seng Hospital client not found. Run seed-clients.js first.')
      process.exit(1)
    }
    console.log(`[seed-bookings] Found Camilla (user id ${camilla.id}), Ravi (user id ${ravi.id}), TTSH (client id ${ttsh.id}).`)

    // Only intakes already 'confirmed' by seed-intakes.js get a matching booking -
    // pending/rejected intakes should not have bookings yet.
    const BOOKINGS = [
      {
        reference_number: 'BKG-2026-00001',
        intake_reference: 'EFAR-2026-00003',
        status: 'completed',
      },
      {
        reference_number: 'BKG-2026-00002',
        intake_reference: 'EFAR-2026-00004',
        status: 'completed',
        original_service_tier: 'basic', // audit trail: customer originally selected basic
        notes: 'Tier upgraded from Basic to Advanced at review - patient condition warranted monitoring.',
      },
      {
        reference_number: 'BKG-2026-00003',
        intake_reference: 'EFAR-2026-00005',
        status: 'completed',
        notes: 'COVID-19 positive patient. Full PPE protocol activated.',
      },
      {
        reference_number: 'BKG-2026-00004',
        intake_reference: 'EFAR-2026-00006',
        status: 'completed',
        notes: 'Repatriation case. Tarmac access pass pre-arranged with airport ops.',
      },
    ]

    for (const b of BOOKINGS) {
      const intake = await IntakeSubmission.findOne({ where: { reference_number: b.intake_reference } })
      if (!intake) {
        console.error(`[seed-bookings] Intake ${b.intake_reference} not found. Run seed-intakes.js first. Skipping ${b.reference_number}.`)
        continue
      }

      const [, created] = await Booking.findOrCreate({
        where: { reference_number: b.reference_number },
        defaults: {
          reference_number: b.reference_number,
          intake_submission_id: intake.id,
          client_id: ttsh.id,
          created_by: camilla.id,
          assigned_crew_id: ravi.id,
          service_type: intake.service_type,
          service_tier: intake.service_tier,
          original_service_tier: b.original_service_tier || null,
          scheduled_date: intake.preferred_date,
          scheduled_time: intake.preferred_time,
          pickup_location: intake.pickup_location,
          destination: intake.destination,
          status: b.status,
          notes: b.notes || null,
        },
      })
      const tag = created ? '  Created' : 'Skipped (exists)'
      console.log(`[seed-bookings] ${tag}: ${b.reference_number}  <- ${b.intake_reference}`)
    }

    console.log('\n[seed-bookings] Done.')
  } catch (err) {
    console.error('[seed-bookings] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
