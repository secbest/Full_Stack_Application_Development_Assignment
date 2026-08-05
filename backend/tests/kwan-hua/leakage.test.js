// leakageService - the revenue leakage report.
//
// The pricing engine records every charge the crew logged that the client's contract had no
// rate for (`unpriced_surcharges` on the invoice). This service turns that into the report
// management asks for: how much is unbilled, which surcharge causes it, which contract to
// fix. Kept pure so the estimation rules - the part actually worth testing - need no DB.
const { buildLeakageReport, buildReferenceRates, valueEntry, median, BASIS } = require('../../src/services/leakageService')

// Two contracts DO price oxygen_per_litre ($2 and $4) and overtime ($60/$60/$90).
// Nothing anywhere prices `suction`, so it can never be valued.
const SURCHARGE_ROWS = [
  { surcharge_type: 'oxygen_per_litre', amount: '2.00' },
  { surcharge_type: 'oxygen_per_litre', amount: '4.00' },
  { surcharge_type: 'overtime_per_hour', amount: '60.00' },
  { surcharge_type: 'overtime_per_hour', amount: '60.00' },
  { surcharge_type: 'overtime_per_hour', amount: '90.00' },
  { surcharge_type: 'inconvenience_fee', amount: '50.00' },
]

function invoice(overrides = {}) {
  return {
    id: 1,
    client_id: 10,
    client_name: 'Jurong Shipyard',
    contract_id: 100,
    contract_name: 'Jurong Shipyard 2026',
    created_at: '2026-07-14T00:00:00.000Z',
    unpriced_surcharges: [],
    ...overrides,
  }
}

describe('median', () => {
  test('returns the middle value for an odd sample', () => {
    expect(median([60, 90, 60])).toBe(60)
  })
  test('averages the two middle values for an even sample', () => {
    expect(median([2, 4])).toBe(3)
  })
  test('returns null for an empty sample rather than 0, which would read as a real rate', () => {
    expect(median([])).toBeNull()
  })
})

describe('buildReferenceRates', () => {
  test('derives a median, sample size and range per surcharge type', () => {
    const ref = buildReferenceRates(SURCHARGE_ROWS)
    expect(ref.oxygen_per_litre).toEqual({ median: 3, sampleSize: 2, min: 2, max: 4 })
    expect(ref.overtime_per_hour).toEqual({ median: 60, sampleSize: 3, min: 60, max: 90 })
  })

  test('omits a surcharge type no contract prices, so nothing can be estimated from it', () => {
    expect(buildReferenceRates(SURCHARGE_ROWS).suction).toBeUndefined()
  })

  test('ignores unparseable amounts instead of poisoning the median with NaN', () => {
    const ref = buildReferenceRates([
      { surcharge_type: 'suction', amount: 'not-a-number' },
      { surcharge_type: 'suction', amount: '30.00' },
    ])
    expect(ref.suction).toEqual({ median: 30, sampleSize: 1, min: 30, max: 30 })
  })
})

describe('valueEntry', () => {
  const reference = buildReferenceRates(SURCHARGE_ROWS)

  test('values a quantified entry at quantity x peer median', () => {
    const valued = valueEntry({ surcharge_type: 'overtime_per_hour', label: 'Overtime', quantity: 8 }, reference)
    expect(valued.basis).toBe(BASIS.PEER_MEDIAN)
    expect(valued.unit_rate).toBe(60)
    expect(valued.estimated_amount).toBe(480)
    expect(valued.quantity_known).toBe(true)
  })

  // Honesty over a flattering number: with no rate anywhere in the system there is nothing
  // to estimate from, so the entry is counted and valued at zero rather than guessed at.
  test('counts but does not value an entry with no reference rate anywhere', () => {
    const valued = valueEntry({ surcharge_type: 'suction', label: 'Suction', quantity: 1 }, reference)
    expect(valued.basis).toBe(BASIS.NONE)
    expect(valued.unit_rate).toBeNull()
    expect(valued.estimated_amount).toBe(0)
  })

  // Invoices written before pricingService recorded a numeric quantity fall back to 1,
  // which UNDER-states leakage rather than inventing a figure by parsing "8 h recorded".
  test('falls back to a quantity of 1 when none was recorded, and says so', () => {
    const valued = valueEntry({ surcharge_type: 'overtime_per_hour', label: 'Overtime', detail: '8 h recorded' }, reference)
    expect(valued.quantity).toBe(1)
    expect(valued.quantity_known).toBe(false)
    expect(valued.estimated_amount).toBe(60)
  })
})

