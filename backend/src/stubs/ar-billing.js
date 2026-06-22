'use strict'

// In-memory stub data for AR Billing, Pricing Engine & Invoice Sync routes.
// Use this while teammate tables (service_memos, bookings, clients) are not yet built.
//
// Usage in a route:
//   const { invoices, lineItems, contracts } = require('../stubs/ar-billing')
//   router.get('/invoices', (req, res) => res.json(invoices))
//
// Replace individual exports with real DB queries as each model becomes available.

// ---------------------------------------------------------------------------
// Shared stub data from group tables (replace with real DB lookups when ready)
// ---------------------------------------------------------------------------

const clients = [
  { id: 1, name: 'Tan Tock Seng Hospital', contact_email: 'billing@ttsh.com.sg' },
  { id: 2, name: 'ABC Corporation',        contact_email: 'finance@abc-corp.com.sg' },
  { id: 3, name: 'SingHealth Group',       contact_email: 'ap@singhealth.com.sg' },
]

const users = [
  { id: 1, name: 'Sarah Lim',  role: 'ar_specialist' },
  { id: 2, name: 'Doris Tan',  role: 'managing_director' },
  { id: 3, name: 'Ravi Kumar', role: 'field_crew' },
]

// Minimal service_memo stubs (Liang Yi's table) - just the pricing-engine fields
const serviceMemos = [
  {
    id: 1, booking_id: 1, status: 'reviewed',
    service_type: 'eas',    transfer_type: 'one_way_hospital', is_office_hours: true,
    oxygen_litres_used: 0,  has_inconvenience_fee: false, disposables_used: false,
    resuscitation_performed: false, suction_performed: false,
    waiting_time_minutes: 0, patient_weight_kg: 70, is_jurong_island: false,
  },
  {
    id: 2, booking_id: 2, status: 'reviewed',
    service_type: 'eas',    transfer_type: 'one_way_hospital', is_office_hours: false,
    oxygen_litres_used: 15, has_inconvenience_fee: true, disposables_used: false,
    resuscitation_performed: false, suction_performed: false,
    waiting_time_minutes: 0, patient_weight_kg: 65, is_jurong_island: false,
  },
  {
    id: 3, booking_id: 3, status: 'reviewed',
    service_type: 'eas',    transfer_type: 'covid_19', is_office_hours: true,
    oxygen_litres_used: 0,  has_inconvenience_fee: false, disposables_used: true,
    resuscitation_performed: true, suction_performed: true,
    waiting_time_minutes: 0, patient_weight_kg: 80, is_jurong_island: false,
  },
  {
    id: 4, booking_id: 4, status: 'reviewed',
    service_type: 'mts',    transfer_type: 'airport_with_tarmac', is_office_hours: false,
    oxygen_litres_used: 0,  has_inconvenience_fee: false, disposables_used: false,
    resuscitation_performed: false, suction_performed: false,
    waiting_time_minutes: 0, patient_weight_kg: 95, is_jurong_island: true,
  },
  {
    id: 5, booking_id: 5, status: 'reviewed',
    service_type: 'eas',    transfer_type: 'one_way_hospital', is_office_hours: true,
    oxygen_litres_used: 0,  has_inconvenience_fee: false, disposables_used: false,
    resuscitation_performed: false, suction_performed: false,
    waiting_time_minutes: 0, patient_weight_kg: 75, is_jurong_island: false,
  },
  {
    id: 6, booking_id: 6, status: 'reviewed',
    service_type: 'eas',    transfer_type: 'one_way_hospital', is_office_hours: true,
    oxygen_litres_used: 0,  has_inconvenience_fee: false, disposables_used: false,
    resuscitation_performed: false, suction_performed: false,
    waiting_time_minutes: 0, patient_weight_kg: 70, is_jurong_island: false,
  },
]

// Minimal booking stubs (Zheng Bao's table)
const bookings = [
  { id: 1, client_id: 1, status: 'completed', scheduled_date: '2026-06-10' },
  { id: 2, client_id: 1, status: 'completed', scheduled_date: '2026-06-11' },
  { id: 3, client_id: 1, status: 'completed', scheduled_date: '2026-06-13' },
  { id: 4, client_id: 1, status: 'completed', scheduled_date: '2026-06-14' },
  { id: 5, client_id: 1, status: 'completed', scheduled_date: '2026-06-15' },
  { id: 6, client_id: 3, status: 'completed', scheduled_date: '2026-06-16' },
]

