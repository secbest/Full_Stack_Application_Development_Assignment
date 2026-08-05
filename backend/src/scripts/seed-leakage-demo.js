// Owner: Kwan Hua.
// Demo data for the Revenue Leakage report (GET /api/dashboard/revenue-leakage).
//
// The seeded pricing contract prices every surcharge, which is correct - but it means no
// invoice ever records an unpriced charge, so the leakage report has nothing to show and
// the feature cannot be demonstrated. This script creates a realistic gap:
//
//   1. A client on a contract that is DELIBERATELY missing three surcharge rates
//      (overtime_per_hour, oxygen_per_litre, waiting_time_per_30min).
//   2. Three booking -> memo -> invoice chains against that contract whose memos recorded
//      exactly those charges, so the pricing engine had to report them as unpriced.
//
// The report then says: this contract is missing 3 rates and is costing roughly $X across
// 3 invoices. Every figure it shows is estimated from the OTHER contracts' rates, which is
// the point of the peer-median basis - these charges have no contracted rate by definition.
//
// The memos carry the same surcharge values the unpriced entries describe, so the demo is
// internally consistent: re-running the pricing engine on them would produce these gaps.
//
// Idempotent: keyed on booking reference_number, so re-running skips what exists.
//
// Usage:  node src/scripts/seed-leakage-demo.js
//         npm run db:seed:leakage
require('dotenv').config()
const sequelize = require('../config')
const {
  User, Client, Booking, ServiceMemo, PricingContract, PricingRate, SurchargeSchedule,
  Invoice, InvoiceLineItem,
} = require('../models')
const { round2 } = require('../utils/money')

const CLIENT_NAME = 'Sembawang Marine Services'
const CLIENT_EMAIL = 'accounts@sembawangmarine.com.sg'
const CONTRACT_NAME = 'Sembawang Marine 2026 (incomplete surcharge schedule)'
const BASE_AMOUNT = 850.0

// Priced on this contract. overtime_per_hour, oxygen_per_litre and waiting_time_per_30min
// are conspicuously absent - that absence is the demo.
const PRICED_SURCHARGES = [
  { surcharge_type: 'oxygen_base', amount: 45.0 },
  { surcharge_type: 'inconvenience_fee', amount: 50.0 },
  { surcharge_type: 'disposables_base', amount: 25.0 },
]

// `memo` holds what the crew recorded; `unpriced` mirrors exactly what
// pricingService.buildSurchargeLineItems() writes when the contract cannot price it,
// including the numeric `quantity` the leakage report values the gap with.
const JOBS = [
  {
    ref: 'BK-LEAK-0001',
    memo: { overtime_hours: 6, oxygen_litres_used: 18, waiting_time_minutes: 0, has_inconvenience_fee: true },
    unpriced: [
      { surcharge_type: 'overtime_per_hour', label: 'Overtime', detail: '6 h recorded', quantity: 6 },
      { surcharge_type: 'oxygen_per_litre', label: 'Oxygen (per litre beyond 10L)', detail: '8L beyond the first 10L', quantity: 8 },
    ],
  },
  {
    ref: 'BK-LEAK-0002',
    memo: { overtime_hours: 3, oxygen_litres_used: 0, waiting_time_minutes: 95, disposables_used: true },
    unpriced: [
      { surcharge_type: 'overtime_per_hour', label: 'Overtime', detail: '3 h recorded', quantity: 3 },
      { surcharge_type: 'waiting_time_per_30min', label: 'Waiting time', detail: '95 min (3 chargeable blocks)', quantity: 3 },
    ],
  },
  {
    ref: 'BK-LEAK-0003',
    memo: { overtime_hours: 9, oxygen_litres_used: 14, waiting_time_minutes: 0 },
    unpriced: [
      { surcharge_type: 'overtime_per_hour', label: 'Overtime', detail: '9 h recorded', quantity: 9 },
      // Deliberately quantity-less, to exercise the report's "no recorded quantity"
      // counter - the honesty path for invoices written before quantities were stored.
      { surcharge_type: 'oxygen_per_litre', label: 'Oxygen (per litre beyond 10L)', detail: '4L beyond the first 10L' },
    ],
  },
]

