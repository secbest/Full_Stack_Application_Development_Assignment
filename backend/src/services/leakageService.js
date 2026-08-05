// Owner: Kwan Hua. Revenue leakage reporting.
//
// The pricing engine already refuses to silently drop a charge it cannot price: anything
// the crew recorded that the client's contract has no rate for is persisted on the invoice
// as `unpriced_surcharges` (see services/pricingService.js). Until now nothing read that
// column, so the platform was collecting a precise record of its own revenue leakage and
// showing it to nobody.
//
// This module aggregates those records into the question management actually asks: how
// much are we failing to bill, why, and which contract do we fix first?
//
// PURE (no DB, no req/res) for the same reason pricingService is: the estimation rules
// below are the part worth unit-testing, and the controller does the queries.

const { round2 } = require('../utils/money')

// A leakage figure is only as honest as its rate source, so every estimate carries the
// basis it was derived from and the report totals each basis separately.
//
//   contract_peer_median - other active contracts DO price this surcharge; their median
//                          rate is a defensible stand-in. This is a real number.
//   no_reference_rate    - no contract in the system prices this surcharge at all, so
//                          there is nothing to estimate from. Counted, never valued.
const BASIS = {
  PEER_MEDIAN: 'contract_peer_median',
  NONE: 'no_reference_rate',
}

