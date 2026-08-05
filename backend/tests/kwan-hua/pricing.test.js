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
  { surcharge_type: 'overtime_per_hour', amount: '45.00' },
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
    overtime_hours: 0,
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

  // Overtime is captured on the memo and cross-checked by the submission validator, but was
  // never read by the engine - so hours the crew recorded were never billed. That is the exact
  // revenue leakage this platform exists to stop, so it gets explicit coverage.
  test('bills recorded overtime per hour', () => {
    const r = computeInvoiceLineItems(baseMemo({ overtime_hours: 2.5 }), RATES, SURCHARGE_ROWS)
    const ot = r.lineItems.find((li) => li.description.startsWith('Overtime'))
    expect(ot).toBeDefined()
    expect(ot.quantity).toBe(2.5)
    expect(ot.unit_price).toBe(45)
    expect(ot.amount).toBe(112.5)
    expect(r.subtotal).toBe(962.5) // 850 base + 112.50 overtime
  })

  test('adds no overtime line when none was recorded', () => {
    const r = computeInvoiceLineItems(baseMemo({ overtime_hours: 0 }), RATES, SURCHARGE_ROWS)
    expect(r.lineItems.some((li) => li.description.startsWith('Overtime'))).toBe(false)
    expect(r.unpriced).toEqual([])
  })
})

// A charge the crew recorded that the contract cannot price must be reported, not dropped.
describe('pricingService unpriced surcharge reporting', () => {
  test('reports a recorded charge the contract has no rate for', () => {
    const skimpy = [{ surcharge_type: 'inconvenience_fee', amount: '50.00' }]
    const r = computeInvoiceLineItems(baseMemo({ resuscitation_performed: true, has_inconvenience_fee: true }), RATES, skimpy)

    expect(r.unpriced).toHaveLength(1)
    expect(r.unpriced[0]).toMatchObject({ surcharge_type: 'resuscitation', label: 'Resuscitation' })
  })

  test('reports unpriced overtime with the hours recorded', () => {
    const noOvertime = SURCHARGE_ROWS.filter((s) => s.surcharge_type !== 'overtime_per_hour')
    const r = computeInvoiceLineItems(baseMemo({ overtime_hours: 3 }), RATES, noOvertime)

    expect(r.lineItems.some((li) => li.description.startsWith('Overtime'))).toBe(false)
    expect(r.unpriced).toEqual([
      expect.objectContaining({ surcharge_type: 'overtime_per_hour', detail: '3 h recorded' }),
    ])
  })

  test('reports the oxygen tiers independently when only the base rate is priced', () => {
    const baseOnly = [{ surcharge_type: 'oxygen_base', amount: '50.00' }]
    const r = computeInvoiceLineItems(baseMemo({ oxygen_litres_used: 15 }), RATES, baseOnly)

    // Base charged, the 5 extra litres reported rather than quietly discarded.
    expect(r.subtotal).toBe(900)
    expect(r.unpriced).toEqual([
      expect.objectContaining({ surcharge_type: 'oxygen_per_litre', detail: '5L beyond the first 10L' }),
    ])
  })

  test('stays silent about waiting time below one chargeable block', () => {
    const noWaiting = SURCHARGE_ROWS.filter((s) => s.surcharge_type !== 'waiting_time_per_30min')
    // 20 minutes is not chargeable under any contract, so there is no gap to report.
    const under = computeInvoiceLineItems(baseMemo({ waiting_time_minutes: 20 }), RATES, noWaiting)
    expect(under.unpriced).toEqual([])

    // 65 minutes is two chargeable blocks - now the missing rate is a real gap.
    const over = computeInvoiceLineItems(baseMemo({ waiting_time_minutes: 65 }), RATES, noWaiting)
    expect(over.unpriced).toEqual([
      expect.objectContaining({ surcharge_type: 'waiting_time_per_30min', detail: '65 min (2 chargeable blocks)' }),
    ])
  })

  test('reports unpriced charges even when no base rate matched at all', () => {
    const r = computeInvoiceLineItems(baseMemo({ resuscitation_performed: true, overtime_hours: 1 }), [], [])
    expect(r.matched).toBe(false)
    expect(r.unpriced.map((u) => u.surcharge_type).sort()).toEqual(['overtime_per_hour', 'resuscitation'])
  })

  // The leakage report values each gap as quantity x a peer contract's rate, so the
  // quantity has to be a NUMBER on the entry - not only embedded in the `detail` string,
  // which would leave the report parsing "3 h recorded" to find a 3.
  test('records a numeric quantity on every unpriced entry for the leakage report', () => {
    const noOvertime = SURCHARGE_ROWS.filter((s) => s.surcharge_type !== 'overtime_per_hour')
    expect(computeInvoiceLineItems(baseMemo({ overtime_hours: 3 }), RATES, noOvertime).unpriced[0].quantity).toBe(3)

    const baseOnly = [{ surcharge_type: 'oxygen_base', amount: '50.00' }]
    expect(computeInvoiceLineItems(baseMemo({ oxygen_litres_used: 15 }), RATES, baseOnly).unpriced[0].quantity).toBe(5)

    const noWaiting = SURCHARGE_ROWS.filter((s) => s.surcharge_type !== 'waiting_time_per_30min')
    // Blocks, not raw minutes: waiting time is charged per completed 30-minute block.
    expect(computeInvoiceLineItems(baseMemo({ waiting_time_minutes: 65 }), RATES, noWaiting).unpriced[0].quantity).toBe(2)

    // A flat, once-per-job surcharge is quantity 1.
    const noResus = SURCHARGE_ROWS.filter((s) => s.surcharge_type !== 'resuscitation')
    expect(computeInvoiceLineItems(baseMemo({ resuscitation_performed: true }), RATES, noResus).unpriced[0].quantity).toBe(1)
  })

  test('reports nothing when the contract prices everything recorded', () => {
    const r = computeInvoiceLineItems(
      baseMemo({ resuscitation_performed: true, overtime_hours: 2, oxygen_litres_used: 12, is_jurong_island: true }),
      RATES, SURCHARGE_ROWS
    )
    expect(r.unpriced).toEqual([])
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
