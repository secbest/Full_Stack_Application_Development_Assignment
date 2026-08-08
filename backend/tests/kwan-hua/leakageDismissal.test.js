// Owner: Kwan Hua - closing the loop on the revenue-leakage report.
//
// The report could only ever accumulate. Prevention (surcharges price from the published
// rate card) and detection (the report itself) were in place, but a gap that had actually
// been dealt with - billed separately, or written off because the invoice was already
// issued through Xero and cannot be silently re-priced - had no way to leave the total. So
// the figure drifted from reality and the report became easy to ignore, which is the worst
// outcome for a report whose only job is to be acted on.
//
// These tests pin the three properties that make a write-off trustworthy: it must be
// attributable, it must not destroy the evidence behind it, and it must be reversible.
jest.mock('../../src/models', () => ({
  Booking: {},
  ServiceMemo: {},
  Invoice: { findAll: jest.fn(), findByPk: jest.fn() },
  VendorInvoice: {},
  PricingContract: {},
  SurchargeSchedule: { findAll: jest.fn() },
  Client: {},
  JobMilestone: {},
  XeroSyncLog: {},
  User: {},
  GeocodedLocation: {},
}))

const { Invoice, SurchargeSchedule } = require('../../src/models')
const { revenueLeakage, dismissLeakage, restoreLeakage } = require('../../src/controllers/dashboardController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
const payload = (res) => res.json.mock.calls[0][0]

// The surcharge types on the real leaked invoice, priced from the published rate card:
// disposables 20 + resuscitation 320 + suction 50 = 390.
const SURCHARGE_ROWS = [
  { surcharge_type: 'disposables_base', amount: '20.00' },
  { surcharge_type: 'resuscitation', amount: '320.00' },
  { surcharge_type: 'suction', amount: '50.00' },
]

const UNPRICED = [
  { surcharge_type: 'disposables_base', label: 'Disposables', quantity: 1 },
  { surcharge_type: 'resuscitation', label: 'Resuscitation', quantity: 1 },
  { surcharge_type: 'suction', label: 'Suction', quantity: 1 },
]

function invoiceRow(overrides = {}) {
  return {
    id: 20,
    client_id: 18,
    contract_id: null,
    createdAt: new Date('2026-08-07T16:41:56Z'),
    unpriced_surcharges: UNPRICED,
    leakage_dismissed_at: null,
    leakage_dismissed_reason: null,
    Client: { id: 18, name: 'NUS Nursing' },
    PricingContract: null,
    dismissedBy: null,
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  SurchargeSchedule.findAll.mockResolvedValue(SURCHARGE_ROWS)
})

describe('revenueLeakage - dismissed rows leave the open total', () => {
  test('an open row counts toward estimated leakage', async () => {
    Invoice.findAll.mockResolvedValue([invoiceRow()])
    const res = mockRes()
    await revenueLeakage({ query: {} }, res)

    const data = payload(res).data
    expect(data.summary.estimated_leakage).toBe(390)
    expect(data.summary.affected_invoice_count).toBe(1)
    expect(data.dismissed.count).toBe(0)
  })

  test('dismissing removes it from the open figure without deleting it', async () => {
    Invoice.findAll.mockResolvedValue([invoiceRow({
      leakage_dismissed_at: new Date('2026-08-08T10:00:00Z'),
      leakage_dismissed_reason: 'Billed separately on INV-204 after the Xero draft was issued.',
      dismissedBy: { id: 2, name: 'Sarah Lim' },
    })])
    const res = mockRes()
    await revenueLeakage({ query: {} }, res)

    const data = payload(res).data
    // The open number is what the MD is asked to act on - a closed decision must not inflate it.
    expect(data.summary.estimated_leakage).toBe(0)
    expect(data.summary.affected_invoice_count).toBe(0)

    // ...but the money is still reported, separately, with who decided and why.
    expect(data.dismissed.count).toBe(1)
    expect(data.dismissed.estimated_amount).toBe(390)
    expect(data.dismissed.rows[0]).toMatchObject({
      invoice_id: 20,
      client_name: 'NUS Nursing',
      estimated_amount: 390,
      dismissed_reason: 'Billed separately on INV-204 after the Xero draft was issued.',
      dismissed_by: { id: 2, name: 'Sarah Lim' },
    })
  })

  test('a write-off is never folded into the open total', async () => {
    Invoice.findAll.mockResolvedValue([
      invoiceRow({ id: 20 }),
      invoiceRow({ id: 21, leakage_dismissed_at: new Date(), leakage_dismissed_reason: 'Written off - customer goodwill.' }),
    ])
    const res = mockRes()
    await revenueLeakage({ query: {} }, res)

    const data = payload(res).data
    expect(data.summary.estimated_leakage).toBe(390)   // only the open one
    expect(data.dismissed.estimated_amount).toBe(390)  // reported, not hidden
  })
})

describe('dismissLeakage', () => {
  test('records the timestamp, the reason and the actor', async () => {
    const update = jest.fn().mockImplementation(function (fields) { Object.assign(this, fields) })
    Invoice.findByPk.mockResolvedValue({ id: 20, unpriced_surcharges: UNPRICED, leakage_dismissed_at: null, update })

    const res = mockRes()
    await dismissLeakage({ params: { invoiceId: 20 }, body: { reason: '  Written off - already issued in Xero.  ' }, user: { sub: 1 } }, res)

    expect(update).toHaveBeenCalledTimes(1)
    const written = update.mock.calls[0][0]
    expect(written.leakage_dismissed_by).toBe(1)
    expect(written.leakage_dismissed_reason).toBe('Written off - already issued in Xero.') // trimmed
    expect(written.leakage_dismissed_at).toBeInstanceOf(Date)
    // The evidence behind the decision must survive it.
    expect(written).not.toHaveProperty('unpriced_surcharges')
  })

  test('refuses an invoice that has no leakage to dismiss', async () => {
    Invoice.findByPk.mockResolvedValue({ id: 5, unpriced_surcharges: [], leakage_dismissed_at: null, update: jest.fn() })

    const res = mockRes()
    await dismissLeakage({ params: { invoiceId: 5 }, body: { reason: 'Nothing here to write off.' }, user: { sub: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('NO_LEAKAGE_TO_DISMISS')
  })

  test('refuses to dismiss the same row twice, so the audit trail cannot be overwritten', async () => {
    Invoice.findByPk.mockResolvedValue({
      id: 20, unpriced_surcharges: UNPRICED, leakage_dismissed_at: new Date(), update: jest.fn(),
    })

    const res = mockRes()
    await dismissLeakage({ params: { invoiceId: 20 }, body: { reason: 'Trying to overwrite the first reason.' }, user: { sub: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('LEAKAGE_ALREADY_DISMISSED')
  })

  test('404s on an unknown invoice', async () => {
    Invoice.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await dismissLeakage({ params: { invoiceId: 999 }, body: { reason: 'No such invoice exists.' }, user: { sub: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe('restoreLeakage', () => {
  test('clears all three fields so the row reopens exactly as it was', async () => {
    const update = jest.fn()
    Invoice.findByPk.mockResolvedValue({ id: 20, leakage_dismissed_at: new Date(), update })

    const res = mockRes()
    await restoreLeakage({ params: { invoiceId: 20 }, user: { sub: 1 } }, res)

    expect(update).toHaveBeenCalledWith({
      leakage_dismissed_at: null,
      leakage_dismissed_reason: null,
      leakage_dismissed_by: null,
    })
  })

  test('refuses to restore a row that was never dismissed', async () => {
    Invoice.findByPk.mockResolvedValue({ id: 20, leakage_dismissed_at: null, update: jest.fn() })
    const res = mockRes()
    await restoreLeakage({ params: { invoiceId: 20 }, user: { sub: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('LEAKAGE_NOT_DISMISSED')
  })
})
