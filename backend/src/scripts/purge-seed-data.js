// Removes every sample/demo record left behind by the seed-*.js scripts, without
// touching the schema or any real data entered through the app since. Use this once,
// right before going live with real customers, so the Managing Director's Reports,
// the AR Invoice List, the Quotations intake queue, and Field Crew's My Jobs no
// longer show "Raffles Medical Group", "Tan Tock Seng Hospital", etc.
//
// Deliberately targeted, NOT a wipe: every row removed here is identified by the
// exact reference_number / contact_email / contract_name / invoice_number the
// seed scripts hardcode (see seed-clients.js, seed-intakes.js, seed-bookings.js,
// seed-pricing.js, seed-leakage-demo.js, seed-more-revenue-invoices.js, seed-xero.js,
// seed-sample-vendor-invoice.js). Anything you or your team have created for real
// through the app is left alone.
//
// Does NOT touch the `users` table - Doris/Sarah/Chloe/Camilla/Ravi are the
// role-routed staff accounts the app logs in with, not sample business data.
// Swap them for real staff via Accounts Management once you know who they are.
//
// Deletes in FK-safe order (children before parents): xero_sync_logs -> invoice
// line items/invoices -> memo signatures/service memos -> job milestones ->
// bookings -> pricing rates/surcharges/contracts -> vendor invoice items/vendor
// invoices -> xero_connections (demo tenant only) -> intake submissions -> clients.
//
// DESTRUCTIVE. Guarded so it can't run by accident:
//   npm run db:purge-seed -- --yes
//   node src/scripts/purge-seed-data.js --yes
//   CONFIRM_RESET=1 node src/scripts/purge-seed-data.js
// Without the confirmation flag/env it prints what it would delete and exits
// without touching anything.
//
// Safe to run more than once - anything already gone is simply skipped.
require('dotenv').config()
const { Op } = require('sequelize')
const sequelize = require('../config')
const {
  Client, IntakeSubmission, Booking, JobMilestone,
  PricingContract, PricingRate, SurchargeSchedule,
  Invoice, InvoiceLineItem, ServiceMemo, MemoSignature,
  VendorInvoice, VendorInvoiceItem, XeroConnection, XeroSyncLog,
} = require('../models')

// Every reference_number a seed script has ever hardcoded for a booking.
const SEED_BOOKING_REFS = [
  'BKG-TEST-00001', 'BKG-TEST-00002', 'BKG-TEST-00003', 'BKG-TEST-00004', 'BKG-TEST-00005',
  'BKG-2026-00001', 'BKG-2026-00002', 'BKG-2026-00003', 'BKG-2026-00004',
  'BK-LEAK-0001', 'BK-LEAK-0002', 'BK-LEAK-0003',
  'BKG-REV-0001', 'BKG-REV-0002', 'BKG-REV-0003', 'BKG-REV-0004', 'BKG-REV-0005',
]

const SEED_INTAKE_REFS = [
  'EFAR-2026-00001', 'EFAR-2026-00002', 'EFAR-2026-00003', 'EFAR-2026-00004',
  'EFAR-2026-00005', 'EFAR-2026-00006', 'EFAR-2026-00009', 'EFAR-2026-00010',
]

const SEED_CLIENT_EMAILS = [
  'ops@ttsh.com.sg', 'admin@abc-corp.com.sg', 'ops@rafflesmedical.com.sg',
  'events@marinabaysands.com', 'safety@stengg.com', 'hse@jiic.com.sg',
  'operations@sportshuborg.sg', 'accounts@sembawangmarine.com.sg',
]

const SEED_VENDOR_INVOICES = [
  { vendor_name: 'Central Medical Distributors Pte Ltd', invoice_number: 'CMD-2026-01187' },
  { vendor_name: 'Esso Petroleum Pte Ltd', invoice_number: 'INV-2026-00891' },
  { vendor_name: 'SBS Transit Parts', invoice_number: 'INV-2026-00450' },
  { vendor_name: 'Jurong Medical Supplies', invoice_number: 'INV-2026-00512' },
  { vendor_name: 'Esso Petroleum Pte Ltd', invoice_number: 'INV-2026-00893' },
]

const DEMO_XERO_TENANT_ID = 'demo-tenant-efar-2026'

function isConfirmed() {
  const args = process.argv.slice(2)
  if (args.includes('--yes') || args.includes('-y')) return true
  if (process.env.CONFIRM_RESET === '1') return true
  return false
}

function printUnconfirmed() {
  console.log('')
  console.log('  This will permanently delete the seed/demo data listed in this script')
  console.log('  (sample clients, bookings, intakes, memos, invoices, pricing contracts,')
  console.log('  vendor invoices, and the demo Xero connection). Real data you have')
  console.log('  entered through the app is not touched.')
  console.log('')
  console.log('  Re-run with a confirmation to proceed:')
  console.log('    npm run db:purge-seed -- --yes')
  console.log('    (or)  CONFIRM_RESET=1 npm run db:purge-seed')
  console.log('')
}

