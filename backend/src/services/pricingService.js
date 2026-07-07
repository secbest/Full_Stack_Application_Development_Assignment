// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper (design/jasper/).
//
// UC-04: The pricing engine. Given a submitted service memo, the client's matched
// base rate row, and the contract's surcharge schedule, it produces the ordered list
// of invoice line items. This module is PURE (no DB, no req/res) so the surcharge
// maths can be unit-tested in isolation - the controller does the DB lookups and
// passes the rows in.

const round2 = (n) => Math.round(n * 100) / 100

const SERVICE_TYPE_LABELS = {
  eas: 'EAS',
  mts: 'MTS',
  event_standby: 'Event Standby',
  workplace_standby: 'Workplace Standby',
}

const TRANSFER_TYPE_LABELS = {
  one_way_hospital: 'One-Way Hospital Transfer',
  two_way_hospital: 'Two-Way Hospital Transfer',
  covid_19: 'COVID-19 Transport',
  imh_psychiatric: 'IMH / Psychiatric Transfer',
  airport_no_tarmac: 'Airport Transfer (No Tarmac)',
  airport_with_tarmac: 'Airport Transfer (With Tarmac)',
  sg_jb_ground: 'SG-JB Ground Transfer',
  air_evacuation: 'Air Evacuation',
}

// Turn the surcharge_schedule rows into a { surcharge_type: amount } lookup.
function toSurchargeMap(surchargeRows) {
  const map = {}
  for (const row of surchargeRows) map[row.surcharge_type] = Number(row.amount)
  return map
}

// Selects the base rate row that best matches the memo's time of day.
// A time-specific row (office_hours / non_office_hours) wins over an all_hours row.
function selectBaseRate(rates, isOfficeHours) {
  const wanted = isOfficeHours ? 'office_hours' : 'non_office_hours'
  return (
    rates.find((r) => r.time_of_day === wanted) ||
    rates.find((r) => r.time_of_day === 'all_hours') ||
    null
  )
}

function baseRateDescription(memo, timeOfDay) {
  const service = SERVICE_TYPE_LABELS[memo.service_type] || memo.service_type
  const transfer = TRANSFER_TYPE_LABELS[memo.transfer_type] || memo.transfer_type
  const time = timeOfDay === 'all_hours'
    ? 'All Hours'
    : (memo.is_office_hours ? 'Office Hours' : 'Non-Office Hours')
  return `${service} - ${transfer} (${time})`
}

// Builds the surcharge line items from the memo flags and the contract's surcharge map.
// Each applicable surcharge becomes its own line item. Missing surcharge types in the
// contract are skipped (a contract may not price every surcharge).
function buildSurchargeLineItems(memo, s) {
  const items = []
  const push = (description, quantity, unitPrice) =>
    items.push({
      description,
      quantity: round2(quantity),
      unit_price: round2(unitPrice),
      amount: round2(quantity * unitPrice),
      is_manual_adjustment: false,
    })

  // Oxygen: flat base for the first 10L, then per-litre beyond 10L.
  const oxygen = Number(memo.oxygen_litres_used || 0)
  if (oxygen > 0 && s.oxygen_base !== undefined) {
    push('Oxygen Charge - Base (first 10L)', 1, s.oxygen_base)
    if (oxygen > 10 && s.oxygen_per_litre !== undefined) {
      const extra = round2(oxygen - 10)
      push(`Oxygen Charge - Additional (${extra}L @ $${s.oxygen_per_litre}/L)`, extra, s.oxygen_per_litre)
    }
  }

  if (memo.has_inconvenience_fee && s.inconvenience_fee !== undefined) {
    push('Inconvenience Fee (Floor/Stair Access)', 1, s.inconvenience_fee)
  }
  if (memo.disposables_used && s.disposables_base !== undefined) {
    push('Disposables Charge (minimum)', 1, s.disposables_base)
  }
  if (memo.resuscitation_performed && s.resuscitation !== undefined) {
    push('Resuscitation Charge', 1, s.resuscitation)
  }
  if (memo.suction_performed && s.suction !== undefined) {
    push('Suction Charge', 1, s.suction)
  }

  // Waiting time charged per completed 30-minute block.
  const waiting = Number(memo.waiting_time_minutes || 0)
  if (waiting > 0 && s.waiting_time_per_30min !== undefined) {
    const blocks = Math.floor(waiting / 30)
    if (blocks > 0) push(`Waiting Time (${blocks} x 30-min block${blocks > 1 ? 's' : ''})`, blocks, s.waiting_time_per_30min)
  }

  // Heavy lifting for patients >= 90 kg. Engine applies the minimum; Sarah can adjust up to max.
  const weight = memo.patient_weight_kg === null || memo.patient_weight_kg === undefined ? null : Number(memo.patient_weight_kg)
  if (weight !== null && weight >= 90 && s.heavy_lifting_min !== undefined) {
    push('Heavy Lifting Surcharge (patient >=90 kg)', 1, s.heavy_lifting_min)
  }

  // Jurong Island transport. Engine applies the minimum; Sarah can adjust up to max.
  if (memo.is_jurong_island && s.jurong_island_min !== undefined) {
    push('Jurong Island Transport Surcharge', 1, s.jurong_island_min)
  }

  return items
}

// Runs the full engine. Returns:
//   { matched: bool, baseRate, lineItems, subtotal }
// matched is false when no base rate row fits the memo (caller marks the invoice 'unmatched').
function computeInvoiceLineItems(memo, rates, surchargeRows) {
  const baseRate = selectBaseRate(rates, memo.is_office_hours)
  if (!baseRate) {
    return { matched: false, baseRate: null, lineItems: [], subtotal: 0 }
  }

  const baseAmount = Number(baseRate.base_amount)
  const lineItems = [{
    description: baseRateDescription(memo, baseRate.time_of_day),
    quantity: 1,
    unit_price: round2(baseAmount),
    amount: round2(baseAmount),
    is_manual_adjustment: false,
  }]

  const surchargeMap = toSurchargeMap(surchargeRows)
  lineItems.push(...buildSurchargeLineItems(memo, surchargeMap))

  const subtotal = round2(lineItems.reduce((sum, li) => sum + li.amount, 0))
  return { matched: true, baseRate, lineItems, subtotal }
}

module.exports = {
  round2,
  toSurchargeMap,
  selectBaseRate,
  buildSurchargeLineItems,
  computeInvoiceLineItems,
  SERVICE_TYPE_LABELS,
  TRANSFER_TYPE_LABELS,
}