// ---------------------------------------------------------------------------
// pricing_contracts
// ---------------------------------------------------------------------------

const contracts = [
  {
    id: 1, client_id: 1, created_by: 1,
    contract_name: 'Tan Tock Seng Hospital - FY2026 Service Agreement',
    effective_from: '2026-01-01', effective_to: '2026-12-31', is_active: true,
    created_at: '2026-01-01T08:00:00.000Z', updated_at: '2026-01-01T08:00:00.000Z',
  },
  {
    id: 2, client_id: 2, created_by: 1,
    contract_name: 'ABC Corporation - Event & Workplace Standby 2026',
    effective_from: '2026-06-01', effective_to: '2026-12-31', is_active: true,
    created_at: '2026-05-20T08:00:00.000Z', updated_at: '2026-05-20T08:00:00.000Z',
  },
  {
    id: 3, client_id: 3, created_by: 1,
    contract_name: 'SingHealth Group - FY2025 Service Agreement',
    effective_from: '2025-01-01', effective_to: '2025-12-31', is_active: false,
    created_at: '2025-01-01T08:00:00.000Z', updated_at: '2025-12-31T23:59:00.000Z',
  },
]

// ---------------------------------------------------------------------------
// pricing_rates
// ---------------------------------------------------------------------------

const rates = [
  // Contract 1 - TTSH - EAS
  { id: 1,  contract_id: 1, service_type: 'eas', transfer_type: 'one_way_hospital',    time_of_day: 'office_hours',     base_amount: 850.00  },
  { id: 2,  contract_id: 1, service_type: 'eas', transfer_type: 'one_way_hospital',    time_of_day: 'non_office_hours', base_amount: 950.00  },
  { id: 3,  contract_id: 1, service_type: 'eas', transfer_type: 'two_way_hospital',    time_of_day: 'all_hours',        base_amount: 1500.00 },
  { id: 4,  contract_id: 1, service_type: 'eas', transfer_type: 'covid_19',            time_of_day: 'all_hours',        base_amount: 1200.00 },
  { id: 5,  contract_id: 1, service_type: 'eas', transfer_type: 'imh_psychiatric',     time_of_day: 'all_hours',        base_amount: 1100.00 },
  { id: 6,  contract_id: 1, service_type: 'eas', transfer_type: 'airport_no_tarmac',   time_of_day: 'all_hours',        base_amount: 1050.00 },
  { id: 7,  contract_id: 1, service_type: 'eas', transfer_type: 'airport_with_tarmac', time_of_day: 'all_hours',        base_amount: 1250.00 },
  { id: 8,  contract_id: 1, service_type: 'eas', transfer_type: 'air_evacuation',      time_of_day: 'all_hours',        base_amount: 5000.00 },
  // Contract 1 - TTSH - MTS
  { id: 9,  contract_id: 1, service_type: 'mts', transfer_type: 'one_way_hospital',    time_of_day: 'office_hours',     base_amount: 550.00  },
  { id: 10, contract_id: 1, service_type: 'mts', transfer_type: 'one_way_hospital',    time_of_day: 'non_office_hours', base_amount: 650.00  },
  { id: 11, contract_id: 1, service_type: 'mts', transfer_type: 'two_way_hospital',    time_of_day: 'all_hours',        base_amount: 900.00  },
  { id: 12, contract_id: 1, service_type: 'mts', transfer_type: 'airport_no_tarmac',   time_of_day: 'all_hours',        base_amount: 900.00  },
  { id: 13, contract_id: 1, service_type: 'mts', transfer_type: 'airport_with_tarmac', time_of_day: 'all_hours',        base_amount: 1050.00 },
  { id: 14, contract_id: 1, service_type: 'mts', transfer_type: 'sg_jb_ground',        time_of_day: 'all_hours',        base_amount: 1800.00 },
  // Contract 2 - ABC Corp
  { id: 15, contract_id: 2, service_type: 'event_standby',    transfer_type: 'one_way_hospital', time_of_day: 'office_hours',     base_amount: 700.00 },
  { id: 16, contract_id: 2, service_type: 'event_standby',    transfer_type: 'one_way_hospital', time_of_day: 'non_office_hours', base_amount: 800.00 },
  { id: 17, contract_id: 2, service_type: 'workplace_standby',transfer_type: 'one_way_hospital', time_of_day: 'all_hours',        base_amount: 750.00 },
]