async function main() {
  if (!isConfirmed()) {
    printUnconfirmed()
    process.exit(1)
  }

  try {
    console.log('[purge-seed-data] Connecting...')
    await sequelize.authenticate()
    console.log('[purge-seed-data] Connected.')

    const bookings = await Booking.findAll({ where: { reference_number: { [Op.in]: SEED_BOOKING_REFS } } })
    const bookingIds = bookings.map((b) => b.id)

    if (bookingIds.length > 0) {
      const memos = await ServiceMemo.findAll({ where: { booking_id: { [Op.in]: bookingIds } } })
      const memoIds = memos.map((m) => m.id)

      const invoices = await Invoice.findAll({ where: { booking_id: { [Op.in]: bookingIds } } })
      const invoiceIds = invoices.map((i) => i.id)

      if (invoiceIds.length > 0) {
        const syncLogsDeleted = await XeroSyncLog.destroy({ where: { entity_type: 'ar_invoice', entity_id: { [Op.in]: invoiceIds } } })
        const lineItemsDeleted = await InvoiceLineItem.destroy({ where: { invoice_id: { [Op.in]: invoiceIds } } })
        const invoicesDeleted = await Invoice.destroy({ where: { id: { [Op.in]: invoiceIds } } })
        console.log(`[purge-seed-data] Deleted ${invoicesDeleted} invoice(s), ${lineItemsDeleted} line item(s), ${syncLogsDeleted} AR sync log(s).`)
      }

      if (memoIds.length > 0) {
        const signaturesDeleted = await MemoSignature.destroy({ where: { memo_id: { [Op.in]: memoIds } } })
        const memosDeleted = await ServiceMemo.destroy({ where: { id: { [Op.in]: memoIds } } })
        console.log(`[purge-seed-data] Deleted ${memosDeleted} service memo(s), ${signaturesDeleted} signature(s).`)
      }

      const milestonesDeleted = await JobMilestone.destroy({ where: { booking_id: { [Op.in]: bookingIds } } })
      const bookingsDeleted = await Booking.destroy({ where: { id: { [Op.in]: bookingIds } } })
      console.log(`[purge-seed-data] Deleted ${bookingsDeleted} booking(s), ${milestonesDeleted} job milestone(s).`)
    } else {
      console.log('[purge-seed-data] No seed bookings found - already clean.')
    }

    const intakesDeleted = await IntakeSubmission.destroy({ where: { reference_number: { [Op.in]: SEED_INTAKE_REFS } } })
    console.log(`[purge-seed-data] Deleted ${intakesDeleted} intake submission(s).`)

    const seedClients = await Client.findAll({ where: { contact_email: { [Op.in]: SEED_CLIENT_EMAILS } } })
    const clientIds = seedClients.map((c) => c.id)

    if (clientIds.length > 0) {
      const contracts = await PricingContract.findAll({ where: { client_id: { [Op.in]: clientIds } } })
      const contractIds = contracts.map((c) => c.id)

      if (contractIds.length > 0) {
        // Any invoice still pointing at one of these contracts (e.g. seed-leakage-demo's
        // Sembawang chain, whose booking ref isn't in SEED_BOOKING_REFS) must go first too.
        const contractInvoices = await Invoice.findAll({ where: { contract_id: { [Op.in]: contractIds } } })
        const contractInvoiceIds = contractInvoices.map((i) => i.id)
        if (contractInvoiceIds.length > 0) {
          await XeroSyncLog.destroy({ where: { entity_type: 'ar_invoice', entity_id: { [Op.in]: contractInvoiceIds } } })
          await InvoiceLineItem.destroy({ where: { invoice_id: { [Op.in]: contractInvoiceIds } } })
          await Invoice.destroy({ where: { id: { [Op.in]: contractInvoiceIds } } })
        }

        const ratesDeleted = await PricingRate.destroy({ where: { contract_id: { [Op.in]: contractIds } } })
        const surchargesDeleted = await SurchargeSchedule.destroy({ where: { contract_id: { [Op.in]: contractIds } } })
        const contractsDeleted = await PricingContract.destroy({ where: { id: { [Op.in]: contractIds } } })
        console.log(`[purge-seed-data] Deleted ${contractsDeleted} pricing contract(s), ${ratesDeleted} rate(s), ${surchargesDeleted} surcharge(s), ${contractInvoiceIds.length} contract-linked invoice(s).`)
      }
    }

    for (const v of SEED_VENDOR_INVOICES) {
      const invoice = await VendorInvoice.findOne({ where: v })
      if (!invoice) continue
      await XeroSyncLog.destroy({ where: { entity_type: 'vendor_invoice', entity_id: invoice.id } })
      await VendorInvoiceItem.destroy({ where: { vendor_invoice_id: invoice.id } })
      await invoice.destroy()
      console.log(`[purge-seed-data] Deleted vendor invoice "${v.vendor_name}" (${v.invoice_number}).`)
    }

    const xeroConnDeleted = await XeroConnection.destroy({ where: { xero_tenant_id: DEMO_XERO_TENANT_ID } })
    if (xeroConnDeleted > 0) {
      console.log(`[purge-seed-data] Deleted the demo Xero connection - you will need to reconnect a real Xero org.`)
    }

    // Bookings/contracts/invoices referencing these clients are gone by this point,
    // so the FK constraint on clients.id will not reject this delete.
    const clientsDeleted = clientIds.length > 0 ? await Client.destroy({ where: { id: { [Op.in]: clientIds } } }) : 0
    console.log(`[purge-seed-data] Deleted ${clientsDeleted} demo client(s).`)

    console.log('\n[purge-seed-data] Done. Staff accounts (Doris/Sarah/Chloe/Camilla/Ravi) were left untouched.')
  } catch (err) {
    console.error('[purge-seed-data] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
