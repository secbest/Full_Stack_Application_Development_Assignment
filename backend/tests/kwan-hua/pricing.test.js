const { computeInvoiceLineItems, selectBaseRate, toSurchargeMap } = require('../../src/services/pricingService')

// Full published surcharge schedule as { type: amount } rows.
const SURCHARGE_ROWS = [
  { surcharge_type: 'oxygen_base', amount: '50.00' },
  { surcharge_type: 'oxygen_per_litre', amount: '1.00' },
  { surcharge_type: 'inconvenience_fee', amount: '50.00' },
  { surcharge_type: 'disposables_base', amount: '20.00' },
  { surcharge_type: 'resuscitation', amount: '320.00' },
  { surcharge_type: 'suction', amount: '50.00' },
  { surcharge_type: 'waiting_time_per_30min', amount: '30.00' },
  { surcharge_type: 'heavy_lifting_min', amount: '50.00' },
  { surcharge_type: 'jurong_island_min', amount: '150.00' },
]

const RATES = [
  { service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: '850.00' },
  { service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'non_office_hours', base_amount: '950.00' },
]

function baseMemo(overrides = {}) {
  return {
    service_type: 'eas',
    transfer_type: 'one_way_hospital',
    is_office_hours: true,
    oxygen_litres_used: 0,
    has_inconvenience_fee: false,
    disposables_used: false,
    resuscitation_performed: false,
    suction_performed: false,
    waiting_time_minutes: 0,
    patient_weight_kg: null,
    is_jurong_island: false,
    ...overrides,
  }
}

describe('pricingService.selectBaseRate', () => {
  test('prefers the office_hours row when the job is in office hours', () => {
    expect(selectBaseRate(RATES, true).time_of_day).toBe('office_hours')
  })
  test('prefers the non_office_hours row when out of office hours', () => {
    expect(selectBaseRate(RATES, false).time_of_day).toBe('non_office_hours')
  })
  test('falls back to an all_hours row when no time-specific row exists', () => {
    const allHours = [{ service_type: 'mts', transfer_type: 'sg_jb_ground', time_of_day: 'all_hours', base_amount: '1800.00' }]
    expect(selectBaseRate(allHours, true).time_of_day).toBe('all_hours')
  })
  test('returns null when no rate row is available', () => {
    expect(selectBaseRate([], true)).toBeNull()
  })
})

describe('pricingService.computeInvoiceLineItems (UC-04)', () => {
  test('base rate only when no surcharge flags are set', () => {
    const r = computeInvoiceLineItems(baseMemo(), RATES, SURCHARGE_ROWS)
    expect(r.matched).toBe(true)
    expect(r.lineItems).toHaveLength(1)
    expect(r.lineItems[0].amount).toBe(850)
    expect(r.subtotal).toBe(850)
  })

  test('picks the non-office-hours base rate', () => {
    const r = computeInvoiceLineItems(baseMemo({ is_office_hours: false }), RATES, SURCHARGE_ROWS)
    expect(r.lineItems[0].unit_price).toBe(950)
    expect(r.subtotal).toBe(950)
  })

  test('oxygen over 10L adds base + per-litre lines', () => {
    const r = computeInvoiceLineItems(baseMemo({ oxygen_litres_used: 12 }), RATES, SURCHARGE_ROWS)
    // 850 base + 50 oxygen base + 2L * $1 = 902
    expect(r.subtotal).toBe(902)
    const oxygenExtra = r.lineItems.find((li) => li.description.includes('Additional'))
    expect(oxygenExtra.quantity).toBe(2)
    expect(oxygenExtra.amount).toBe(2)
  })

  test('oxygen at or under 10L adds only the base charge', () => {
    const r = computeInvoiceLineItems(baseMemo({ oxygen_litres_used: 8 }), RATES, SURCHARGE_ROWS)
    expect(r.subtotal).toBe(900) // 850 + 50 base, no per-litre
    expect(r.lineItems.some((li) => li.description.includes('Additional'))).toBe(false)
  })

  test('waiting time charges per completed 30-min block (65 min -> 2 blocks)', () => {
    const r = computeInvoiceLineItems(baseMemo({ waiting_time_minutes: 65 }), RATES, SURCHARGE_ROWS)
    const wait = r.lineItems.find((li) => li.description.startsWith('Waiting Time'))
    expect(wait.quantity).toBe(2)
    expect(wait.amount).toBe(60)
    expect(r.subtotal).toBe(910)
  })

  test('waiting time under 30 min adds no charge', () => {
    const r = computeInvoiceLineItems(baseMemo({ waiting_time_minutes: 20 }), RATES, SURCHARGE_ROWS)
    expect(r.lineItems.some((li) => li.description.startsWith('Waiting Time'))).toBe(false)
  })

  test('heavy lifting applies at exactly 90 kg but not below', () => {
    expect(computeInvoiceLineItems(baseMemo({ patient_weight_kg: 90 }), RATES, SURCHARGE_ROWS).subtotal).toBe(900)
    expect(computeInvoiceLineItems(baseMemo({ patient_weight_kg: 89.9 }), RATES, SURCHARGE_ROWS).subtotal).toBe(850)
  })

  test('stacks multiple surcharges and sums the subtotal', () => {
    const r = computeInvoiceLineItems(
      baseMemo({ has_inconvenience_fee: true, disposables_used: true, resuscitation_performed: true, suction_performed: true, is_jurong_island: true }),
      RATES, SURCHARGE_ROWS
    )
    // 850 + 50 inconvenience + 20 disposables + 320 resus + 50 suction + 150 jurong = 1440
    expect(r.subtotal).toBe(1440)
    expect(r.lineItems).toHaveLength(6)
  })

  test('skips surcharges the contract does not price', () => {
    const skimpy = [{ surcharge_type: 'inconvenience_fee', amount: '50.00' }]
    const r = computeInvoiceLineItems(baseMemo({ resuscitation_performed: true, has_inconvenience_fee: true }), RATES, skimpy)
    // resuscitation not priced -> only inconvenience applies
    expect(r.subtotal).toBe(900)
    expect(r.lineItems.some((li) => li.description === 'Resuscitation Charge')).toBe(false)
  })

  test('returns matched=false when no base rate row fits (controller passes no rates)', () => {
    // The controller pre-filters pricing_rates by service_type + transfer_type, so a memo
    // whose combination has no rate row arrives here as an empty rates array.
    const r = computeInvoiceLineItems(baseMemo({ transfer_type: 'air_evacuation' }), [], SURCHARGE_ROWS)
    expect(r.matched).toBe(false)
    expect(r.lineItems).toHaveLength(0)
  })

  test('every engine-generated line item is flagged is_manual_adjustment=false', () => {
    const r = computeInvoiceLineItems(baseMemo({ has_inconvenience_fee: true }), RATES, SURCHARGE_ROWS)
    expect(r.lineItems.every((li) => li.is_manual_adjustment === false)).toBe(true)
  })
})

describe('pricingService.toSurchargeMap', () => {
  test('reduces rows to a type->amount number map', () => {
    const map = toSurchargeMap([{ surcharge_type: 'suction', amount: '50.00' }])
    expect(map.suction).toBe(50)
  })
})
