jest.mock('../../src/models', () => ({
  ServiceMemo: { findByPk: jest.fn(), findAndCountAll: jest.fn() },
  MemoSignature: {},
  Booking: {},
  Client: {},
  // findOne is used to notify the AR Specialist when the crew resubmits a corrected memo.
  User: { findOne: jest.fn() },
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
  pricingService: {
    computeInvoiceLineItems: jest.fn(),
    quotationMatchesMemo: jest.fn(),
    computeQuotedInvoiceLineItems: jest.fn(),
  },
  gstService: { buildSnapshot: jest.fn(), calculateTotals: jest.fn() },
}))

jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))

const { ServiceMemo, PricingContract, PricingRate, SurchargeSchedule, Invoice, InvoiceLineItem } = require('../../src/models')
const { pricingService, gstService } = require('../../src/services')
const notificationService = require('../../src/services/notificationService')
const { approveMemo, returnMemo, resubmitMemo, listPendingReview } = require('../../src/controllers/memoReviewController')

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

beforeEach(() => {
  jest.clearAllMocks()
  gstService.buildSnapshot.mockResolvedValue({
    gst_rate_id: 3,
    gst_rate_percent: 9,
    gst_effective_date: '2026-06-10',
    xero_tax_type: 'OUTPUT',
  })
  gstService.calculateTotals.mockImplementation((items, rate) => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0)
    const tax_amount = Math.round(subtotal * Number(rate)) / 100
    return { subtotal, tax_amount, total_amount: subtotal + tax_amount }
  })
})

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

  test('stops invoice creation when no verified GST period covers the service date', async () => {
    ServiceMemo.findByPk.mockResolvedValue(makeMemo())
    Invoice.findOne.mockResolvedValue(null)
    gstService.buildSnapshot.mockRejectedValue(Object.assign(
      new Error('No verified Singapore GST rate is configured for 2026-06-10.'),
      { code: 'GST_RATE_NOT_CONFIGURED' }
    ))

    const res = mockRes()
    await approveMemo({ params: { id: 1 }, user: { sub: 2 } }, res)

    expect(res.status).toHaveBeenCalledWith(422)
    expect(payload(res).code).toBe('GST_RATE_NOT_CONFIGURED')
    expect(Invoice.create).not.toHaveBeenCalled()
  })

  test('returns the unmatched invoice as a warning-bearing success when the client has no active contract', async () => {
    const memo = makeMemo()
    ServiceMemo.findByPk.mockResolvedValue(memo)
    Invoice.findOne.mockResolvedValue(null)
    PricingContract.findOne.mockResolvedValue(null)
    // With no contract the engine is still consulted, with empty rates/surcharges, purely to
    // enumerate what the memo recorded that now needs pricing by hand.
    pricingService.computeInvoiceLineItems.mockReturnValue({
      matched: false, lineItems: [], subtotal: 0,
      unpriced: [{ surcharge_type: 'resuscitation', label: 'Resuscitation', detail: 'performed' }],
    })
    Invoice.create.mockResolvedValue({ id: 42, status: 'unmatched', subtotal: 0, tax_amount: 0, total_amount: 0, unpriced_surcharges: [] })

    const res = mockRes()
    await approveMemo({ params: { id: 1 }, user: { sub: 2 } }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(payload(res).data.warning.code).toBe('NO_ACTIVE_CONTRACT')
    expect(payload(res).data.invoice).toMatchObject({ id: 42, status: 'unmatched' })
    expect(Invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contract_id: null,
        status: 'unmatched',
        unpriced_surcharges: [{ surcharge_type: 'resuscitation', label: 'Resuscitation', detail: 'performed' }],
      }),
      expect.anything()
    )
    expect(memo.status).toBe('reviewed')
  })

  test('409s instead of approving a memo that is out with the crew for correction', async () => {
    ServiceMemo.findByPk.mockResolvedValue(makeMemo({ status: 'returned' }))
    const res = mockRes()
    await approveMemo({ params: { id: 1 }, user: { sub: 2 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('MEMO_RETURNED')
  })

  test('returns the unmatched invoice as a warning-bearing success when no rate row matches the memo', async () => {
    const memo = makeMemo()
    ServiceMemo.findByPk.mockResolvedValue(memo)
    Invoice.findOne.mockResolvedValue(null)
    PricingContract.findOne.mockResolvedValue({ id: 7 })
    PricingRate.findAll.mockResolvedValue([])
    SurchargeSchedule.findAll.mockResolvedValue([])
    pricingService.computeInvoiceLineItems.mockReturnValue({ matched: false, lineItems: [], subtotal: 0, unpriced: [] })
    Invoice.create.mockResolvedValue({ id: 43, status: 'unmatched', subtotal: 0, tax_amount: 0, total_amount: 0, unpriced_surcharges: [] })

    const res = mockRes()
    await approveMemo({ params: { id: 1 }, user: { sub: 2 } }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(payload(res).data.warning.code).toBe('NO_MATCHING_RATE')
    expect(payload(res).data.invoice).toMatchObject({ id: 43, status: 'unmatched' })
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
      unpriced: [],
    })
    Invoice.create.mockResolvedValue({
      id: 44, status: 'matched', subtotal: 850, gst_rate_percent: 9,
      gst_effective_date: '2026-06-10', tax_amount: 76.5, total_amount: 926.5,
    })
    InvoiceLineItem.bulkCreate.mockResolvedValue([])
    InvoiceLineItem.findAll.mockResolvedValue([
      { id: 1, description: 'EAS - One-Way Hospital Transfer', quantity: 1, unit_price: 850, amount: 850, is_manual_adjustment: false },
    ])

    const res = mockRes()
    await approveMemo({ params: { id: 1 }, user: { sub: 2 } }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(payload(res).data.memo_status).toBe('reviewed')
    expect(payload(res).data.invoice.status).toBe('matched')
    expect(payload(res).data.invoice).toMatchObject({ gst_rate_percent: 9, tax_amount: 76.5, total_amount: 926.5 })
    expect(Invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ gst_rate_id: 3, gst_rate_percent: 9, tax_amount: 76.5, total_amount: 926.5 }),
      expect.anything()
    )
    expect(payload(res).data.invoice.line_items).toHaveLength(1)
    expect(memo.status).toBe('reviewed')
  })

  test('automatically invoices the frozen one-off price approved by Quotations', async () => {
    const memo = makeMemo({
      Booking: {
        client_id: 6,
        scheduled_date: '2026-06-10',
        service_type: 'eas',
        pricing_source: 'one_off_quote',
        pricing_contract_id: null,
        quoted_base_amount: 725.5,
        quoted_transfer_type: 'one_way_hospital',
        quoted_time_of_day: 'office_hours',
      },
    })
    const line = {
      description: 'One-Off Quote - EAS - One-Way Hospital Transfer (Office Hours)',
      quantity: 1, unit_price: 725.5, amount: 725.5, is_manual_adjustment: false,
    }
    ServiceMemo.findByPk.mockResolvedValue(memo)
    Invoice.findOne.mockResolvedValue(null)
    pricingService.quotationMatchesMemo.mockReturnValue(true)
    pricingService.computeQuotedInvoiceLineItems.mockReturnValue({
      matched: true, lineItems: [line], subtotal: 725.5, unpriced: [],
    })
    Invoice.create.mockResolvedValue({
      id: 45, status: 'matched', subtotal: 725.5, tax_amount: 65.3, total_amount: 790.8,
    })
    InvoiceLineItem.findAll.mockResolvedValue([{ id: 5, ...line }])

    const res = mockRes()
    await approveMemo({ params: { id: 1 }, user: { sub: 2 } }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(PricingContract.findOne).not.toHaveBeenCalled()
    expect(Invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      contract_id: null, status: 'matched', subtotal: 725.5, tax_amount: 65.3, total_amount: 790.8,
    }), expect.anything())
    expect(InvoiceLineItem.bulkCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ invoice_id: 45, unit_price: 725.5 })],
      expect.anything()
    )
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
    Invoice.findOne.mockResolvedValue({ id: 5, status: 'approved' })
    const res = mockRes()
    await returnMemo({ params: { id: 1 }, body: { note: 'Missing signature' }, user: { sub: 2 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('MEMO_ALREADY_INVOICED')
  })

  // Regression: a 'matched' invoice used to permit the return, which stranded both records -
  // the memo went back to the crew while its invoice lived on, and re-approving then failed
  // because an invoice already existed, leaving no available action on either.
  test('409s when the memo already generated an invoice, even an unapproved one', async () => {
    const memo = makeMemo()
    ServiceMemo.findByPk.mockResolvedValue(memo)
    Invoice.findOne.mockResolvedValue({ id: 9, status: 'matched' })
    const res = mockRes()
    await returnMemo({ params: { id: 1 }, body: { note: 'Wrong oxygen figure' }, user: { sub: 2 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('MEMO_ALREADY_INVOICED')
    expect(payload(res).message).toContain('#9')
    expect(memo.update).not.toHaveBeenCalled()
  })

  test('409s when the memo is already out with the crew', async () => {
    ServiceMemo.findByPk.mockResolvedValue(makeMemo({ status: 'returned' }))
    Invoice.findOne.mockResolvedValue(null)
    const res = mockRes()
    await returnMemo({ params: { id: 1 }, body: { note: 'Again?' }, user: { sub: 2 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('MEMO_ALREADY_RETURNED')
  })

  // Regression: returning used to set status back to 'submitted', so the memo stayed in the
  // AR review queue looking identical to a fresh submission and got re-reviewed in a loop.
  test("moves the memo to 'returned' so it leaves the AR review queue, and notifies the crew", async () => {
    const memo = makeMemo({ submitted_by: 99 })
    ServiceMemo.findByPk.mockResolvedValue(memo)
    Invoice.findOne.mockResolvedValue(null)
    const res = mockRes()
    await returnMemo({ params: { id: 1 }, body: { note: 'Missing signature' }, user: { sub: 2 } }, res)

    expect(memo.status).toBe('returned')
    expect(memo.status).not.toBe('submitted')
    expect(memo.ar_note).toBe('Missing signature')
    expect(memo.returned_at).toBeInstanceOf(Date)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(payload(res).data.memo_status).toBe('returned')
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 99 }))
  })
})

describe('listPendingReview (UC-03)', () => {
  test('queries only submitted memos, so returned ones stay out of the queue', async () => {
    ServiceMemo.findAndCountAll.mockResolvedValue({ rows: [], count: 0 })
    const res = mockRes()
    await listPendingReview({ query: {} }, res)
    expect(ServiceMemo.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'submitted' } })
    )
  })

  test('caps an absurd ?limit rather than fetching the whole table', async () => {
    ServiceMemo.findAndCountAll.mockResolvedValue({ rows: [], count: 0 })
    await listPendingReview({ query: { limit: '100000' } }, mockRes())
    expect(ServiceMemo.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }))
  })

  test('ages a corrected memo from its resubmission, not its original creation', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    ServiceMemo.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{
        id: 1, booking_id: 10, service_type: 'eas', transfer_type: 'one_way_hospital',
        // Created a fortnight ago but corrected and resubmitted two hours ago.
        createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
        returned_at: new Date(Date.now() - 3 * 60 * 60 * 1000),
        resubmitted_at: twoHoursAgo,
        Booking: { reference_number: 'BKG-1', scheduled_date: '2026-06-10', Client: { id: 6, name: 'TTSH' } },
      }],
    })
    const res = mockRes()
    await listPendingReview({ query: {} }, res)

    const row = payload(res).data.data[0]
    expect(row.was_returned).toBe(true)
    expect(row.hours_since_submission).toBeCloseTo(2, 1)
  })
})

