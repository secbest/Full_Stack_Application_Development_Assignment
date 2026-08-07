// Regression coverage for xeroController.retrySync (UC-08 step 4), which previously
// had zero controller-level tests - only the pure xeroService helpers were tested
// (see xero.test.js). That gap is exactly why the ar_invoice branch below shipped
// broken: it always called xeroService.pushBill() (the AP/ACCPAY path) regardless of
// entity_type, using a placeholder { vendor_name: 'AR Invoice', ... } object instead
// of the real Invoice, and never updated the real Invoice row's status either way.
jest.mock('../../src/models', () => ({
  XeroConnection: { findOne: jest.fn() },
  VendorInvoice: { findByPk: jest.fn() },
  VendorInvoiceItem: {},
  Invoice: { findByPk: jest.fn(), findAndCountAll: jest.fn() },
  InvoiceLineItem: {},
  Client: {},
  Booking: {},
  User: { findOne: jest.fn() },
  XeroSyncLog: { findByPk: jest.fn(), findAndCountAll: jest.fn(), count: jest.fn() },
}))

jest.mock('../../src/services', () => ({
  xeroService: {
    isSimulation: jest.fn(),
    pushBill: jest.fn(),
    pushArInvoice: jest.fn(),
    listExpenseAccounts: jest.fn(),
    computeRetryAvailable: jest.fn(() => false),
    describeMode: jest.fn(() => ({ simulated: true, label: 'SIMULATION', detail: 'test' })),
    MAX_SYNC_ATTEMPTS: 3,
  },
  apInvoiceService: {
    validateForApproval: jest.fn(async () => ({ can_approve: true, issues: [], requires_low_confidence_confirmation: false })),
  },
}))

// retrySync claims the log row under a lock and flips it out of `failed` before pushing,
// so two concurrent retries cannot both create a record in Xero. Stubbed here because
// these are unit tests against mocked models.
jest.mock('../../src/config', () => ({
  transaction: jest.fn(async (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } })),
}))

jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))
jest.mock('../../src/services/vendorInvoiceAuditService', () => ({ record: jest.fn(async () => ({})) }))

