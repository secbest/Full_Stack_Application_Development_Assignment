// Data cleanup for the two intake-era defects fixed in this change set.
//
// 1. DUPLICATE / MIS-ASSIGNED CLIENTS
//    confirmIntake used to identify a client by contact_email alone, so one organisation
//    booking under two emails became two client rows, and two organisations sharing an
//    email collapsed into one (the booking then billed to whichever name was on file
//    first). The code fix is in services/clientResolutionService.js; this script repairs
//    the rows already written.
//
// 2. UNDER-QUOTED BOOKINGS
//    The Agreed Base Price field carried no reference to the published rate card, so
//    prices were entered from memory. This script REPORTS bookings whose frozen quote
//    falls outside the published band. It deliberately does not rewrite them: a quoted
//    price is a commercial commitment, and some are legitimately negotiated. Repricing is
//    a human decision.
//
// Usage:
//   node src/scripts/cleanup-client-data.js                      # dry run (default)
//   node src/scripts/cleanup-client-data.js --merge=13:10        # plan merge of 13 into 10
//   node src/scripts/cleanup-client-data.js --merge=13:10 --apply
//
// Exact-duplicate clients (identical normalised names) are detected automatically.
// Near-duplicates such as "Nanyang Poly" vs "Nayang Polytechnic" are NOT auto-merged -
// fuzzy name matching cannot distinguish a typo from two genuinely different customers,
// so those must be named explicitly with --merge.

require('dotenv').config()
const sequelize = require('../config')
const { Client, Booking, Invoice, PricingContract } = require('../models')
const { normaliseName } = require('../services/clientResolutionService')

const APPLY = process.argv.includes('--apply')
const MERGE_PAIRS = process.argv
  .filter((arg) => arg.startsWith('--merge='))
  .map((arg) => {
    const [from, into] = arg.slice('--merge='.length).split(':').map(Number)
    if (!Number.isInteger(from) || !Number.isInteger(into)) {
      throw new Error(`Invalid --merge value "${arg}". Expected --merge=<fromId>:<intoId>.`)
    }
    if (from === into) throw new Error(`Cannot merge client ${from} into itself.`)
    return { from, into }
  })

// Published bands, mirroring frontend/src/lib/publishedRateCard.js. Duplicated rather than
// imported because this script must run without the frontend build present.
const PUBLISHED_BASE_RATES = {
  one_way_hospital:    { office_hours: [160, 210], non_office_hours: [190, 210] },
  two_way_hospital:    { office_hours: [210, 250], non_office_hours: [280, 320] },
  covid_19:            { office_hours: [280, 280], non_office_hours: [320, 320] },
  imh_psychiatric:     { office_hours: [400, 400], non_office_hours: [500, 500] },
  airport_no_tarmac:   { office_hours: [210, 210], non_office_hours: [210, 210] },
  airport_with_tarmac: { office_hours: [550, 550], non_office_hours: [650, 650] },
  sg_jb_ground:        { all_hours: [500, 900] },
}

function publishedBand(transferType, timeOfDay) {
  const entry = PUBLISHED_BASE_RATES[transferType]
  if (!entry) return null
  if (entry[timeOfDay]) return entry[timeOfDay]
  if (entry.all_hours) return entry.all_hours
  if (timeOfDay === 'all_hours' && entry.office_hours && entry.non_office_hours) {
    return [
      Math.min(entry.office_hours[0], entry.non_office_hours[0]),
      Math.max(entry.office_hours[1], entry.non_office_hours[1]),
    ]
  }
  return null
}

async function clientFootprint(clientId) {
  const [bookings, invoices, contracts] = await Promise.all([
    Booking.count({ where: { client_id: clientId } }),
    Invoice.count({ where: { client_id: clientId } }),
    PricingContract.count({ where: { client_id: clientId } }),
  ])
  return { bookings, invoices, contracts }
}

async function findExactDuplicates() {
  const clients = await Client.findAll({ attributes: ['id', 'name', 'contact_email'], order: [['id', 'ASC']], raw: true })
  const groups = new Map()
  for (const client of clients) {
    const key = normaliseName(client.name).toLowerCase()
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(client)
  }
  return [...groups.values()].filter((group) => group.length > 1)
}

async function planMerge({ from, into }) {
  const [fromClient, intoClient] = await Promise.all([Client.findByPk(from), Client.findByPk(into)])
  if (!fromClient) throw new Error(`Client ${from} does not exist.`)
  if (!intoClient) throw new Error(`Client ${into} does not exist.`)

  const [fromFootprint, intoFootprint] = await Promise.all([clientFootprint(from), clientFootprint(into)])

  // A contract is client-scoped pricing. Merging a client that owns one INTO another would
  // leave two active contracts on the survivor, and findActiveContract picks by date alone -
  // so the invoice total would depend on which row the query happened to order first.
  if (fromFootprint.contracts > 0) {
    console.log(`  ! Client ${from} owns ${fromFootprint.contracts} pricing contract(s).`)
    console.log('    Merging would leave the survivor with overlapping contracts and make pricing ambiguous.')
    console.log(`    Deactivate or delete them first, or merge in the other direction (--merge=${into}:${from}).`)
    return null
  }

  const syncedInvoices = await Invoice.count({ where: { client_id: from, status: 'synced_to_xero' } })
  return { fromClient, intoClient, fromFootprint, intoFootprint, syncedInvoices }
}