// ---------------------------------------------------------------------------
// surcharge_schedules
// ---------------------------------------------------------------------------

const surcharges = [
  // Contract 1 - default published rates
  { id: 1,  contract_id: 1, surcharge_type: 'oxygen_base',            amount: 50.00  },
  { id: 2,  contract_id: 1, surcharge_type: 'oxygen_per_litre',       amount: 1.00   },
  { id: 3,  contract_id: 1, surcharge_type: 'inconvenience_fee',      amount: 50.00  },
  { id: 4,  contract_id: 1, surcharge_type: 'disposables_base',       amount: 20.00  },
  { id: 5,  contract_id: 1, surcharge_type: 'resuscitation',          amount: 320.00 },
  { id: 6,  contract_id: 1, surcharge_type: 'suction',                amount: 50.00  },
  { id: 7,  contract_id: 1, surcharge_type: 'waiting_time_per_30min', amount: 30.00  },
  { id: 8,  contract_id: 1, surcharge_type: 'heavy_lifting_min',      amount: 50.00  },
  { id: 9,  contract_id: 1, surcharge_type: 'heavy_lifting_max',      amount: 150.00 },
  { id: 10, contract_id: 1, surcharge_type: 'jurong_island_min',      amount: 150.00 },
  { id: 11, contract_id: 1, surcharge_type: 'jurong_island_max',      amount: 200.00 },
  { id: 12, contract_id: 1, surcharge_type: 'cancellation',           amount: 100.00 },
  // Contract 2 - ABC Corp (negotiated differences: higher Jurong Island max, 50% cancellation)
  { id: 13, contract_id: 2, surcharge_type: 'oxygen_base',            amount: 50.00  },
  { id: 14, contract_id: 2, surcharge_type: 'oxygen_per_litre',       amount: 1.00   },
  { id: 15, contract_id: 2, surcharge_type: 'inconvenience_fee',      amount: 50.00  },
  { id: 16, contract_id: 2, surcharge_type: 'disposables_base',       amount: 20.00  },
  { id: 17, contract_id: 2, surcharge_type: 'resuscitation',          amount: 320.00 },
  { id: 18, contract_id: 2, surcharge_type: 'suction',                amount: 50.00  },
  { id: 19, contract_id: 2, surcharge_type: 'waiting_time_per_30min', amount: 30.00  },
  { id: 20, contract_id: 2, surcharge_type: 'heavy_lifting_min',      amount: 50.00  },
  { id: 21, contract_id: 2, surcharge_type: 'heavy_lifting_max',      amount: 150.00 },
  { id: 22, contract_id: 2, surcharge_type: 'jurong_island_min',      amount: 150.00 },
  { id: 23, contract_id: 2, surcharge_type: 'jurong_island_max',      amount: 220.00 },
  { id: 24, contract_id: 2, surcharge_type: 'cancellation',           amount: 50.00  },
]

// ---------------------------------------------------------------------------
// invoices
// ---------------------------------------------------------------------------