const { XeroConnection, VendorInvoice, Invoice, User, XeroSyncLog } = require('../../src/models')
const { xeroService, apInvoiceService } = require('../../src/services')
const notificationService = require('../../src/services/notificationService')
const { retrySync, listSyncLogs, expenseAccounts } = require('../../src/controllers/xeroController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}

function makeLog(overrides = {}) {
  const log = { id: 1, status: 'failed', attempt_count: 1, entity_type: 'vendor_invoice', entity_id: 1, ...overrides }
  log.update = jest.fn(async (fields) => { Object.assign(log, fields); return log })
  return log
}

beforeEach(() => {
  jest.clearAllMocks()
  // Simulation mode means ensureFreshConnection returns the connection unchanged -
  // no token-expiry math needs mocking for these tests.
  xeroService.isSimulation.mockReturnValue(true)
  XeroConnection.findOne.mockResolvedValue({ id: 1, is_connected: true, xero_tenant_id: 'demo-tenant', access_token: 'demo-token' })
  XeroSyncLog.count.mockResolvedValue([])
})

describe('expenseAccounts', () => {
  test('returns the active bill-coding accounts from the connected Xero organisation', async () => {
    const accounts = [{ code: '400', name: 'Purchases', type: 'DIRECTCOSTS', tax_type: 'INPUT' }]
    xeroService.listExpenseAccounts.mockResolvedValue(accounts)
    const res = mockRes()

    await expenseAccounts({}, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(payload(res).data).toEqual({ accounts, simulated: true })
    expect(xeroService.listExpenseAccounts).toHaveBeenCalledWith(expect.objectContaining({ xero_tenant_id: 'demo-tenant' }))
  })

  test('returns 503 without attempting lookup when Xero is disconnected', async () => {
    XeroConnection.findOne.mockResolvedValue(null)
    const res = mockRes()

    await expenseAccounts({}, res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(payload(res).code).toBe('XERO_NOT_CONNECTED')
    expect(xeroService.listExpenseAccounts).not.toHaveBeenCalled()
  })
})

describe('retrySync (UC-08) - shared guards', () => {
  test('404s when the sync log does not exist', async () => {
    XeroSyncLog.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await retrySync({ params: { id: 999 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('409s when the log is not currently failed', async () => {
    XeroSyncLog.findByPk.mockResolvedValue(makeLog({ status: 'success' }))
    const res = mockRes()
    await retrySync({ params: { id: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('NOT_FAILED')
  })

  test('409s once attempt_count has already hit the retry cap', async () => {
    XeroSyncLog.findByPk.mockResolvedValue(makeLog({ attempt_count: 3 }))
    const res = mockRes()
    await retrySync({ params: { id: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('RETRY_LIMIT_REACHED')
  })

  test('503s when Xero is not connected', async () => {
    XeroConnection.findOne.mockResolvedValue(null)
    XeroSyncLog.findByPk.mockResolvedValue(makeLog())
    const res = mockRes()
    await retrySync({ params: { id: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(payload(res).code).toBe('XERO_NOT_CONNECTED')
  })
})

describe('retrySync (UC-08) - entity_type "ar_invoice"', () => {
  test('retries through pushArInvoice (not pushBill) using the real Invoice, and syncs its status on success', async () => {
    const log = makeLog({ id: 15, entity_type: 'ar_invoice', entity_id: 9, attempt_count: 1 })
    XeroSyncLog.findByPk.mockResolvedValue(log)
    const invoice = {
      id: 9, total_amount: 850, approved_by: 2,
      Client: { name: 'Tan Tock Seng Hospital' },
      InvoiceLineItems: [{ description: 'EAS - Office Hours', quantity: 1, unit_price: 850 }],
    }
    invoice.update = jest.fn(async (fields) => { Object.assign(invoice, fields); return invoice })
    Invoice.findByPk.mockResolvedValue(invoice)
    xeroService.pushArInvoice.mockResolvedValue({ ok: true, xeroRecordId: 'INV-XR-20260622-0009' })

    const res = mockRes()
    await retrySync({ params: { id: 15 } }, res)

    expect(xeroService.pushBill).not.toHaveBeenCalled()
    expect(xeroService.pushArInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ id: 9, client_name: 'Tan Tock Seng Hospital', total_amount: 850 }),
      expect.anything()
    )
    expect(invoice.update).toHaveBeenCalledWith({ status: 'synced_to_xero', xero_invoice_id: 'INV-XR-20260622-0009' })
    expect(log.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', attempt_count: 2, xero_record_id: 'INV-XR-20260622-0009' }))
    expect(res.status).toHaveBeenCalledWith(200)
    expect(payload(res).data.status).toBe('success')
  })

  test('marks the real Invoice (not a phantom vendor invoice) failed when the retry fails again', async () => {
    const log = makeLog({ id: 16, entity_type: 'ar_invoice', entity_id: 10, attempt_count: 1 })
    XeroSyncLog.findByPk.mockResolvedValue(log)
    const invoice = { id: 10, total_amount: 500, approved_by: 1, Client: { name: 'Singapore General Hospital' }, InvoiceLineItems: [] }
    invoice.update = jest.fn(async (fields) => { Object.assign(invoice, fields); return invoice })
    Invoice.findByPk.mockResolvedValue(invoice)
    xeroService.pushArInvoice.mockResolvedValue({ ok: false, error: "ContactNotFound: The contact 'Singapore General Hospital' does not exist in Xero." })

    const res = mockRes()
    await retrySync({ params: { id: 16 } }, res)

    expect(invoice.update).toHaveBeenCalledWith({ status: 'failed' })
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 1, type: 'xero_sync_failed' }))
    expect(payload(res).data.status).toBe('failed')
    expect(payload(res).data.error_message).toMatch(/ContactNotFound/)
  })

  test('falls back to an AR Specialist when a legacy failed invoice has no approved_by', async () => {
    const log = makeLog({ id: 18, entity_type: 'ar_invoice', entity_id: 11, attempt_count: 1 })
    XeroSyncLog.findByPk.mockResolvedValue(log)
    const invoice = { id: 11, total_amount: 500, approved_by: null, Client: { name: 'Legacy Client' }, InvoiceLineItems: [] }
    invoice.update = jest.fn(async (fields) => { Object.assign(invoice, fields); return invoice })
    Invoice.findByPk.mockResolvedValue(invoice)
    User.findOne.mockResolvedValue({ id: 7, role: 'ar_specialist' })
    xeroService.pushArInvoice.mockResolvedValue({ ok: false, error: 'Xero rejected the invoice' })

    const res = mockRes()
    await retrySync({ params: { id: 18 } }, res)

    expect(User.findOne).toHaveBeenCalledWith({ where: { role: 'ar_specialist' } })
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 7 }))
    expect(payload(res).data.status).toBe('failed')
  })

  test('404s when the linked Invoice no longer exists', async () => {
    XeroSyncLog.findByPk.mockResolvedValue(makeLog({ id: 17, entity_type: 'ar_invoice', entity_id: 999 }))
    Invoice.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await retrySync({ params: { id: 17 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe('retrySync (UC-08) - entity_type "vendor_invoice" (unchanged behaviour)', () => {
  test('blocks retry before Xero when the corrected AP invoice is still invalid', async () => {
    const log = makeLog({ id: 22, entity_type: 'vendor_invoice', entity_id: 6, attempt_count: 1 })
    XeroSyncLog.findByPk.mockResolvedValue(log)
    const vendorInvoice = { id: 6, vendor_name: 'Esso Petroleum Pte Ltd', uploaded_by: 4, xero_bill_id: null }
    VendorInvoice.findByPk.mockResolvedValue(vendorInvoice)
    apInvoiceService.validateForApproval.mockResolvedValueOnce({
      can_approve: false,
      issues: [{ code: 'MISSING_XERO_ACCOUNT_CODE', message: 'Xero expense account code is required.' }],
      requires_low_confidence_confirmation: false,
    })

    const res = mockRes()
    await retrySync({ params: { id: 22 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res)).toMatchObject({
      code: 'APPROVAL_VALIDATION_FAILED',
      data: { issues: [{ code: 'MISSING_XERO_ACCOUNT_CODE' }] },
    })
    expect(log.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }))
    expect(xeroService.pushBill).not.toHaveBeenCalled()
  })

  test('retries through pushBill and updates the VendorInvoice row on success', async () => {
    const log = makeLog({ id: 20, entity_type: 'vendor_invoice', entity_id: 5, attempt_count: 1 })
    XeroSyncLog.findByPk.mockResolvedValue(log)
    const vendorInvoice = { id: 5, vendor_name: 'Esso Petroleum Pte Ltd', uploaded_by: 4 }
    vendorInvoice.update = jest.fn(async (fields) => { Object.assign(vendorInvoice, fields); return vendorInvoice })
    VendorInvoice.findByPk.mockResolvedValue(vendorInvoice)
    xeroService.pushBill.mockResolvedValue({ ok: true, xeroRecordId: 'bill-123' })

    const res = mockRes()
    await retrySync({ params: { id: 20 } }, res)

    expect(xeroService.pushArInvoice).not.toHaveBeenCalled()
    expect(vendorInvoice.update).toHaveBeenCalledWith({ status: 'synced_to_xero', xero_bill_id: 'bill-123' })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  test('404s when the linked VendorInvoice no longer exists', async () => {
    XeroSyncLog.findByPk.mockResolvedValue(makeLog({ id: 21, entity_type: 'vendor_invoice', entity_id: 999 }))
    VendorInvoice.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await retrySync({ params: { id: 21 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe('listSyncLogs (UC-08) - resolveEntityReference', () => {
  test('an ar_invoice row resolves to "<client name> - Invoice #<id>", not a non-existent invoice_number field', async () => {
    // The Invoice model has no invoice_number column - this locks in that the AR
    // reference is built from the Client association instead of a field that would
    // always be undefined.
    XeroSyncLog.findAndCountAll.mockResolvedValue({
      rows: [{ id: 30, entity_type: 'ar_invoice', entity_id: 9, xero_record_id: null, status: 'failed', attempt_count: 1, error_message: 'boom', synced_at: null, createdAt: new Date() }],
      count: 1,
    })
    Invoice.findByPk.mockResolvedValue({ id: 9, Client: { name: 'Tan Tock Seng Hospital' } })

    const res = mockRes()
    await listSyncLogs({ query: { page: 1, limit: 50 } }, res)

    expect(Invoice.findByPk).toHaveBeenCalledWith(9, expect.objectContaining({ include: expect.anything() }))
    expect(payload(res).data.data[0].entity_reference).toBe('Tan Tock Seng Hospital - Invoice #9')
    expect(payload(res).data.status_counts).toEqual({ pending: 0, success: 0, failed: 0 })
  })

  test('returns status counts that ignore only the selected status filter', async () => {
    XeroSyncLog.findAndCountAll.mockResolvedValue({
      rows: [],
      count: 0,
    })
    XeroSyncLog.count.mockResolvedValue([
      { status: 'failed', count: '4' },
      { status: 'success', count: '9' },
    ])

    const res = mockRes()
    await listSyncLogs({ query: { status: 'failed', entity_type: 'vendor_invoice', page: 1, limit: 50 } }, res)

    expect(XeroSyncLog.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { entity_type: 'vendor_invoice', status: 'failed' },
    }))
    expect(XeroSyncLog.count).toHaveBeenCalledWith({ where: { entity_type: 'vendor_invoice' }, group: ['status'] })
    expect(payload(res).data.status_counts).toEqual({ pending: 0, success: 9, failed: 4 })
  })

  test('an ar_invoice row with no linked Invoice resolves to null instead of throwing', async () => {
    XeroSyncLog.findAndCountAll.mockResolvedValue({
      rows: [{ id: 31, entity_type: 'ar_invoice', entity_id: 999, xero_record_id: null, status: 'failed', attempt_count: 1, error_message: 'boom', synced_at: null, createdAt: new Date() }],
      count: 1,
    })
    Invoice.findByPk.mockResolvedValue(null)

    const res = mockRes()
    await listSyncLogs({ query: { page: 1, limit: 50 } }, res)

    expect(payload(res).data.data[0].entity_reference).toBeNull()
  })
})