async function applyMerge(plan) {
  const { fromClient, intoClient } = plan
  await sequelize.transaction(async (t) => {
    await Booking.update({ client_id: intoClient.id }, { where: { client_id: fromClient.id }, transaction: t })
    await Invoice.update({ client_id: intoClient.id }, { where: { client_id: fromClient.id }, transaction: t })
    await PricingContract.update({ client_id: intoClient.id }, { where: { client_id: fromClient.id }, transaction: t })
    await Client.destroy({ where: { id: fromClient.id }, transaction: t })
  })
}

async function reportQuotedOutliers() {
  const bookings = await Booking.findAll({
    where: { pricing_source: 'one_off_quote' },
    attributes: ['id', 'reference_number', 'client_id', 'quoted_base_amount', 'quoted_transfer_type', 'quoted_time_of_day'],
    order: [['id', 'ASC']],
    raw: true,
  })

  const outliers = []
  for (const booking of bookings) {
    const band = publishedBand(booking.quoted_transfer_type, booking.quoted_time_of_day)
    if (!band) continue
    const amount = Number(booking.quoted_base_amount)
    if (!Number.isFinite(amount)) continue
    if (amount < band[0]) outliers.push({ ...booking, band, verdict: 'BELOW' })
    else if (amount > band[1]) outliers.push({ ...booking, band, verdict: 'ABOVE' })
  }
  return outliers
}

async function main() {
  try {
    await sequelize.authenticate()
    console.log(APPLY ? '=== CLEANUP (APPLY) ===\n' : '=== CLEANUP (DRY RUN - no writes) ===\n')

    console.log('--- Exact duplicate client names ---')
    const duplicateGroups = await findExactDuplicates()
    if (duplicateGroups.length === 0) {
      console.log('  None found.\n')
    } else {
      for (const group of duplicateGroups) {
        console.log(`  "${group[0].name}":`)
        for (const client of group) {
          const footprint = await clientFootprint(client.id)
          console.log(`    id ${client.id} | ${client.contact_email} | bookings ${footprint.bookings}, invoices ${footprint.invoices}, contracts ${footprint.contracts}`)
        }
        console.log(`    -> merge with --merge=<fromId>:<intoId>`)
      }
      console.log('')
    }

    if (MERGE_PAIRS.length > 0) {
      console.log('--- Requested merges ---')
      for (const pair of MERGE_PAIRS) {
        console.log(`  Client ${pair.from} -> ${pair.into}`)
        const plan = await planMerge(pair)
        if (!plan) { console.log('') ; continue }

        console.log(`    from: "${plan.fromClient.name}" <${plan.fromClient.contact_email}> - bookings ${plan.fromFootprint.bookings}, invoices ${plan.fromFootprint.invoices}`)
        console.log(`    into: "${plan.intoClient.name}" <${plan.intoClient.contact_email}> - bookings ${plan.intoFootprint.bookings}, invoices ${plan.intoFootprint.invoices}, contracts ${plan.intoFootprint.contracts}`)
        if (plan.syncedInvoices > 0) {
          console.log(`    ! ${plan.syncedInvoices} invoice(s) already synced to Xero will be re-pointed.`)
          console.log('      Xero holds the original contact; reconcile there separately.')
        }
        console.log(`    will move ${plan.fromFootprint.bookings} booking(s) + ${plan.fromFootprint.invoices} invoice(s), then delete client ${plan.fromClient.id}`)

        if (APPLY) {
          await applyMerge(plan)
          console.log('    APPLIED.')
        } else {
          console.log('    (dry run - re-run with --apply to execute)')
        }
      }
      console.log('')
    }

    console.log('--- One-off quotes outside the published rate card ---')
    const outliers = await reportQuotedOutliers()
    if (outliers.length === 0) {
      console.log('  None found.')
    } else {
      for (const outlier of outliers) {
        console.log(`  ${outlier.reference_number} | client ${outlier.client_id} | ${outlier.quoted_transfer_type} / ${outlier.quoted_time_of_day}`)
        console.log(`    quoted $${Number(outlier.quoted_base_amount).toFixed(2)} vs published $${outlier.band[0]}-$${outlier.band[1]}  [${outlier.verdict}]`)
      }
      console.log('\n  Not modified: a quoted price is a commercial commitment. Review each with the')
      console.log('  Quotations Specialist and reprice through the app if it was entered in error.')
    }
  } catch (err) {
    console.error('[cleanup] Failed:', err.message)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}

main()