const invoices = [
  {
    id: 1, memo_id: 1, booking_id: 1, client_id: 1, contract_id: 1, approved_by: null,
    subtotal: 850.00, tax_amount: 0.00, total_amount: 850.00,
    status: 'matched', xero_invoice_id: null, approved_at: null,
    created_at: '2026-06-10T09:30:00.000Z', updated_at: '2026-06-10T09:30:00.000Z',
  },
  {
    id: 2, memo_id: 2, booking_id: 2, client_id: 1, contract_id: 1, approved_by: null,
    subtotal: 1080.00, tax_amount: 0.00, total_amount: 1080.00,
    status: 'adjusted', xero_invoice_id: null, approved_at: null,
    created_at: '2026-06-11T22:15:00.000Z', updated_at: '2026-06-12T10:00:00.000Z',
  },
  {
    id: 3, memo_id: 3, booking_id: 3, client_id: 1, contract_id: 1, approved_by: 1,
    subtotal: 1570.00, tax_amount: 0.00, total_amount: 1570.00,
    status: 'approved', xero_invoice_id: null, approved_at: '2026-06-13T14:00:00.000Z',
    created_at: '2026-06-13T11:00:00.000Z', updated_at: '2026-06-13T14:00:00.000Z',
  },
  {
    id: 4, memo_id: 4, booking_id: 4, client_id: 1, contract_id: 1, approved_by: 1,
    subtotal: 1200.00, tax_amount: 0.00, total_amount: 1200.00,
    status: 'synced_to_xero', xero_invoice_id: 'INV-XR-20260614-0041', approved_at: '2026-06-14T09:00:00.000Z',
    created_at: '2026-06-14T07:30:00.000Z', updated_at: '2026-06-14T09:45:00.000Z',
  },
  {
    id: 5, memo_id: 5, booking_id: 5, client_id: 1, contract_id: 1, approved_by: 1,
    subtotal: 850.00, tax_amount: 0.00, total_amount: 850.00,
    status: 'failed', xero_invoice_id: null, approved_at: '2026-06-15T10:00:00.000Z',
    created_at: '2026-06-15T08:00:00.000Z', updated_at: '2026-06-15T10:15:00.000Z',
  },
  {
    id: 6, memo_id: 6, booking_id: 6, client_id: 3, contract_id: 3, approved_by: null,
    subtotal: 0.00, tax_amount: 0.00, total_amount: 0.00,
    status: 'unmatched', xero_invoice_id: null, approved_at: null,
    created_at: '2026-06-16T13:00:00.000Z', updated_at: '2026-06-16T13:00:00.000Z',
  },
]

// ---------------------------------------------------------------------------
// invoice_line_items
// ---------------------------------------------------------------------------

const lineItems = [
  // Invoice 1 - base rate only
  { id: 1,  invoice_id: 1, description: 'EAS - One-Way Hospital Transfer (Office Hours)',      quantity: 1,  unit_price: 850.00, amount: 850.00,  is_manual_adjustment: false },
  // Invoice 2 - base + oxygen (base + overage) + inconvenience + manual adjustment
  { id: 2,  invoice_id: 2, description: 'EAS - One-Way Hospital Transfer (Non-Office Hours)',  quantity: 1,  unit_price: 950.00, amount: 950.00,  is_manual_adjustment: false },
  { id: 3,  invoice_id: 2, description: 'Oxygen Charge - Base (first 10L)',                   quantity: 1,  unit_price: 50.00,  amount: 50.00,   is_manual_adjustment: false },
  { id: 4,  invoice_id: 2, description: 'Oxygen Charge - Additional (5L @ $1/L)',             quantity: 5,  unit_price: 1.00,   amount: 5.00,    is_manual_adjustment: false },
  { id: 5,  invoice_id: 2, description: 'Inconvenience Fee (Floor/Stair Access)',              quantity: 1,  unit_price: 50.00,  amount: 50.00,   is_manual_adjustment: false },
  { id: 6,  invoice_id: 2, description: 'Hospital Administration Fee (Manual Adjustment)',     quantity: 1,  unit_price: 25.00,  amount: 25.00,   is_manual_adjustment: true  },
  // Invoice 3 - COVID + resuscitation + suction
  { id: 7,  invoice_id: 3, description: 'EAS - COVID-19 Case Transport',                      quantity: 1,  unit_price: 1200.00, amount: 1200.00, is_manual_adjustment: false },
  { id: 8,  invoice_id: 3, description: 'Resuscitation Performed',                            quantity: 1,  unit_price: 320.00,  amount: 320.00,  is_manual_adjustment: false },
  { id: 9,  invoice_id: 3, description: 'Suction Performed',                                  quantity: 1,  unit_price: 50.00,   amount: 50.00,   is_manual_adjustment: false },
  // Invoice 4 - airport tarmac + Jurong Island
  { id: 10, invoice_id: 4, description: 'MTS - Airport Transfer (With Tarmac Access)',        quantity: 1,  unit_price: 1050.00, amount: 1050.00, is_manual_adjustment: false },
  { id: 11, invoice_id: 4, description: 'Jurong Island Transport Surcharge',                  quantity: 1,  unit_price: 150.00,  amount: 150.00,  is_manual_adjustment: false },
  // Invoice 5 - base rate (Xero push failed, line items still correct)
  { id: 12, invoice_id: 5, description: 'EAS - One-Way Hospital Transfer (Office Hours)',     quantity: 1,  unit_price: 850.00, amount: 850.00,  is_manual_adjustment: false },
  // Invoice 6 (unmatched) - no line items
]

