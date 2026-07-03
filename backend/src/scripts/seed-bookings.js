// Seeds a handful of test bookings assigned to Ravi Kumar (field_crew) so the Field
// Operations frontend (My Jobs, Memo Wizard) has real data to work against, without
// waiting on Zheng Bao's intake/booking confirmation flow to be built.
// Requires seed-users.js and seed-clients.js to have run first.
//
// Uses findOrCreate on reference_number - safe to run multiple times.
//
// Usage:  node src/scripts/seed-bookings.js
require('dotenv').config()
const sequelize = require('../config')
const { User, Client, Booking } = require('../models')

async function main() {
  try {
    console.log('[seed-bookings] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[seed-bookings] Connected.')

    const ravi = await User.findOne({ where: { email: 'ravi@efar.com.sg' } })
    const camilla = await User.findOne({ where: { email: 'camilla@efar.com.sg' } })
    const client = await Client.findOne({ where: { contact_email: 'ops@rafflesmedical.com.sg' } })

    if (!ravi || !camilla) {
      console.error('[seed-bookings] Ravi or Camilla not found. Run seed-users.js first.')
      process.exit(1)
    }
    if (!client) {
      console.error('[seed-bookings] Raffles Medical Group client not found. Run seed-clients.js first.')
      process.exit(1)
    }

    const today = new Date().toISOString().slice(0, 10)

    const TEST_BOOKINGS = [
      {
        reference_number: 'BKG-TEST-00001',
        client_id: client.id, created_by: camilla.id, assigned_crew_id: ravi.id,
        service_type: 'eas', service_tier: 'advanced', original_service_tier: null,
        scheduled_date: today, scheduled_time: '09:00',
        pickup_location: 'Raffles Hospital, 585 North Bridge Road, Singapore 188770',
        destination: 'Tan Tock Seng Hospital A&E, 11 Jalan Tan Tock Seng, Singapore 308433',
        status: 'in_progress',
        notes: 'Seed data for memo wizard testing - already in_progress, ready to submit a memo against.',
      },
      {
        reference_number: 'BKG-TEST-00002',
        client_id: client.id, created_by: camilla.id, assigned_crew_id: ravi.id,
        service_type: 'mts', service_tier: 'basic', original_service_tier: null,
        scheduled_date: today, scheduled_time: '15:00',
        pickup_location: 'Raffles Hospital, 585 North Bridge Road, Singapore 188770',
        destination: 'Khoo Teck Puat Hospital, 90 Yishun Central, Singapore 768828',
        status: 'confirmed',
        notes: 'Seed data - upcoming job, not started yet.',
      },
      {
        reference_number: 'BKG-TEST-00003',
        client_id: client.id, created_by: camilla.id, assigned_crew_id: ravi.id,
        service_type: 'eas', service_tier: 'critical', original_service_tier: null,
        scheduled_date: today, scheduled_time: '06:00',
        pickup_location: 'Raffles Hospital, 585 North Bridge Road, Singapore 188770',
        destination: 'National Heart Centre, 5 Hospital Drive, Singapore 169609',
        status: 'completed',
        notes: 'Seed data - completed with no memo submitted (revenue leakage demo case).',
      },
      {
        reference_number: 'BKG-TEST-00004',
        client_id: client.id, created_by: camilla.id, assigned_crew_id: ravi.id,
        service_type: 'eas', service_tier: 'advanced', original_service_tier: null,
        scheduled_date: today, scheduled_time: '11:00',
        pickup_location: 'Raffles Hospital, 585 North Bridge Road, Singapore 188770',
        destination: 'Alexandra Hospital, 378 Alexandra Road, Singapore 159964',
        status: 'invoiced',
        notes: 'Seed data - already invoiced, used to test the BOOKING_ALREADY_INVOICED error path.',
      },
    ]

    for (const booking of TEST_BOOKINGS) {
      const [, created] = await Booking.findOrCreate({
        where: { reference_number: booking.reference_number },
        defaults: booking,
      })
      const tag = created ? '  Created' : 'Skipped (exists)'
      console.log(`[seed-bookings] ${tag}: ${booking.reference_number}  (${booking.status})`)
    }

    console.log('\n[seed-bookings] Done.')
    console.log('  in_progress (ready for memo wizard): BKG-TEST-00001')
    console.log('  confirmed (upcoming, not started):   BKG-TEST-00002')
    console.log('  completed, no memo (leakage demo):   BKG-TEST-00003')
    console.log('  invoiced (error-path test):          BKG-TEST-00004')
  } catch (err) {
    console.error('[seed-bookings] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