describe('buildLeakageReport', () => {
  test('reports nothing to fix when no invoice recorded an unpriced surcharge', () => {
    const report = buildLeakageReport([invoice(), invoice({ id: 2 })], SURCHARGE_ROWS)
    expect(report.summary.estimated_leakage).toBe(0)
    expect(report.summary.affected_invoice_count).toBe(0)
    expect(report.summary.unpriced_item_count).toBe(0)
    expect(report.summary.top_recommendation).toContain('No unpriced surcharges')
  })

  test('totals estimated leakage across invoices and surcharge types', () => {
    const report = buildLeakageReport([
      invoice({
        id: 1,
        unpriced_surcharges: [
          { surcharge_type: 'overtime_per_hour', label: 'Overtime', quantity: 8 },      // 8 x 60 = 480
          { surcharge_type: 'oxygen_per_litre', label: 'Oxygen', quantity: 10 },        // 10 x 3 = 30
        ],
      }),
      invoice({
        id: 2,
        unpriced_surcharges: [
          { surcharge_type: 'overtime_per_hour', label: 'Overtime', quantity: 2 },      // 2 x 60 = 120
        ],
      }),
    ], SURCHARGE_ROWS)

    expect(report.summary.estimated_leakage).toBe(630)
    expect(report.summary.affected_invoice_count).toBe(2)
    expect(report.summary.unpriced_item_count).toBe(3)
  })

  test('ranks surcharge types by cost, largest first', () => {
    const report = buildLeakageReport([
      invoice({
        unpriced_surcharges: [
          { surcharge_type: 'oxygen_per_litre', label: 'Oxygen', quantity: 10 },   // 30
          { surcharge_type: 'overtime_per_hour', label: 'Overtime', quantity: 8 }, // 480
        ],
      }),
    ], SURCHARGE_ROWS)

    expect(report.by_surcharge_type[0].surcharge_type).toBe('overtime_per_hour')
    expect(report.by_surcharge_type[0].estimated_amount).toBe(480)
    expect(report.by_surcharge_type[1].estimated_amount).toBe(30)
  })

  test('aggregates per contract and names the missing rates, since the contract is the root cause', () => {
    const report = buildLeakageReport([
      invoice({ id: 1, unpriced_surcharges: [{ surcharge_type: 'overtime_per_hour', label: 'Overtime', quantity: 8 }] }),
      invoice({ id: 2, unpriced_surcharges: [{ surcharge_type: 'overtime_per_hour', label: 'Overtime', quantity: 2 }] }),
      invoice({ id: 3, unpriced_surcharges: [{ surcharge_type: 'oxygen_per_litre', label: 'Oxygen', quantity: 10 }] }),
    ], SURCHARGE_ROWS)

    expect(report.by_contract).toHaveLength(1)
    const [contract] = report.by_contract
    expect(contract.contract_id).toBe(100)
    expect(contract.affected_invoices).toBe(3)
    expect(contract.missing_surcharge_types.sort()).toEqual(['overtime_per_hour', 'oxygen_per_litre'])
    expect(contract.estimated_amount).toBe(630)
  })

  test('separates invoices that had no contract at all from contracted ones', () => {
    const report = buildLeakageReport([
      invoice({ id: 1, unpriced_surcharges: [{ surcharge_type: 'overtime_per_hour', label: 'Overtime', quantity: 1 }] }),
      invoice({ id: 2, contract_id: null, contract_name: null, client_id: 20, client_name: 'Acme', unpriced_surcharges: [{ surcharge_type: 'overtime_per_hour', label: 'Overtime', quantity: 1 }] }),
    ], SURCHARGE_ROWS)

    expect(report.by_contract).toHaveLength(2)
    const uncontracted = report.by_contract.find((c) => c.contract_id === null)
    expect(uncontracted.contract_name).toBe('No active contract')
    expect(uncontracted.client_name).toBe('Acme')
  })

  test('names the biggest available fix in the recommendation', () => {
    const report = buildLeakageReport([
      invoice({ id: 1, unpriced_surcharges: [{ surcharge_type: 'overtime_per_hour', label: 'Overtime', quantity: 8 }] }),
    ], SURCHARGE_ROWS)

    expect(report.summary.top_recommendation).toContain('Jurong Shipyard 2026')
    expect(report.summary.top_recommendation).toContain('480.00')
    expect(report.summary.top_recommendation).toContain('1 invoice(s)')
  })

  // The report must state its own blind spots. Rounding unknowns to zero and presenting the
  // result as complete would be worse than not reporting at all.
  test('counts items it cannot value and items with no recorded quantity', () => {
    const report = buildLeakageReport([
      invoice({
        unpriced_surcharges: [
          { surcharge_type: 'suction', label: 'Suction', quantity: 1 },              // no reference rate
          { surcharge_type: 'overtime_per_hour', label: 'Overtime' },                // no quantity recorded
        ],
      }),
    ], SURCHARGE_ROWS)

    expect(report.summary.items_without_reference_rate).toBe(1)
    expect(report.summary.items_without_recorded_quantity).toBe(1)
    expect(report.summary.unpriced_item_count).toBe(2)
    expect(report.summary.estimated_leakage).toBe(60) // only the overtime could be valued
  })

  test('ranks affected invoices by shortfall and keeps them individually traceable', () => {
    const report = buildLeakageReport([
      invoice({ id: 1, unpriced_surcharges: [{ surcharge_type: 'overtime_per_hour', label: 'Overtime', quantity: 1 }] }),
      invoice({ id: 2, unpriced_surcharges: [{ surcharge_type: 'overtime_per_hour', label: 'Overtime', quantity: 9 }] }),
    ], SURCHARGE_ROWS)

    expect(report.affected_invoices.map((i) => i.invoice_id)).toEqual([2, 1])
    expect(report.affected_invoices[0].estimated_amount).toBe(540)
    expect(report.affected_invoices[0].client_name).toBe('Jurong Shipyard')
  })

  test('tolerates malformed unpriced entries rather than throwing mid-report', () => {
    const report = buildLeakageReport([
      invoice({ unpriced_surcharges: [null, {}, { surcharge_type: 'overtime_per_hour', label: 'Overtime', quantity: 1 }] }),
      invoice({ id: 2, unpriced_surcharges: 'not-an-array' }),
    ], SURCHARGE_ROWS)

    expect(report.summary.estimated_leakage).toBe(60)
    expect(report.summary.unpriced_item_count).toBe(1)
  })

  test('exposes the reference rates it used, so an estimate can be audited', () => {
    const report = buildLeakageReport([
      invoice({ unpriced_surcharges: [{ surcharge_type: 'overtime_per_hour', label: 'Overtime', quantity: 1 }] }),
    ], SURCHARGE_ROWS)
    expect(report.reference_rates.overtime_per_hour).toEqual({ median: 60, sampleSize: 3, min: 60, max: 90 })
  })
})