// ---------------------------------------------------------------------------
// Pricing engine stub
// Simulates the two-step lookup so routes can compute an invoice without the DB.
// Replace with the real Sequelize queries when models are ready.
// ---------------------------------------------------------------------------

/**
 * Look up the base rate for a memo against an active contract.
 * Returns the matching rate row or null if no row found.
 */
function lookupBaseRate(contractId, serviceType, transferType, isOfficeHours) {
  const timeQuery = isOfficeHours ? 'office_hours' : 'non_office_hours'
  return rates.find(
    (r) =>
      r.contract_id === contractId &&
      r.service_type === serviceType &&
      r.transfer_type === transferType &&
      (r.time_of_day === timeQuery || r.time_of_day === 'all_hours')
  ) || null
}

/**
 * Look up a specific surcharge amount for a contract.
 * Returns the amount as a number or 0 if not found.
 */
function lookupSurcharge(contractId, surchargeType) {
  const row = surcharges.find(
    (s) => s.contract_id === contractId && s.surcharge_type === surchargeType
  )
  return row ? row.amount : 0
}

/**
 * Run the full pricing engine against a service memo and a contract id.
 * Returns an object with { subtotal, lineItems } or { error } if no base rate found.
 */
function runPricingEngine(memo, contractId) {
  const baseRate = lookupBaseRate(contractId, memo.service_type, memo.transfer_type, memo.is_office_hours)
  if (!baseRate) {
    return { error: 'no_matching_rate', message: 'No pricing rate found for this service/transfer/time combination' }
  }

  const items = []
  const add = (description, quantity, unit_price) => {
    items.push({ description, quantity, unit_price, amount: quantity * unit_price, is_manual_adjustment: false })
  }

  add(`${memo.service_type.toUpperCase()} - ${memo.transfer_type} (${memo.is_office_hours ? 'Office Hours' : 'Non-Office Hours'})`, 1, baseRate.base_amount)

  if (memo.oxygen_litres_used > 0) {
    add('Oxygen Charge - Base (first 10L)', 1, lookupSurcharge(contractId, 'oxygen_base'))
    const extraLitres = Math.max(0, memo.oxygen_litres_used - 10)
    if (extraLitres > 0) {
      add(`Oxygen Charge - Additional (${extraLitres}L @ $${lookupSurcharge(contractId, 'oxygen_per_litre')}/L)`, extraLitres, lookupSurcharge(contractId, 'oxygen_per_litre'))
    }
  }

  if (memo.has_inconvenience_fee) {
    add('Inconvenience Fee (Floor/Stair Access)', 1, lookupSurcharge(contractId, 'inconvenience_fee'))
  }

  if (memo.disposables_used) {
    add('Disposables Used', 1, lookupSurcharge(contractId, 'disposables_base'))
  }

  if (memo.resuscitation_performed) {
    add('Resuscitation Performed', 1, lookupSurcharge(contractId, 'resuscitation'))
  }

  if (memo.suction_performed) {
    add('Suction Performed', 1, lookupSurcharge(contractId, 'suction'))
  }

  if (memo.waiting_time_minutes > 0) {
    const blocks = Math.floor(memo.waiting_time_minutes / 30)
    if (blocks > 0) {
      add(`Waiting Time (${blocks} x 30min)`, blocks, lookupSurcharge(contractId, 'waiting_time_per_30min'))
    }
  }

  if (memo.patient_weight_kg >= 90) {
    // Sarah selects the final amount within min/max during invoice review.
    // Engine seeds the minimum to give her a starting point.
    add('Heavy Patient Lifting Surcharge (Minimum - adjust as needed)', 1, lookupSurcharge(contractId, 'heavy_lifting_min'))
  }

  if (memo.is_jurong_island) {
    add('Jurong Island Transport Surcharge (Minimum - adjust as needed)', 1, lookupSurcharge(contractId, 'jurong_island_min'))
  }

  const subtotal = items.reduce((sum, i) => sum + i.amount, 0)
  return { subtotal, tax_amount: 0, total_amount: subtotal, lineItems: items }
}

module.exports = {
  clients,
  users,
  serviceMemos,
  bookings,
  contracts,
  rates,
  surcharges,
  invoices,
  lineItems,
  lookupBaseRate,
  lookupSurcharge,
  runPricingEngine,
}
