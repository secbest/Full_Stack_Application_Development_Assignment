// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper (design/jasper/).
//
// Seeds the AR pricing foundation + a populated memo-review queue so the Wave 3
// AR flow (memo approve -> pricing engine -> invoice -> Xero sync) is demoable end-to-end:
//   1. An active pricing contract for Tan Tock Seng Hospital, with rate rows and the
//      full surcharge schedule (rates from the published EFAR pricing schedule).
//   2. Submitted service memos on existing completed TTSH bookings -> these populate
//      Sarah's Memo Review Queue and produce 'matched' invoices when approved.
//   3. A submitted memo on a completed Raffles booking (no contract) -> exercises the
//      NO_ACTIVE_CONTRACT / 'unmatched' path.
//
// Uses findOrCreate - safe to run multiple times.
// Run seed-users.js, seed-clients.js, seed-intakes.js, seed-bookings.js first.
//
// Usage:  node src/scripts/seed-pricing.js
require('dotenv').config()
const sequelize = require('../config')
const {
  User, Client, Booking, ServiceMemo, MemoSignature,
  PricingContract, PricingRate, SurchargeSchedule,
} = require('../models')

// Published surcharge schedule defaults (design/jasper/database-schema.md).
// Also duplicated (independently, not via a shared import - Node backend and Vite
// frontend don't share a module system) in frontend/src/lib/contractLabels.js's
// SURCHARGE_DEFAULT_AMOUNTS, which pre-fills the create-contract form's surcharge
// section. If you change a published figure here, check that file too.
const SURCHARGES = [
  { surcharge_type: 'oxygen_base', amount: 50.00 },
  { surcharge_type: 'oxygen_per_litre', amount: 1.00 },
  { surcharge_type: 'inconvenience_fee', amount: 50.00 },
  { surcharge_type: 'disposables_base', amount: 20.00 },
  { surcharge_type: 'resuscitation', amount: 320.00 },
  { surcharge_type: 'suction', amount: 50.00 },
  { surcharge_type: 'waiting_time_per_30min', amount: 30.00 },
  { surcharge_type: 'heavy_lifting_min', amount: 50.00 },
  { surcharge_type: 'heavy_lifting_max', amount: 150.00 },
  { surcharge_type: 'jurong_island_min', amount: 150.00 },
  { surcharge_type: 'jurong_island_max', amount: 200.00 },
  { surcharge_type: 'cancellation', amount: 100.00 },
]

const RATES = [
  { service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: 850.00 },
  { service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'non_office_hours', base_amount: 950.00 },
  { service_type: 'eas', transfer_type: 'two_way_hospital', time_of_day: 'office_hours', base_amount: 1200.00 },
  { service_type: 'eas', transfer_type: 'two_way_hospital', time_of_day: 'non_office_hours', base_amount: 1350.00 },
  { service_type: 'eas', transfer_type: 'covid_19', time_of_day: 'all_hours', base_amount: 1100.00 },
  { service_type: 'eas', transfer_type: 'airport_with_tarmac', time_of_day: 'all_hours', base_amount: 1500.00 },
  { service_type: 'mts', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: 450.00 },
  { service_type: 'mts', transfer_type: 'sg_jb_ground', time_of_day: 'all_hours', base_amount: 1800.00 },
]

async function seedContract(client, sarah) {
  const [contract, created] = await PricingContract.findOrCreate({
    where: { client_id: client.id, contract_name: `${client.name} - FY2026 Service Agreement` },
    defaults: {
      client_id: client.id,
      created_by: sarah.id,
      contract_name: `${client.name} - FY2026 Service Agreement`,
      effective_from: '2026-01-01',
      effective_to: '2026-12-31',
      is_active: true,
    },
  })
  console.log(`[seed-pricing] ${created ? '  Created' : 'Skipped (exists)'}: contract #${contract.id} (${client.name})`)

  for (const r of RATES) {
    await PricingRate.findOrCreate({
      where: { contract_id: contract.id, service_type: r.service_type, transfer_type: r.transfer_type, time_of_day: r.time_of_day },
      defaults: { ...r, contract_id: contract.id },
    })
  }
  for (const s of SURCHARGES) {
    await SurchargeSchedule.findOrCreate({
      where: { contract_id: contract.id, surcharge_type: s.surcharge_type },
      defaults: { ...s, contract_id: contract.id },
    })
  }
  console.log(`[seed-pricing]   ${RATES.length} rates + ${SURCHARGES.length} surcharges ensured on contract #${contract.id}`)
  return contract
}

