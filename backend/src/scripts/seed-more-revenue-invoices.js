// Adds a booking + service memo + invoice (with line items) for each of five
// already-seeded clients (seed-clients.js) that had no invoices yet, so the AR Invoice
// List is populated on load and the Managing Director's Reports -> Revenue by Client
// chart has more than the two clients real data happened to produce.
//
// Each invoice's subtotal/total is DERIVED from its line items (not hardcoded) so the
// Invoice Detail line-item table always reconciles with the summary totals. The
// 'adjusted' invoice carries a manual-adjustment line so its status is self-explanatory.
//
// Requires seed-users.js and seed-clients.js to have run first.
// Uses findOrCreate on each booking's reference_number - safe to run multiple times.
//
// Usage:  node src/scripts/seed-more-revenue-invoices.js
require('dotenv').config()
const sequelize = require('../config')
const { User, Client, Booking, ServiceMemo, Invoice, InvoiceLineItem } = require('../models')
const gstService = require('../services/gstService')

const round2 = (n) => Math.round(n * 100) / 100

// li(description, unit_price, [quantity], [manual]) - small helper so the line-item
// lists below stay readable. Most rows are qty 1 and auto (pricing-engine) rows.
const li = (description, unit_price, quantity = 1, manual = false) => ({ description, unit_price, quantity, manual })

const NEW_REVENUE_INVOICES = [
  {
    ref: 'BKG-REV-0001',
    clientEmail: 'admin@abc-corp.com.sg',
    service_type: 'workplace_standby',
    service_tier: 'basic',
    transfer_type: 'one_way_hospital',
    pickup: '10 Anson Road, Singapore 079903',
    destination: 'Singapore General Hospital, Outram Road, Singapore 169608',
    status: 'synced_to_xero',
    lineItems: [
      li('Workplace Standby - One-Way Hospital Transfer (Office Hours)', 1300),
      li('Oxygen Charge - Base (first 10L)', 50),
    ],
  },
  {
    ref: 'BKG-REV-0002',
    clientEmail: 'events@marinabaysands.com',
    service_type: 'event_standby',
    service_tier: 'advanced',
    transfer_type: 'one_way_hospital',
    pickup: '10 Bayfront Avenue, Singapore 018956',
    destination: 'Singapore General Hospital, Outram Road, Singapore 169608',
    status: 'approved',
    lineItems: [
      li('Event Standby - Advanced Medical Coverage', 3000),
      li('Inconvenience Fee (Floor/Stair Access)', 100),
    ],
  },
  {
    ref: 'BKG-REV-0003',
    clientEmail: 'safety@stengg.com',
    service_type: 'eas',
    service_tier: 'critical',
    transfer_type: 'two_way_hospital',
    pickup: '1 Ang Mo Kio Electronics Park Road, Singapore 567710',
    destination: 'Tan Tock Seng Hospital A&E, 11 Jalan Tan Tock Seng, Singapore 308433',
    status: 'matched',
    lineItems: [
      li('EAS - Two-Way Hospital Transfer (Critical)', 1810),
      li('Resuscitation Performed', 320),
      li('Suction Performed', 50),
    ],
  },
  {
    ref: 'BKG-REV-0004',
    clientEmail: 'hse@jiic.com.sg',
    service_type: 'eas',
    service_tier: 'advanced',
    transfer_type: 'one_way_hospital',
    pickup: '31 Jurong Island Highway, Singapore 627831',
    destination: 'National University Hospital, 5 Lower Kent Ridge Road, Singapore 119074',
    status: 'adjusted',
    lineItems: [
      li('EAS - One-Way Hospital Transfer (Advanced)', 1600),
      li('Jurong Island Transport Surcharge', 150),
      li('Manual adjustment - after-hours premium', 150, 1, true),
    ],
  },
  {
    ref: 'BKG-REV-0005',
    clientEmail: 'operations@sportshuborg.sg',
    service_type: 'event_standby',
    service_tier: 'basic',
    transfer_type: 'one_way_hospital',
    pickup: '1 Stadium Drive, Singapore 397629',
    destination: 'Changi General Hospital, 2 Simei Street 3, Singapore 529889',
    status: 'synced_to_xero',
    lineItems: [
      li('Event Standby - Basic Medical Coverage', 930),
      li('Disposables Used', 50),
    ],
  },
]

async function main() {
  try {
    console.log('[seed-more-revenue-invoices] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[seed-more-revenue-invoices] Connected.')

    const camilla = await User.findOne({ where: { email: 'camilla@efar.com.sg' } })
    const ravi = await User.findOne({ where: { email: 'ravi@efar.com.sg' } })
    if (!camilla || !ravi) {
      console.error('[seed-more-revenue-invoices] Demo users not found. Run seed-users.js first.')
      process.exit(1)
    }

    const today = new Date().toISOString().slice(0, 10)

    for (const item of NEW_REVENUE_INVOICES) {
      const client = await Client.findOne({ where: { contact_email: item.clientEmail } })
      if (!client) {
        console.error(`[seed-more-revenue-invoices] Client with email ${item.clientEmail} not found. Run seed-clients.js first. Skipping ${item.ref}.`)
        continue
      }

      const [booking, bookingCreated] = await Booking.findOrCreate({
        where: { reference_number: item.ref },
        defaults: {
          reference_number: item.ref,
          client_id: client.id,
          created_by: camilla.id,
          assigned_crew_id: ravi.id,
          service_type: item.service_type,
          service_tier: item.service_tier,
          scheduled_date: today,
          scheduled_time: '10:00',
          pickup_location: item.pickup,
          destination: item.destination,
          status: 'invoiced',
          notes: 'Seed data - added so the Revenue by Client report has more than two clients.',
        },
      })
      if (!bookingCreated) {
        console.log(`[seed-more-revenue-invoices] Skipped (booking exists): ${item.ref}`)
        continue
      }

      const memo = await ServiceMemo.create({
        booking_id: booking.id,
        submitted_by: ravi.id,
        reviewed_by: camilla.id,
        job_start_time: new Date(),
        job_end_time: new Date(Date.now() + 60 * 60 * 1000),
        patient_name: 'Seed Patient',
        hospital_destination: item.destination,
        service_type: item.service_type,
        transfer_type: item.transfer_type,
        is_office_hours: true,
        status: 'invoiced',
      })

      // Pricing contracts are GST-exclusive. Use the same effective-dated calculation as
      // the live memo workflow so demo invoices reconcile with both EFAR and Xero.
      const lineRows = item.lineItems.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        amount: round2(l.quantity * l.unit_price),
        is_manual_adjustment: l.manual,
      }))
      const gstSnapshot = await gstService.buildSnapshot(today)
      const totals = gstService.calculateTotals(lineRows, gstSnapshot.gst_rate_percent)

      const invoice = await Invoice.create({
        memo_id: memo.id,
        booking_id: booking.id,
        client_id: client.id,
        ...gstSnapshot,
        ...totals,
        status: item.status,
      })

      await InvoiceLineItem.bulkCreate(lineRows.map((line) => ({
        invoice_id: invoice.id,
        ...line,
      })))

      console.log(`[seed-more-revenue-invoices]   Created: ${item.ref} - ${client.name} - $${totals.total_amount.toFixed(2)} incl. GST (${item.status}, ${item.lineItems.length} line items)`)
    }

    console.log('\n[seed-more-revenue-invoices] Done.')
  } catch (err) {
    console.error('[seed-more-revenue-invoices] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
