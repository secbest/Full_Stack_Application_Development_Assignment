// Seeds sample bookings into Supabase:
//   1. BKG-TEST-* - a handful of test bookings assigned to Ravi Kumar (field_crew) so the
//      Field Operations frontend (My Jobs, Memo Wizard) has real data to work against.
//      Requires seed-users.js and seed-clients.js to have run first.
//      BKG-TEST-00005 is a manpower-only event standby (client feedback item 4), and
//      BKG-TEST-00001 also gets its first two job milestones (client feedback item 1)
//      so the My Jobs hero card opens mid-job.
//   2. BKG-2026-* - bookings linked to the confirmed intake submissions created by
//      seed-intakes.js, so the Quotations Specialist's Booking List has real data
//      with a working intake link. Requires seed-users.js, seed-clients.js, and
//      seed-intakes.js to have run first.
//
// Uses findOrCreate on reference_number - safe to run multiple times.
//
// Usage:  node src/scripts/seed-bookings.js
require('dotenv').config()
const sequelize = require('../config')
const { User, Client, IntakeSubmission, Booking, JobMilestone } = require('../models')

async function seedFieldOpsTestBookings({ ravi, camilla }) {
  const client = await Client.findOne({ where: { contact_email: 'ops@rafflesmedical.com.sg' } })
  if (!client) {
    console.error('[seed-bookings] Raffles Medical Group client not found. Run seed-clients.js first. Skipping BKG-TEST-* bookings.')
    return
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
    {
      // Client feedback item 4 (17 Jul 2026): "sometimes we also have events whereby
      // there is no ambulance at all, we just have to dispatch crew, like manpower."
      // Demo case for a memo with no patient and no hospital destination.
      reference_number: 'BKG-TEST-00005',
      client_id: client.id, created_by: camilla.id, assigned_crew_id: ravi.id,
      service_type: 'event_standby', service_tier: 'basic', original_service_tier: null,
      // Deliberately LATER in the day than BKG-TEST-00001 (09:00). My Jobs promotes the
      // earliest in_progress job to the hero card, so an earlier time here would push
      // the milestone-seeded booking below and leave the hero with an empty stepper.
      // At 14:00 the hero stays on 00001 while this one sits in "Upcoming jobs" - still
      // in_progress, so its Create Memo button reaches the standby wizard directly.
      scheduled_date: today, scheduled_time: '14:00',
      pickup_location: 'Singapore Sports Hub, 1 Stadium Drive, Singapore 397629',
      destination: 'Singapore Sports Hub, 1 Stadium Drive, Singapore 397629',
      status: 'in_progress',
      notes: 'Seed data - manpower-only event standby (no ambulance, no patient). Demo case for the memo wizard\'s optional patient fields.',
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

  await seedMilestones({ ravi })
}

// Client feedback item 1 (17 Jul 2026): the crew records five job milestones live.
// Seeds the first two against the in_progress demo booking so the My Jobs hero card
// opens mid-job (two stages done, "On the way" as the next tap target) instead of
// needing someone to tap twice before the screen looks realistic.
async function seedMilestones({ ravi }) {
  const booking = await Booking.findOne({ where: { reference_number: 'BKG-TEST-00001' } })
  if (!booking) {
    console.error('[seed-bookings] BKG-TEST-00001 not found - skipping milestone seed.')
    return
  }

  // Anchored to the booking's own scheduled date so the timestamps stay plausible
  // relative to the job rather than drifting to whenever the seed was last run.
  const base = new Date(`${booking.scheduled_date}T09:00:00`)
  const MILESTONES = [
    { milestone_type: 'activated',           offsetMinutes: 0 },
    { milestone_type: 'arrived_at_location', offsetMinutes: 18 },
  ]

  for (const m of MILESTONES) {
    const [, created] = await JobMilestone.findOrCreate({
      where: { booking_id: booking.id, milestone_type: m.milestone_type },
      defaults: {
        booking_id: booking.id,
        milestone_type: m.milestone_type,
        recorded_at: new Date(base.getTime() + m.offsetMinutes * 60_000),
        recorded_by: ravi.id,
      },
    })
    const tag = created ? '  Created' : 'Skipped (exists)'
    console.log(`[seed-bookings] ${tag}: milestone ${m.milestone_type} on ${booking.reference_number}`)
  }
}

async function seedIntakeLinkedBookings({ ravi, camilla }) {
  const ttsh = await Client.findOne({ where: { contact_email: 'ops@ttsh.com.sg' } })
  if (!ttsh) {
    console.error('[seed-bookings] Tan Tock Seng Hospital client not found. Run seed-clients.js first. Skipping BKG-2026-* bookings.')
    return
  }

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
}

async function main() {
  try {
    console.log('[seed-bookings] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[seed-bookings] Connected.')

    const ravi = await User.findOne({ where: { email: 'ravi@efar.com.sg' } })
    const camilla = await User.findOne({ where: { email: 'camilla@efar.com.sg' } })
    if (!ravi || !camilla) {
      console.error('[seed-bookings] Ravi or Camilla not found. Run seed-users.js first.')
      process.exit(1)
    }

    await seedFieldOpsTestBookings({ ravi, camilla })
    await seedIntakeLinkedBookings({ ravi, camilla })

    console.log('\n[seed-bookings] Done.')
  } catch (err) {
    console.error('[seed-bookings] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