// Creates a submitted memo (+ waived signature) on a booking if none exists yet.
async function seedMemo(referenceNumber, ravi, memoFields) {
  const booking = await Booking.findOne({ where: { reference_number: referenceNumber } })
  if (!booking) {
    console.error(`[seed-pricing] Booking ${referenceNumber} not found - skipping memo. Run seed-bookings.js first.`)
    return
  }

  const existing = await ServiceMemo.findOne({ where: { booking_id: booking.id } })
  if (existing) {
    console.log(`[seed-pricing] Skipped (exists): memo for ${referenceNumber}`)
    return
  }

  const day = booking.scheduled_date
  const memo = await ServiceMemo.create({
    booking_id: booking.id,
    submitted_by: ravi.id,
    job_start_time: new Date(`${day}T08:00:00.000Z`),
    job_end_time: new Date(`${day}T10:00:00.000Z`),
    overtime_hours: 0,
    evacuation_floors: memoFields.evacuation_floors || 0,
    patient_name: memoFields.patient_name,
    hospital_destination: booking.destination,
    service_type: memoFields.service_type,
    transfer_type: memoFields.transfer_type,
    is_office_hours: memoFields.is_office_hours,
    oxygen_litres_used: memoFields.oxygen_litres_used || 0,
    has_inconvenience_fee: memoFields.has_inconvenience_fee || false,
    disposables_used: memoFields.disposables_used || false,
    resuscitation_performed: memoFields.resuscitation_performed || false,
    suction_performed: memoFields.suction_performed || false,
    waiting_time_minutes: memoFields.waiting_time_minutes || 0,
    patient_weight_kg: memoFields.patient_weight_kg || null,
    is_jurong_island: memoFields.is_jurong_island || false,
    status: 'submitted',
  })
  await MemoSignature.create({
    memo_id: memo.id,
    signer_name: memoFields.patient_name,
    signature_image_url: null,
    signed_at: new Date(`${day}T10:05:00.000Z`),
    is_waived: true,
    waiver_reason: 'Seed data - signature waived for demo.',
  })
  console.log(`[seed-pricing]   Created: submitted memo #${memo.id} on ${referenceNumber} (${memoFields.service_type}/${memoFields.transfer_type})`)
}

async function main() {
  try {
    console.log('[seed-pricing] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[seed-pricing] Connected.')

    const sarah = await User.findOne({ where: { role: 'ar_specialist' } })
    const ravi = await User.findOne({ where: { role: 'field_crew' } })
    if (!sarah || !ravi) throw new Error('AR specialist / field crew user not found - run seed-users.js first.')

    const ttsh = await Client.findOne({ where: { contact_email: 'ops@ttsh.com.sg' } })
    if (!ttsh) throw new Error('Tan Tock Seng Hospital client not found - run seed-clients.js first.')

    await seedContract(ttsh, sarah)

    // Matched-invoice cases on TTSH completed bookings.
    await seedMemo('BKG-2026-00001', ravi, {
      patient_name: 'Tan Wei Ming', service_type: 'eas', transfer_type: 'one_way_hospital',
      is_office_hours: true, oxygen_litres_used: 12, has_inconvenience_fee: true, evacuation_floors: 3,
    })
    await seedMemo('BKG-2026-00002', ravi, {
      patient_name: 'Lim Hui Fen', service_type: 'eas', transfer_type: 'one_way_hospital',
      is_office_hours: false, resuscitation_performed: true, waiting_time_minutes: 65, patient_weight_kg: 95,
    })
    await seedMemo('BKG-2026-00003', ravi, {
      patient_name: 'Kumar S/O Raj', service_type: 'eas', transfer_type: 'covid_19',
      is_office_hours: true, disposables_used: true, suction_performed: true,
    })

    // Unmatched case: Raffles has no pricing contract.
    await seedMemo('BKG-TEST-00003', ravi, {
      patient_name: 'Demo Unmatched Patient', service_type: 'eas', transfer_type: 'one_way_hospital',
      is_office_hours: true,
    })

    console.log('\n[seed-pricing] Done.')
  } catch (err) {
    console.error('[seed-pricing] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
