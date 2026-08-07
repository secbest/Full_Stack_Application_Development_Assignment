// Owner: Kwan Hua.
// Covers the surcharge resolution order introduced to stop one-off-quote bookings
// reporting every recorded charge as unpriced (published card -> contract override).

jest.mock('../../src/models', () => ({
  SurchargeSchedule: { findAll: jest.fn() },
}))

const { SurchargeSchedule } = require('../../src/models')
const { resolveSurchargeRows, PUBLISHED_SURCHARGE_RATES } = require('../../src/services/surchargeScheduleService')

// findAll is called with { where: { contract_id: null } } for globals and
// { where: { contract_id: <id> } } for overrides; this routes each call to its fixture.
function mockRows({ globals = [], contract = [] }) {
  SurchargeSchedule.findAll.mockImplementation(({ where }) =>
    Promise.resolve(where.contract_id === null ? globals : contract)
  )
}

const asMap = (rows) => Object.fromEntries(rows.map((r) => [r.surcharge_type, r.amount]))

beforeEach(() => {
  jest.clearAllMocks()
})

describe('resolveSurchargeRows', () => {
  test('returns the published defaults when the booking has no contract (one-off quote)', async () => {
    mockRows({ globals: [
      { surcharge_type: 'oxygen_base', amount: '50.00' },
      { surcharge_type: 'resuscitation', amount: '320.00' },
    ] })

    const rows = await resolveSurchargeRows(null)

    // The regression this guards: this used to return [] for a contract-less booking, so
    // every surcharge the crew recorded came back unpriced and every invoice warned.
    expect(asMap(rows)).toEqual({ oxygen_base: 50, resuscitation: 320 })
    expect(SurchargeSchedule.findAll).toHaveBeenCalledTimes(1)
  })

  test('lets a contract row override the published rate for that surcharge only', async () => {
    mockRows({
      globals: [
        { surcharge_type: 'oxygen_base', amount: '50.00' },
        { surcharge_type: 'suction', amount: '50.00' },
        { surcharge_type: 'resuscitation', amount: '320.00' },
      ],
      contract: [{ surcharge_type: 'resuscitation', amount: '400.00' }],
    })

    const rows = await resolveSurchargeRows(7)

    // Negotiated resuscitation rate wins; the other two still inherit the published card
    // instead of being dropped the way the old contract-only query dropped them.
    expect(asMap(rows)).toEqual({ oxygen_base: 50, suction: 50, resuscitation: 400 })
  })

  test('coerces DECIMAL strings to numbers so the pricing engine can do arithmetic', async () => {
    mockRows({ globals: [{ surcharge_type: 'waiting_time_per_30min', amount: '30.00' }] })

    const [row] = await resolveSurchargeRows(null)

    expect(row.amount).toBe(30)
    expect(typeof row.amount).toBe('number')
  })

  test('returns only contract rows when no globals are seeded', async () => {
    mockRows({ globals: [], contract: [{ surcharge_type: 'oxygen_base', amount: '75.00' }] })

    expect(asMap(await resolveSurchargeRows(3))).toEqual({ oxygen_base: 75 })
  })

  test('published card omits overtime and cancellation, which have no flat published rate', async () => {
    const types = PUBLISHED_SURCHARGE_RATES.map((r) => r.surcharge_type)

    // Defaulting these would invent a figure the pricing table does not state -
    // cancellation is "100% upon activation", a rule rather than an amount.
    expect(types).not.toContain('overtime_per_hour')
    expect(types).not.toContain('cancellation')
    expect(types).toContain('oxygen_base')
    expect(types).toContain('jurong_island_max')
  })
})
