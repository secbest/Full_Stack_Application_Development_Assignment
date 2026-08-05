// Owner: Jasper. Three notification write sites were already wrong before the read API
// existed to expose it:
//   1. serviceMemoController and memoReviewController both linked to /memos/:id, which
//      is not a route in App.jsx - every click would 404.
//   2. memoReviewController's "memo returned for correction" notification used type
//      'memo_submitted' instead of the new 'memo_returned'.
//   3. invoiceController's Xero sync-failure notification passed
//      `user_id: invoice.approved_by || null`, but Notification.user_id is NOT NULL -
//      when approved_by was null the insert threw and notificationService swallowed it,
//      so the alert vanished with no trace. Fixed by falling back to the AR Specialist.
jest.mock('../../src/models', () => ({
  ServiceMemo: { findByPk: jest.fn(), findOne: jest.fn() },
  MemoSignature: { create: jest.fn() },
  Booking: { findByPk: jest.fn(), update: jest.fn() },
  Client: { findByPk: jest.fn() },
  Invoice: { findOne: jest.fn(), findByPk: jest.fn() },
  InvoiceLineItem: { findAll: jest.fn() },
  User: { findOne: jest.fn() },
  PricingContract: {},
  XeroSyncLog: { create: jest.fn() },
}))
jest.mock('../../src/config', () => ({ transaction: jest.fn((cb) => cb({})) }))
jest.mock('../../src/services/cloudinaryService', () => ({ uploadBuffer: jest.fn() }))
jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))
jest.mock('../../src/services', () => ({ pricingService: {}, xeroService: { pushArInvoice: jest.fn() } }))
jest.mock('../../src/controllers/xeroController', () => ({ getFreshConnection: jest.fn() }))

const { ServiceMemo, Booking, Invoice, InvoiceLineItem, Client, User, XeroSyncLog } = require('../../src/models')
const { xeroService } = require('../../src/services')
const xeroController = require('../../src/controllers/xeroController')
const notificationService = require('../../src/services/notificationService')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

beforeEach(() => jest.clearAllMocks())

describe('serviceMemoController - memo_submitted link fix', () => {
  const { createServiceMemo } = require('../../src/controllers/serviceMemoController')

  test('links to /service-memos (the real AR review route), not /memos/:id', async () => {
    Booking.findByPk.mockResolvedValue({ id: 10, reference_number: 'BKG-2026-00010', status: 'in_progress', update: jest.fn().mockResolvedValue() })
    ServiceMemo.findOne.mockResolvedValue(null) // no memo already exists for this booking
    ServiceMemo.create = jest.fn().mockResolvedValue({ id: 7, patient_name: 'Test Patient' })
    require('../../src/models').MemoSignature.create.mockResolvedValue({ id: 1 })
    User.findOne.mockResolvedValue({ id: 3 })

    const res = mockRes()
    await createServiceMemo({
      body: { booking_id: 10, signature: {} },
      user: { sub: 99 },
    }, res)

    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({ link: '/service-memos' }))
  })
})

describe('memoReviewController - returnMemo link + type fix', () => {
  const { returnMemo } = require('../../src/controllers/memoReviewController')

  test('uses type memo_returned and links to /memos/history, not /memos/:id', async () => {
    const memo = { id: 5, submitted_by: 99, update: jest.fn().mockResolvedValue() }
    ServiceMemo.findByPk.mockResolvedValue(memo)
    Invoice.findOne.mockResolvedValue(null)

    const res = mockRes()
    await returnMemo({ params: { id: 5 }, body: { note: 'Missing signature' }, user: { sub: 2 } }, res)

    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'memo_returned',
      link: '/memos/history',
    }))
  })
})

describe('invoiceController - Xero sync-failure fallback', () => {
  const { retryXero } = require('../../src/controllers/invoiceController')

  function makeInvoice(overrides = {}) {
    const obj = { id: 1, status: 'failed', tax_amount: 0, subtotal: 850, total_amount: 850, ...overrides }
    obj.update = jest.fn(async (fields) => { Object.assign(obj, fields); return obj })
    return obj
  }

  test('falls back to the AR Specialist when approved_by is null', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ approved_by: null }))
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: false, error: 'Xero rejected the invoice' })
    XeroSyncLog.create.mockResolvedValue({})
    User.findOne.mockResolvedValue({ id: 11, role: 'ar_specialist' })

    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)

    expect(User.findOne).toHaveBeenCalledWith({ where: { role: 'ar_specialist' } })
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 11 }))
  })

  test('keeps returning 502 XERO_SYNC_ERROR even if the AR Specialist lookup itself throws', async () => {
    // Regression guard: this must never let a lookup failure turn a routine Xero
    // rejection into an unrelated 500 for the AR Specialist retrying the sync.
    Invoice.findByPk.mockResolvedValue(makeInvoice({ approved_by: null }))
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: false, error: 'Xero rejected the invoice' })
    XeroSyncLog.create.mockResolvedValue({})
    User.findOne.mockRejectedValue(new Error('connection reset'))

    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(502)
    expect(notificationService.create).not.toHaveBeenCalled()
  })

  test('still uses approved_by directly when present, without querying User at all', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ approved_by: 7 }))
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: false, error: 'Xero rejected the invoice' })
    XeroSyncLog.create.mockResolvedValue({})

    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)

    expect(User.findOne).not.toHaveBeenCalled()
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 7 }))
  })
})
