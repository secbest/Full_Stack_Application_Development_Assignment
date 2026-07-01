// Seeds sample intake_submissions into Supabase so Camilla (Quotations Specialist)
// has a populated queue to work from. Requires seed-users.js to have run first
// (reviewed_by FK references Camilla's real user ID).
//
// Uses findOrCreate on reference_number - safe to run multiple times.
//
// Usage:  node src/scripts/seed-intakes.js
require('dotenv').config()
const sequelize = require('../config')
const { User, IntakeSubmission } = require('../models')

async function main() {
  try {
    console.log('[seed-intakes] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[seed-intakes] Connected.')

    // Camilla's user ID is not fixed - look it up rather than hardcoding it.
    const camilla = await User.findOne({ where: { email: 'camilla@efar.com.sg' } })
    if (!camilla) {
      console.error('[seed-intakes] Camilla not found. Run seed-users.js first.')
      process.exit(1)
    }
    const camillaId = camilla.id
    console.log(`[seed-intakes] Found Camilla (user id ${camillaId}).`)

    const now = new Date()
    // A date in the past used for confirmed/rejected records
    const d = (iso) => new Date(iso)

    const INTAKE_SUBMISSIONS = [
      // ── Pending (Camilla's live queue) ──────────────────────────────────────
      {
        reference_number: 'EFAR-2026-00001',
        customer_name: 'Wei Lin Tan',
        organisation: 'Tan Tock Seng Hospital',
        contact_email: 'weiling.tan@ttsh.com.sg',
        contact_phone: '64501234',
        service_type: 'eas',
        service_tier: 'advanced',
        preferred_date: '2026-07-10',
        preferred_time: '14:00',
        pickup_location: 'Tan Tock Seng Hospital, Ward 5B, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'National University Hospital, 5 Lower Kent Ridge Road, Singapore 119074',
        additional_notes: 'Patient is on supplemental oxygen. Requires monitoring throughout transfer.',
        status: 'pending',
        rejection_reason: null, reviewed_by: null, reviewed_at: null,
        created_at: d('2026-07-08T09:20:00.000Z'), updated_at: d('2026-07-08T09:20:00.000Z'),
      },
      {
        reference_number: 'EFAR-2026-00002',
        customer_name: 'Marcus Lim',
        organisation: 'ABC Corporation',
        contact_email: 'marcus.lim@abc-corp.com.sg',
        contact_phone: '65432100',
        service_type: 'event_standby',
        service_tier: 'basic',
        preferred_date: '2026-08-15',
        preferred_time: '08:00',
        pickup_location: 'ABC Corporation HQ, 10 Anson Road, Singapore 079903',
        destination: 'Nearest A&E (if activated)',
        additional_notes: 'Annual company sports day. Approx 200 participants. Request standby from 0800-1700.',
        status: 'pending',
        rejection_reason: null, reviewed_by: null, reviewed_at: null,
        created_at: d('2026-07-09T14:05:00.000Z'), updated_at: d('2026-07-09T14:05:00.000Z'),
      },

      // ── Confirmed (historical) ───────────────────────────────────────────────
      {
        reference_number: 'EFAR-2026-00003',
        customer_name: 'Dr. Priya Nair',
        organisation: 'Tan Tock Seng Hospital',
        contact_email: 'priya.nair@ttsh.com.sg',
        contact_phone: '64501111',
        service_type: 'eas',
        service_tier: 'advanced',
        preferred_date: '2026-06-10',
        preferred_time: '09:00',
        pickup_location: 'Tan Tock Seng Hospital, Ward 5B, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'National University Hospital, 5 Lower Kent Ridge Road, Singapore 119074',
        additional_notes: null,
        status: 'confirmed',
        rejection_reason: null, reviewed_by: camillaId, reviewed_at: d('2026-06-08T10:00:00.000Z'),
        created_at: d('2026-06-07T16:30:00.000Z'), updated_at: d('2026-06-08T10:00:00.000Z'),
      },
      {
        reference_number: 'EFAR-2026-00004',
        customer_name: 'Siti Rahimah',
        organisation: 'Tan Tock Seng Hospital',
        contact_email: 'siti.r@ttsh.com.sg',
        contact_phone: '64502222',
        service_type: 'eas',
        service_tier: 'basic',
        preferred_date: '2026-06-11',
        preferred_time: '22:00',
        pickup_location: 'Tan Tock Seng Hospital, A&E, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'Khoo Teck Puat Hospital, 90 Yishun Central, Singapore 768828',
        additional_notes: 'Patient requiring oxygen support. Floor access at destination.',
        status: 'confirmed',
        rejection_reason: null, reviewed_by: camillaId, reviewed_at: d('2026-06-10T08:30:00.000Z'),
        created_at: d('2026-06-09T20:00:00.000Z'), updated_at: d('2026-06-10T08:30:00.000Z'),
      },
      {
        reference_number: 'EFAR-2026-00005',
        customer_name: 'Ahmad Fauzi',
        organisation: 'Tan Tock Seng Hospital',
        contact_email: 'ahmad.fauzi@ttsh.com.sg',
        contact_phone: '64503333',
        service_type: 'eas',
        service_tier: 'critical',
        preferred_date: '2026-06-13',
        preferred_time: '11:00',
        pickup_location: 'Tan Tock Seng Hospital, Isolation Ward, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'National Centre for Infectious Diseases, 16 Jalan Tan Tock Seng, Singapore 308442',
        additional_notes: 'COVID-19 positive patient. Full PPE required.',
        status: 'confirmed',
        rejection_reason: null, reviewed_by: camillaId, reviewed_at: d('2026-06-12T09:00:00.000Z'),
        created_at: d('2026-06-11T17:00:00.000Z'), updated_at: d('2026-06-12T09:00:00.000Z'),
      },
      {
        reference_number: 'EFAR-2026-00006',
        customer_name: 'Chen Wei',
        organisation: 'Tan Tock Seng Hospital',
        contact_email: 'chen.wei@ttsh.com.sg',
        contact_phone: '64504444',
        service_type: 'mts',
        service_tier: 'advanced',
        preferred_date: '2026-06-14',
        preferred_time: '07:30',
        pickup_location: 'Changi Airport Terminal 3 Tarmac, Singapore 819663',
        destination: 'Jurong Island Medical Centre, Jurong Island, Singapore',
        additional_notes: 'Repatriation case from inbound flight. Tarmac access required. Jurong Island destination.',
        status: 'confirmed',
        rejection_reason: null, reviewed_by: camillaId, reviewed_at: d('2026-06-13T11:00:00.000Z'),
        created_at: d('2026-06-12T22:00:00.000Z'), updated_at: d('2026-06-13T11:00:00.000Z'),
      },

      // ── Rejected (historical) ────────────────────────────────────────────────
      {
        reference_number: 'EFAR-2026-00009',
        customer_name: 'James Wong',
        organisation: null,
        contact_email: 'james.wong@personal.com',
        contact_phone: '91112222',
        service_type: 'mts',
        service_tier: 'basic',
        preferred_date: '2026-06-20',
        preferred_time: '10:00',
        pickup_location: 'Johor Bahru City Square, Malaysia',
        destination: 'Singapore General Hospital, Outram Road, Singapore 169608',
        additional_notes: null,
        status: 'rejected',
        rejection_reason: 'Pickup location is outside EFAR service area. EFAR covers Singapore territory only.',
        reviewed_by: camillaId, reviewed_at: d('2026-06-18T14:30:00.000Z'),
        created_at: d('2026-06-17T11:00:00.000Z'), updated_at: d('2026-06-18T14:30:00.000Z'),
      },
      {
        reference_number: 'EFAR-2026-00010',
        customer_name: 'Nurul Huda',
        organisation: 'Parkway Pantai',
        contact_email: 'nurul.h@parkwaypantai.com',
        contact_phone: '67891011',
        service_type: 'eas',
        service_tier: 'basic',
        preferred_date: '2026-06-28',
        preferred_time: '07:00',
        pickup_location: 'Mount Elizabeth Hospital, 3 Mount Elizabeth, Singapore 228510',
        destination: 'Raffles Hospital, 585 North Bridge Road, Singapore 188770',
        additional_notes: 'Early morning transfer required before 0900.',
        status: 'rejected',
        rejection_reason: 'No crew available on the requested date. Please contact us to arrange an alternative date.',
        reviewed_by: camillaId, reviewed_at: d('2026-06-20T09:00:00.000Z'),
        created_at: d('2026-06-19T17:30:00.000Z'), updated_at: d('2026-06-20T09:00:00.000Z'),
      },
    ]

    for (const intake of INTAKE_SUBMISSIONS) {
      const [, created] = await IntakeSubmission.findOrCreate({
        where: { reference_number: intake.reference_number },
        defaults: intake,
      })
      const tag = created ? '  Created' : 'Skipped (exists)'
      console.log(`[seed-intakes] ${tag}: ${intake.reference_number}  (${intake.status})`)
    }

    console.log('\n[seed-intakes] Done.')
    console.log('  Pending in Camilla\'s queue: EFAR-2026-00001, EFAR-2026-00002')
    console.log('  Confirmed (historical):      EFAR-2026-00003 to 00006')
    console.log('  Rejected (historical):       EFAR-2026-00009, EFAR-2026-00010')
  } catch (err) {
    console.error('[seed-intakes] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