async function main() {
  try {
    await sequelize.authenticate()

    const sarah = await User.findOne({ where: { email: 'sarah@efar.com.sg' } })
    const camilla = await User.findOne({ where: { email: 'camilla@efar.com.sg' } })
    const ravi = await User.findOne({ where: { email: 'ravi@efar.com.sg' } })
    if (!sarah || !camilla || !ravi) {
      throw new Error('Demo users not found - run `npm run db:seed` first.')
    }

    const [client] = await Client.findOrCreate({
      where: { contact_email: CLIENT_EMAIL },
      defaults: {
        name: CLIENT_NAME,
        contact_email: CLIENT_EMAIL,
        contact_phone: '67501234',
        billing_address: '30 Admiralty Road West, Singapore 759956',
      },
    })
    console.log(`[seed-leakage-demo] Client "${client.name}" -> #${client.id}`)

    let contract = await PricingContract.findOne({ where: { contract_name: CONTRACT_NAME } })
    if (!contract) {
      contract = await PricingContract.create({
        client_id: client.id,
        created_by: sarah.id,
        contract_name: CONTRACT_NAME,
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
        is_active: true,
      })

      // One base rate so the engine matches and the invoice is priced; the gap is strictly
      // in the surcharge schedule, which is what makes the leakage attributable.
      await PricingRate.create({
        contract_id: contract.id,
        service_type: 'eas',
        transfer_type: 'one_way_hospital',
        time_of_day: 'all_hours',
        base_amount: BASE_AMOUNT,
      })
      await SurchargeSchedule.bulkCreate(PRICED_SURCHARGES.map((s) => ({ ...s, contract_id: contract.id })))
      console.log(`[seed-leakage-demo] Contract -> #${contract.id} (${PRICED_SURCHARGES.length} surcharges priced, 3 deliberately missing)`)
    } else {
      console.log(`[seed-leakage-demo] Contract already exists -> #${contract.id}`)
    }

    const today = new Date().toISOString().slice(0, 10)
    let created = 0

    for (const job of JOBS) {
      const [booking, bookingCreated] = await Booking.findOrCreate({
        where: { reference_number: job.ref },
        defaults: {
          reference_number: job.ref,
          client_id: client.id,
          created_by: camilla.id,
          assigned_crew_id: ravi.id,
          service_type: 'eas',
          service_tier: 'basic',
          scheduled_date: today,
          scheduled_time: '09:00',
          pickup_location: '30 Admiralty Road West',
          destination: 'Khoo Teck Puat Hospital',
          status: 'invoiced',
          notes: 'Seed data - demonstrates the Revenue Leakage report (unpriced surcharges).',
        },
      })
      if (!bookingCreated) {
        console.log(`[seed-leakage-demo] Skipped (booking exists): ${job.ref}`)
        continue
      }

      const memo = await ServiceMemo.create({
        booking_id: booking.id,
        submitted_by: ravi.id,
        reviewed_by: sarah.id,
        job_start_time: new Date(),
        job_end_time: new Date(Date.now() + 60 * 60 * 1000),
        patient_name: 'Seed Patient',
        hospital_destination: 'Khoo Teck Puat Hospital',
        service_type: 'eas',
        transfer_type: 'one_way_hospital',
        is_office_hours: true,
        status: 'invoiced',
        ...job.memo,
      })

      // Only the base rate reached the invoice - the recorded surcharges above are exactly
      // what the contract could not price, so they are reported instead of billed.
      const subtotal = round2(BASE_AMOUNT)
      const invoice = await Invoice.create({
        memo_id: memo.id,
        booking_id: booking.id,
        client_id: client.id,
        contract_id: contract.id,
        subtotal,
        tax_amount: 0,
        total_amount: subtotal,
        status: 'matched',
        unpriced_surcharges: job.unpriced,
      })
      await InvoiceLineItem.create({
        invoice_id: invoice.id,
        description: 'EAS - One-Way Hospital Transfer (All Hours)',
        quantity: 1,
        unit_price: subtotal,
        amount: subtotal,
        is_manual_adjustment: false,
      })

      created += 1
      console.log(`[seed-leakage-demo] ${job.ref} -> invoice #${invoice.id}: $${subtotal.toFixed(2)} billed, ${job.unpriced.length} charge(s) unpriced`)
    }

    console.log(`\n[seed-leakage-demo] Done (${created} new invoice chain(s)).`)
    console.log('[seed-leakage-demo] View at /reports/revenue-leakage as Doris or Sarah,')
    console.log('[seed-leakage-demo] or GET /api/dashboard/revenue-leakage')
  } catch (err) {
    console.error('[seed-leakage-demo] Failed:', err.message)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}

main()