describe('resubmitMemo (the crew half of the return loop)', () => {
  test('409s unless the memo is actually in returned status', async () => {
    ServiceMemo.findByPk.mockResolvedValue(makeMemo({ status: 'submitted' }))
    const res = mockRes()
    await resubmitMemo({ params: { id: 1 }, body: {}, user: { sub: 99, role: 'field_crew' } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('MEMO_NOT_RETURNED')
  })

  test("404s when a crew member tries to resubmit someone else's memo", async () => {
    ServiceMemo.findByPk.mockResolvedValue(makeMemo({ status: 'returned', submitted_by: 77 }))
    const res = mockRes()
    await resubmitMemo({ params: { id: 1 }, body: {}, user: { sub: 99, role: 'field_crew' } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('applies the corrected fields, clears the note and puts the memo back in the queue', async () => {
    const memo = makeMemo({ status: 'returned', ar_note: 'Oxygen litres look wrong', submitted_by: 99 })
    ServiceMemo.findByPk.mockResolvedValue(memo)
    const res = mockRes()
    await resubmitMemo(
      { params: { id: 1 }, body: { oxygen_litres_used: 14, overtime_hours: 2 }, user: { sub: 99, role: 'field_crew' } },
      res
    )

    expect(memo.status).toBe('submitted')
    expect(memo.oxygen_litres_used).toBe(14)
    expect(memo.overtime_hours).toBe(2)
    expect(memo.ar_note).toBeNull()
    expect(memo.resubmitted_at).toBeInstanceOf(Date)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(payload(res).data.fields_updated).toEqual(['overtime_hours', 'oxygen_litres_used'])
  })

  test('ignores fields that are not the crew\'s to change', async () => {
    const memo = makeMemo({ status: 'returned', submitted_by: 99 })
    ServiceMemo.findByPk.mockResolvedValue(memo)
    await resubmitMemo(
      { params: { id: 1 }, body: { booking_id: 999, submitted_by: 1, status: 'invoiced' }, user: { sub: 99, role: 'field_crew' } },
      mockRes()
    )
    expect(memo.booking_id).toBe(10)
    expect(memo.submitted_by).toBe(99)
    expect(memo.status).toBe('submitted')
  })
})