function median(numbers) {
  if (!numbers.length) return null
  const sorted = [...numbers].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

// Builds { surcharge_type: { median, sampleSize, min, max } } from every surcharge row
// across all contracts. This is the reference-rate table the estimates lean on.
function buildReferenceRates(surchargeRows) {
  const byType = {}
  for (const row of surchargeRows) {
    const amount = Number(row.amount)
    if (!Number.isFinite(amount)) continue
    if (!byType[row.surcharge_type]) byType[row.surcharge_type] = []
    byType[row.surcharge_type].push(amount)
  }

  const reference = {}
  for (const [type, amounts] of Object.entries(byType)) {
    reference[type] = {
      median: round2(median(amounts)),
      sampleSize: amounts.length,
      min: round2(Math.min(...amounts)),
      max: round2(Math.max(...amounts)),
    }
  }
  return reference
}

// Values one unpriced entry against the reference table.
//
// `quantity` is read from the entry where present. Older invoices were written before
// pricingService recorded a numeric quantity, so those fall back to 1 - which under-states
// leakage on multi-unit charges (8 hours of overtime counts as one) rather than inventing
// a figure by parsing the human-readable `detail` string. The report reports that count.
function valueEntry(entry, reference) {
  const ref = reference[entry.surcharge_type]
  const hasQuantity = Number.isFinite(Number(entry.quantity))
  const quantity = hasQuantity ? Number(entry.quantity) : 1

  if (!ref) {
    return {
      surcharge_type: entry.surcharge_type,
      label: entry.label,
      quantity,
      quantity_known: hasQuantity,
      basis: BASIS.NONE,
      unit_rate: null,
      estimated_amount: 0,
    }
  }

  return {
    surcharge_type: entry.surcharge_type,
    label: entry.label,
    quantity,
    quantity_known: hasQuantity,
    basis: BASIS.PEER_MEDIAN,
    unit_rate: ref.median,
    estimated_amount: round2(quantity * ref.median),
    reference_sample_size: ref.sampleSize,
  }
}

// The report.
//
// `invoices` are rows shaped { id, client_id, client_name, contract_id, contract_name,
// created_at, unpriced_surcharges[] }. `surchargeRows` is every surcharge_schedules row in
// the system (used to build reference rates).
//
// Returns a summary plus three breakdowns, because "we are leaking $X" only becomes
// actionable when paired with which surcharge and whose contract to fix.
function buildLeakageReport(invoices, surchargeRows) {
  const reference = buildReferenceRates(surchargeRows)

  const byType = {}
  const byContract = {}
  const affectedInvoices = []

  let estimatedTotal = 0
  let unquantifiedCount = 0
  let unvaluedCount = 0

  for (const invoice of invoices) {
    const entries = Array.isArray(invoice.unpriced_surcharges) ? invoice.unpriced_surcharges : []
    if (!entries.length) continue

    let invoiceTotal = 0

    for (const entry of entries) {
      if (!entry || !entry.surcharge_type) continue
      const valued = valueEntry(entry, reference)

      estimatedTotal += valued.estimated_amount
      invoiceTotal += valued.estimated_amount
      if (!valued.quantity_known) unquantifiedCount += 1
      if (valued.basis === BASIS.NONE) unvaluedCount += 1

      // Per surcharge type: what is costing the most, across all clients.
      if (!byType[valued.surcharge_type]) {
        byType[valued.surcharge_type] = {
          surcharge_type: valued.surcharge_type,
          label: valued.label || valued.surcharge_type,
          occurrences: 0,
          total_quantity: 0,
          unit_rate: valued.unit_rate,
          basis: valued.basis,
          estimated_amount: 0,
        }
      }
      const typeBucket = byType[valued.surcharge_type]
      typeBucket.occurrences += 1
      typeBucket.total_quantity = round2(typeBucket.total_quantity + valued.quantity)
      typeBucket.estimated_amount = round2(typeBucket.estimated_amount + valued.estimated_amount)

      // Per contract: which contract to go and fix. A contract missing a rate is the
      // actual root cause - the same gap recurs on every job until someone adds the rate.
      const contractKey = invoice.contract_id === null || invoice.contract_id === undefined
        ? `client:${invoice.client_id}`
        : `contract:${invoice.contract_id}`
      if (!byContract[contractKey]) {
        byContract[contractKey] = {
          contract_id: invoice.contract_id ?? null,
          contract_name: invoice.contract_name || (invoice.contract_id ? `Contract #${invoice.contract_id}` : 'No active contract'),
          client_id: invoice.client_id ?? null,
          client_name: invoice.client_name || null,
          affected_invoices: 0,
          missing_surcharge_types: [],
          estimated_amount: 0,
        }
      }
      const contractBucket = byContract[contractKey]
      if (!contractBucket.missing_surcharge_types.includes(valued.surcharge_type)) {
        contractBucket.missing_surcharge_types.push(valued.surcharge_type)
      }
      contractBucket.estimated_amount = round2(contractBucket.estimated_amount + valued.estimated_amount)
    }

    const contractKey = invoice.contract_id === null || invoice.contract_id === undefined
      ? `client:${invoice.client_id}`
      : `contract:${invoice.contract_id}`
    byContract[contractKey].affected_invoices += 1

    affectedInvoices.push({
      invoice_id: invoice.id,
      client_id: invoice.client_id ?? null,
      client_name: invoice.client_name || null,
      contract_id: invoice.contract_id ?? null,
      created_at: invoice.created_at,
      unpriced_count: entries.length,
      estimated_amount: round2(invoiceTotal),
    })
  }

  const byTypeList = Object.values(byType).sort((a, b) => b.estimated_amount - a.estimated_amount)
  const byContractList = Object.values(byContract).sort((a, b) => b.estimated_amount - a.estimated_amount)

  return {
    summary: {
      estimated_leakage: round2(estimatedTotal),
      affected_invoice_count: affectedInvoices.length,
      unpriced_item_count: byTypeList.reduce((sum, t) => sum + t.occurrences, 0),
      // The two honesty counters. A report that quietly rounds unknowns to zero and
      // presents the result as complete is worse than one that states its own blind spots.
      items_without_reference_rate: unvaluedCount,
      items_without_recorded_quantity: unquantifiedCount,
      // The single most valuable sentence in the report: the biggest fix available.
      top_recommendation: byContractList.length
        ? `${byContractList[0].contract_name} is missing ${byContractList[0].missing_surcharge_types.length} surcharge rate(s), accounting for an estimated $${byContractList[0].estimated_amount.toFixed(2)} of unbilled charges across ${byContractList[0].affected_invoices} invoice(s).`
        : 'No unpriced surcharges were recorded in this period.',
    },
    by_surcharge_type: byTypeList,
    by_contract: byContractList,
    affected_invoices: affectedInvoices.sort((a, b) => b.estimated_amount - a.estimated_amount),
    reference_rates: reference,
  }
}

module.exports = {
  BASIS,
  median,
  buildReferenceRates,
  valueEntry,
  buildLeakageReport,
}
