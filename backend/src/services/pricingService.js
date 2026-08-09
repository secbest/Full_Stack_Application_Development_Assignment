// Owner: Kwan Hua (Wave 3 takeover of the AR stream). AR design authored by Jasper (design/jasper/).
//
// UC-04: The pricing engine. Given a submitted service memo, the client's matched
// base rate row, and the contract's surcharge schedule, it produces the ordered list
// of invoice line items. This module is PURE (no DB, no req/res) so the surcharge
// maths can be unit-tested in isolation - the controller does the DB lookups and
// passes the rows in.

// Shared cents-safe rounding (see utils/money.js for why the naive n*100 form is unsafe).
// Still re-exported from this module because the pricing unit tests import it from here.
const { round2 } = require('../utils/money')

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
  standby: 'Manpower Standby (No Transfer)',
}

// Human-readable names for the surcharge types, used when reporting a chargeable
// item the contract has no rate for (see UNPRICED below).
const SURCHARGE_TYPE_LABELS = {
  oxygen_base: 'Oxygen (base)',
  oxygen_per_litre: 'Oxygen (per litre beyond 10L)',
  inconvenience_fee: 'Inconvenience fee (floor/stair access)',
  disposables_base: 'Disposables',
  resuscitation: 'Resuscitation',
  suction: 'Suction',
  waiting_time_per_30min: 'Waiting time',
  heavy_lifting_min: 'Heavy lifting (patient >=90 kg)',
  jurong_island_min: 'Jurong Island transport',
  overtime_per_hour: 'Overtime',
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
// Each applicable surcharge becomes its own line item.
//
// Returns { items, unpriced }. A surcharge the crew recorded but the contract has no rate
// for is NOT silently dropped - it lands in `unpriced` so the AR Specialist is told about
// the gap, because a charge that quietly evaporates is exactly the revenue leakage this
// system exists to stop. The caller persists `unpriced` on the invoice.
function buildSurchargeLineItems(memo, s) {
  const items = []
  const unpriced = []

  const push = (description, quantity, unitPrice) =>
    items.push({
      description,
      quantity: round2(quantity),
      unit_price: round2(unitPrice),
      amount: round2(quantity * unitPrice),
      is_manual_adjustment: false,
      line_type: 'surcharge',
    })

  // Records a chargeable item the contract cannot price. `detail` carries the recorded
  // value so Sarah can price it manually without reopening the memo.
  //
  // `quantity` is the same numeric quantity the line item WOULD have carried had the
  // contract priced it. It is stored as a number, not only inside the human-readable
  // `detail` string, so the revenue leakage report can value the gap (quantity x a peer
  // contract's rate for the same surcharge) instead of trying to parse "3 h recorded".
  const skip = (surchargeType, detail, quantity = 1) =>
    unpriced.push({
      surcharge_type: surchargeType,
      label: SURCHARGE_TYPE_LABELS[surchargeType] || surchargeType,
      detail,
      quantity: round2(quantity),
    })

  // Charges a surcharge if the contract prices it, otherwise reports it as unpriced.
  const charge = (applies, surchargeType, description, quantity, detail) => {
    if (!applies) return
    if (s[surchargeType] === undefined) return skip(surchargeType, detail, quantity)
    push(description, quantity, s[surchargeType])
  }

  // Oxygen: flat base for the first 10L, then per-litre beyond 10L. The two tiers are
  // priced independently, so a contract can price the base and still be missing the
  // per-litre rate - both gaps are reported separately.
  const oxygen = Number(memo.oxygen_litres_used || 0)
  if (oxygen > 0) {
    charge(true, 'oxygen_base', 'Oxygen Charge - Base (first 10L)', 1, `${oxygen}L used`)
    if (oxygen > 10) {
      const extra = round2(oxygen - 10)
      if (s.oxygen_per_litre !== undefined) {
        push(`Oxygen Charge - Additional (${extra}L @ $${s.oxygen_per_litre}/L)`, extra, s.oxygen_per_litre)
      } else {
        skip('oxygen_per_litre', `${extra}L beyond the first 10L`, extra)
      }
    }
  }

  charge(memo.has_inconvenience_fee, 'inconvenience_fee', 'Inconvenience Fee (Floor/Stair Access)', 1, 'recorded on memo')
  charge(memo.disposables_used, 'disposables_base', 'Disposables Charge (minimum)', 1, 'recorded on memo')
  charge(memo.resuscitation_performed, 'resuscitation', 'Resuscitation Charge', 1, 'performed')
  charge(memo.suction_performed, 'suction', 'Suction Charge', 1, 'performed')

  // Overtime beyond the standard shift, charged per hour. The memo wizard captures this
  // and the submission validator cross-checks it against the job duration, so it is a
  // deliberate, verified figure - it must reach the invoice.
  const overtime = Number(memo.overtime_hours || 0)
  if (overtime > 0) {
    if (s.overtime_per_hour !== undefined) {
      push(`Overtime (${overtime} h @ $${s.overtime_per_hour}/h)`, overtime, s.overtime_per_hour)
    } else {
      skip('overtime_per_hour', `${overtime} h recorded`, overtime)
    }
  }

  // Waiting time charged per completed 30-minute block. Under 30 minutes nothing is
  // chargeable at all, so an unpriced contract is only worth reporting once a full
  // block has accrued.
  const waiting = Number(memo.waiting_time_minutes || 0)
  const blocks = Math.floor(waiting / 30)
  if (blocks > 0) {
    if (s.waiting_time_per_30min !== undefined) {
      push(`Waiting Time (${blocks} x 30-min block${blocks > 1 ? 's' : ''})`, blocks, s.waiting_time_per_30min)
    } else {
      skip('waiting_time_per_30min', `${waiting} min (${blocks} chargeable block${blocks > 1 ? 's' : ''})`, blocks)
    }
  }

  // Heavy lifting for patients >= 90 kg. Engine applies the minimum; Sarah can adjust up to max.
  const weight = memo.patient_weight_kg === null || memo.patient_weight_kg === undefined ? null : Number(memo.patient_weight_kg)
  charge(weight !== null && weight >= 90, 'heavy_lifting_min', 'Heavy Lifting Surcharge (patient >=90 kg)', 1, `patient ${weight} kg`)

  // Jurong Island transport. Engine applies the minimum; Sarah can adjust up to max.
  charge(memo.is_jurong_island, 'jurong_island_min', 'Jurong Island Transport Surcharge', 1, 'recorded on memo')

  return { items, unpriced }
}

// Runs the full engine. Returns:
//   { matched: bool, baseRate, lineItems, subtotal, unpriced }
// matched is false when no base rate row fits the memo (caller marks the invoice 'unmatched').
// unpriced lists chargeable items the contract has no rate for - the caller persists it on
// the invoice so the AR Specialist can price them manually rather than lose the revenue.
function computeInvoiceLineItems(memo, rates, surchargeRows) {
  const surchargeMap = toSurchargeMap(surchargeRows)
  const { items: surchargeItems, unpriced } = buildSurchargeLineItems(memo, surchargeMap)

  const baseRate = selectBaseRate(rates, memo.is_office_hours)
  if (!baseRate) {
    // Still report the unpriced surcharges: an unmatched invoice has to be priced by hand,
    // and this is the list of what the crew recorded that needs pricing.
    return { matched: false, baseRate: null, lineItems: [], subtotal: 0, unpriced }
  }

  const baseAmount = Number(baseRate.base_amount)
  const lineItems = [{
    description: baseRateDescription(memo, baseRate.time_of_day),
    quantity: 1,
    unit_price: round2(baseAmount),
    amount: round2(baseAmount),
    is_manual_adjustment: false,
    // The transport charge. The approval guard requires exactly this row to exist before
    // an invoice can be pushed to Xero.
    line_type: 'base',
  }]

  lineItems.push(...surchargeItems)

  const subtotal = round2(lineItems.reduce((sum, li) => sum + li.amount, 0))
  return { matched: true, baseRate, lineItems, subtotal, unpriced }
}

// A booking quotation is an immutable base-price handoff from Quotations to AR. It is
// usable only when the field memo describes the same service combination that was sold.
// A changed job is deliberately left for human review rather than silently billing the
// customer using a quote for a different service.
function quotationMatchesMemo(booking, memo) {
  if (!booking || !memo || !booking.pricing_source || booking.quoted_base_amount === null
    || booking.quoted_base_amount === undefined || !booking.quoted_transfer_type
    || !booking.quoted_time_of_day) return false
  const actualTime = memo.is_office_hours ? 'office_hours' : 'non_office_hours'
  return booking.service_type === memo.service_type
    && booking.quoted_transfer_type === memo.transfer_type
    && (booking.quoted_time_of_day === 'all_hours' || booking.quoted_time_of_day === actualTime)
}

function computeQuotedInvoiceLineItems(booking, memo, surchargeRows = []) {
  if (!quotationMatchesMemo(booking, memo)) {
    return { matched: false, baseRate: null, lineItems: [], subtotal: 0, unpriced: [] }
  }
  const result = computeInvoiceLineItems(memo, [{
    time_of_day: booking.quoted_time_of_day,
    base_amount: Number(booking.quoted_base_amount),
  }], surchargeRows)
  if (result.lineItems[0]) {
    const source = booking.pricing_source === 'one_off_quote' ? 'One-Off Quote' : 'Quoted Contract Rate'
    result.lineItems[0].description = `${source} - ${result.lineItems[0].description}`
  }
  return result
}

module.exports = {
  round2,
  toSurchargeMap,
  selectBaseRate,
  buildSurchargeLineItems,
  computeInvoiceLineItems,
  quotationMatchesMemo,
  computeQuotedInvoiceLineItems,
  SERVICE_TYPE_LABELS,
  TRANSFER_TYPE_LABELS,
  SURCHARGE_TYPE_LABELS,
}
