jest.mock('../../src/models', () => ({
  ServiceMemo: { findByPk: jest.fn(), findAndCountAll: jest.fn() },
  MemoSignature: {},
  Booking: {},
  Client: {},
  User: {},
  PricingContract: { findOne: jest.fn() },
  PricingRate: { findAll: jest.fn() },
  SurchargeSchedule: { findAll: jest.fn() },
  Invoice: { findOne: jest.fn(), create: jest.fn() },
  InvoiceLineItem: { bulkCreate: jest.fn(), findAll: jest.fn() },
}))

jest.mock('../../src/config', () => ({
  transaction: jest.fn((cb) => cb({})),
}))

jest.mock('../../src/services', () => ({
  pricingService: { computeInvoiceLineItems: jest.fn() },
}))

jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))

const { ServiceMemo, PricingContract, PricingRate, SurchargeSchedule, Invoice, InvoiceLineItem } = require('../../src/models')
const { pricingService } = require('../../src/services')
const notificationService = require('../../src/services/notificationService')
const { approveMemo, returnMemo } = require('../../src/controllers/memoReviewController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}
function makeMemo(overrides = {}) {
  const obj = {
    id: 1, status: 'submitted', service_type: 'eas', transfer_type: 'one_way_hospital',
    booking_id: 10, submitted_by: 99,
    Booking: { client_id: 6, scheduled_date: '2026-06-10' },
    ...overrides,
  }
  obj.update = jest.fn(async (fields) => { Object.assign(obj, fields); return obj })
  return obj
}

beforeEach(() => jest.clearAllMocks())

describe('approveMemo (UC-03 -> UC-04)', () => {
  test('404s when the memo does not exist', async () => {
    ServiceMemo.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await approveMemo({ params: { id: 1 }, user: { sub: 2 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('409s when the memo is not in submitted status', async () => {
    ServiceMemo.findByPk.mockResolvedValue(makeMemo({ status: 'reviewed' }))
    const res = mockRes()
    await approveMemo({ params: { id: 1 }, user: { sub: 2 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('MEMO_ALREADY_REVIEWED')
  })

  test('409s when an invoice already exists for this memo', async () => {
    ServiceMemo.findByPk.mockResolvedValue(makeMemo())
    Invoice.findOne.mockResolvedValue({ id: 5 })
    const res = mockRes()
    await approveMemo({ params: { id: 1 }, user: { sub: 2 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('MEMO_ALREADY_REVIEWED')
  })

  test('creates an unmatched invoice + 422 when the client has no active contract', async () => {
    const memo = makeMemo()
    ServiceMemo.findByPk.mockResolvedValue(memo)
    Invoice.findOne.mockResolvedValue(null)
    PricingContract.findOne.mockResolvedValue(null)
    Invoice.create.mockResolvedValue({ id: 42 })

    const res = mockRes()
    await approveMemo({ params: { id: 1 }, user: { sub: 2 } }, res)

    expect(res.status).toHaveBeenCalledWith(422)
    expect(payload(res).code).toBe('NO_ACTIVE_CONTRACT')
    expect(Invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ contract_id: null, status: 'unmatched' }),
      expect.anything()
    )
    expect(memo.status).toBe('reviewed')
  })

  test('creates an unmatched invoice + 422 when no rate row matches the memo', async () => {
    const memo = makeMemo()
    ServiceMemo.findByPk.mockResolvedValue(memo)
    Invoice.findOne.mockResolvedValue(null)
    PricingContract.findOne.mockResolvedValue({ id: 7 })
    PricingRate.findAll.mockResolvedValue([])
    SurchargeSchedule.findAll.mockResolvedValue([])
    pricingService.computeInvoiceLineItems.mockReturnValue({ matched: false, lineItems: [], subtotal: 0 })
    Invoice.create.mockResolvedValue({ id: 43 })

    const res = mockRes()
    await approveMemo({ params: { id: 1 }, user: { sub: 2 } }, res)

    expect(res.status).toHaveBeenCalledWith(422)
    expect(payload(res).code).toBe('NO_MATCHING_RATE')
    expect(Invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ contract_id: 7, status: 'unmatched' }),
      expect.anything()
    )
  })

  test('generates a matched invoice with line items on success', async () => {
    const memo = makeMemo()
    ServiceMemo.findByPk.mockResolvedValue(memo)
    Invoice.findOne.mockResolvedValue(null)
    PricingContract.findOne.mockResolvedValue({ id: 7 })
    PricingRate.findAll.mockResolvedValue([{ id: 1 }])
    SurchargeSchedule.findAll.mockResolvedValue([])
    pricingService.computeInvoiceLineItems.mockReturnValue({
      matched: true,
      lineItems: [{ description: 'EAS - One-Way Hospital Transfer', quantity: 1, unit_price: 850, amount: 850, is_manual_adjustment: false }],
      subtotal: 850,
    })
    Invoice.create.mockResolvedValue({ id: 44, status: 'matched', subtotal: 850, tax_amount: 0, total_amount: 850 })
    InvoiceLineItem.bulkCreate.mockResolvedValue([])
    InvoiceLineItem.findAll.mockResolvedValue([
      { id: 1, description: 'EAS - One-Way Hospital Transfer', quantity: 1, unit_price: 850, amount: 850, is_manual_adjustment: false },
    ])

    const res = mockRes()
    await approveMemo({ params: { id: 1 }, user: { sub: 2 } }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(payload(res).data.memo_status).toBe('reviewed')
    expect(payload(res).data.invoice.status).toBe('matched')
    expect(payload(res).data.invoice.line_items).toHaveLength(1)
    expect(memo.status).toBe('reviewed')
  })
})

describe('returnMemo (UC-03 alt flow)', () => {
  test('rejects a missing/blank correction note', async () => {
    const res = mockRes()
    await returnMemo({ params: { id: 1 }, body: { note: '   ' }, user: { sub: 2 } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('VALIDATION_ERROR')
  })

  test('404s when the memo does not exist', async () => {
    ServiceMemo.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await returnMemo({ params: { id: 1 }, body: { note: 'Missing signature' }, user: { sub: 2 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('409s when the linked invoice is already approved or synced', async () => {
    ServiceMemo.findByPk.mockResolvedValue(makeMemo())
    Invoice.findOne.mockResolvedValue({ status: 'approved' })
    const res = mockRes()
    await returnMemo({ params: { id: 1 }, body: { note: 'Missing signature' }, user: { sub: 2 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('MEMO_ALREADY_INVOICED')
  })

  test('returns the memo to the crew with the correction note and notifies them', async () => {
    const memo = makeMemo({ submitted_by: 99 })
    ServiceMemo.findByPk.mockResolvedValue(memo)
    Invoice.findOne.mockResolvedValue(null)
    const res = mockRes()
    await returnMemo({ params: { id: 1 }, body: { note: 'Missing signature' }, user: { sub: 2 } }, res)

    expect(memo.status).toBe('submitted')
    expect(memo.ar_note).toBe('Missing signature')
    expect(res.status).toHaveBeenCalledWith(200)
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 99 }))
  })
})
