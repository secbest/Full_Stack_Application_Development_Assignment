jest.mock('../../src/models', () => ({
  VendorInvoice: { findByPk: jest.fn(), findOne: jest.fn(), findAndCountAll: jest.fn(), create: jest.fn() },
  VendorInvoiceItem: { create: jest.fn(), destroy: jest.fn() },
  User: {},
  VendorInvoiceAudit: {},
  XeroSyncLog: { create: jest.fn() },
}))

jest.mock('../../src/services', () => ({
  cloudinaryService: { uploadPdf: jest.fn() },
  ocrService: { extractVendorInvoice: jest.fn() },
  xeroService: { pushBill: jest.fn() },
  apInvoiceService: {
    resolveTaxSnapshot: jest.fn(async () => ({ gst_rate_id: null, gst_rate_percent: 0, gst_effective_date: null, xero_tax_type: 'NRINPUT' })),
    calculateTax: jest.fn(() => 0),
    validateForApproval: jest.fn(async (invoice) => ({ can_approve: true, issues: [], requires_low_confidence_confirmation: Boolean(invoice.is_low_confidence) })),
  },
  vendorInvoiceAuditService: {
    record: jest.fn(async () => ({})),
    diff: jest.fn((before, after, fields) => fields.reduce((out, field) => {
      if (String(before[field] ?? '') !== String(after[field] ?? '')) out[field] = { from: before[field] ?? null, to: after[field] ?? null }
      return out
    }, {})),
  },
}))

jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))

jest.mock('../../src/controllers/xeroController', () => ({ getFreshConnection: jest.fn() }))

// approveVendorInvoice claims the invoice inside a transaction with a row lock so two
// concurrent approvals cannot both push to Xero. These are unit tests against mocked
// models, so the transaction is a stub that just runs the callback and hands it a `t`
// carrying the LOCK enum the controller passes to findByPk.
jest.mock('../../src/config', () => ({
  transaction: jest.fn(async (fn) => fn({ LOCK: { UPDATE: 'UPDATE' } })),
}))

const { VendorInvoice, XeroSyncLog } = require('../../src/models')
const { xeroService, apInvoiceService } = require('../../src/services')
const xeroController = require('../../src/controllers/xeroController')
const {
  calculateRebate, uploadVendorInvoice, updateVendorInvoice, approveVendorInvoice, rejectVendorInvoice,
} = require('../../src/controllers/vendorInvoiceController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}
function makeVendorInvoice(overrides = {}) {
  const obj = {
    id: 1, vendor_name: 'Esso', invoice_number: 'INV-1', status: 'pending_review',
    invoice_date: '2026-06-18', due_date: '2026-07-18', currency_code: 'SGD',
    gst_treatment: 'non_gst', gst_rate_percent: 0, xero_tax_type: 'NRINPUT', xero_account_code: '400',
    subtotal_excluding_gst: 1840, gst_amount: 0, total_including_gst: 1840,
    extracted_total: 1840, rebate_percentage: 1.0, rebate_amount: 18.4, verified_total: 1821.6,
    uploaded_by: 3,
    VendorInvoiceItems: [{ id: 11, description: 'Fuel', quantity: 1, unit_price: 1840, amount: 1840 }],
    updatedAt: null,
    ...overrides,
  }
  obj.update = jest.fn(async (fields) => { Object.assign(obj, fields); return obj })
  return obj
}

beforeEach(() => jest.clearAllMocks())

describe('uploadVendorInvoice (UC-03) - entry guard', () => {
  test('rejects the request when no file is attached', async () => {
    const res = mockRes()
    await uploadVendorInvoice({ file: undefined, body: {}, user: { sub: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('INVALID_FILE_TYPE')
  })
})

describe('updateVendorInvoice (UC-06)', () => {
  test('404s when the invoice does not exist', async () => {
    VendorInvoice.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await updateVendorInvoice({ params: { id: 1 }, body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('409s when the invoice is not in an editable status', async () => {
    VendorInvoice.findByPk.mockResolvedValue(makeVendorInvoice({ status: 'synced_to_xero' }))
    const res = mockRes()
    await updateVendorInvoice({ params: { id: 1 }, body: { vendor_name: 'X' } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('INVALID_STATUS')
  })

  test('rejects a non-positive extracted_total', async () => {
    VendorInvoice.findByPk.mockResolvedValue(makeVendorInvoice())
    const res = mockRes()
    await updateVendorInvoice({ params: { id: 1 }, body: { extracted_total: 0 } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('INVALID_TOTAL')
  })

  test('recalculates the rebate when extracted_total changes', async () => {
    const invoice = makeVendorInvoice({ extracted_total: 1000, rebate_percentage: 1.0 })
    VendorInvoice.findByPk.mockResolvedValue(invoice)
    const res = mockRes()
    await updateVendorInvoice({ params: { id: 1 }, body: { extracted_total: 2000 } }, res)
    expect(invoice.rebate_amount).toBe(20)
    expect(invoice.verified_total).toBe(1980)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  test('409s on a duplicate vendor+invoice_number constraint violation', async () => {
    const invoice = makeVendorInvoice()
    invoice.update = jest.fn().mockRejectedValue({ name: 'SequelizeUniqueConstraintError' })
    VendorInvoice.findByPk.mockResolvedValue(invoice)
    const res = mockRes()
    await updateVendorInvoice({ params: { id: 1 }, body: { invoice_number: 'INV-DUP' } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('DUPLICATE_INVOICE')
  })
})

describe('approveVendorInvoice (UC-06/07)', () => {
  test('404s when the invoice does not exist', async () => {
    VendorInvoice.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await approveVendorInvoice({ params: { id: 1 }, user: { sub: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('409s when the invoice is not pending_review', async () => {
    VendorInvoice.findByPk.mockResolvedValue(makeVendorInvoice({ status: 'approved' }))
    const res = mockRes()
    await approveVendorInvoice({ params: { id: 1 }, user: { sub: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('INVALID_STATUS')
  })

  test('409s when extracted_total has not been set yet', async () => {
    VendorInvoice.findByPk.mockResolvedValue(makeVendorInvoice({ extracted_total: null }))
    const res = mockRes()
    await approveVendorInvoice({ params: { id: 1 }, user: { sub: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('MISSING_TOTAL')
  })

  test('blocks approval validation failures before contacting Xero', async () => {
    const invoice = makeVendorInvoice()
    VendorInvoice.findByPk.mockResolvedValue(invoice)
    apInvoiceService.validateForApproval.mockResolvedValueOnce({
      can_approve: false,
      issues: [{ code: 'MISSING_ACCOUNT', message: 'Expense account is required.' }],
      requires_low_confidence_confirmation: false,
    })

    const res = mockRes()
    await approveVendorInvoice({ params: { id: 1 }, body: {}, user: { sub: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res)).toMatchObject({
      code: 'APPROVAL_VALIDATION_FAILED',
      data: { issues: [{ code: 'MISSING_ACCOUNT' }] },
    })
    expect(xeroService.pushBill).not.toHaveBeenCalled()
    expect(invoice.status).toBe('pending_review')
  })

  test('requires explicit source-PDF confirmation for low-confidence OCR', async () => {
    const invoice = makeVendorInvoice({ is_low_confidence: true })
    VendorInvoice.findByPk.mockResolvedValue(invoice)

    const res = mockRes()
    await approveVendorInvoice({ params: { id: 1 }, body: {}, user: { sub: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('LOW_CONFIDENCE_CONFIRMATION_REQUIRED')
    expect(xeroService.pushBill).not.toHaveBeenCalled()
    expect(invoice.status).toBe('pending_review')
  })

  test('409s when a duplicate approved/synced invoice already exists', async () => {
    VendorInvoice.findByPk.mockResolvedValue(makeVendorInvoice())
    VendorInvoice.findOne.mockResolvedValue({ id: 2, status: 'synced_to_xero' })
    const res = mockRes()
    await approveVendorInvoice({ params: { id: 1 }, user: { sub: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('DUPLICATE_INVOICE')
  })

  // The invoice is already committed as `approved` by the time the connection is checked,
  // so a disconnected Xero must leave a recoverable trail (status `failed` + a failed sync
  // log the retry endpoint accepts) rather than an approved invoice with no sync record.
  test('503s when Xero is not connected, and records a recoverable failure', async () => {
    const invoice = makeVendorInvoice()
    VendorInvoice.findByPk.mockResolvedValue(invoice)
    VendorInvoice.findOne.mockResolvedValue(null)
    xeroController.getFreshConnection.mockResolvedValue(null)
    XeroSyncLog.create.mockResolvedValue({ id: 9, update: jest.fn() })

    const res = mockRes()
    await approveVendorInvoice({ params: { id: 1 }, user: { sub: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(503)
    expect(payload(res).code).toBe('XERO_NOT_CONNECTED')
    expect(invoice.status).toBe('failed')
    expect(XeroSyncLog.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', entity_type: 'vendor_invoice' }))
  })

  // Xero does not deduplicate ACCPAY bills, so the status check must happen under the row
  // lock. A second approval arriving after the first committed sees a non-pending_review
  // invoice and is rejected instead of pushing a second bill for the same PDF.
  test('claims the invoice under a row lock so a concurrent approval cannot double-push', async () => {
    const invoice = makeVendorInvoice()
    VendorInvoice.findByPk.mockResolvedValue(invoice)
    VendorInvoice.findOne.mockResolvedValue(null)
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    xeroService.pushBill.mockResolvedValue({ ok: true, xeroRecordId: 'BILL-1' })
    XeroSyncLog.create.mockResolvedValue({ id: 7, update: jest.fn() })

    await approveVendorInvoice({ params: { id: 1 }, user: { sub: 1 } }, mockRes())

    expect(VendorInvoice.findByPk).toHaveBeenCalledWith(1, expect.objectContaining({ lock: 'UPDATE' }))
    expect(xeroService.pushBill).toHaveBeenCalledTimes(1)

    // The second caller now finds the invoice already synced and must not push again.
    xeroService.pushBill.mockClear()
    const res2 = mockRes()
    await approveVendorInvoice({ params: { id: 1 }, user: { sub: 1 } }, res2)
    expect(res2.status).toHaveBeenCalledWith(409)
    expect(payload(res2).code).toBe('INVALID_STATUS')
    expect(xeroService.pushBill).not.toHaveBeenCalled()
  })

  test('approves and syncs to Xero on success', async () => {
    const invoice = makeVendorInvoice()
    VendorInvoice.findByPk.mockResolvedValue(invoice)
    VendorInvoice.findOne.mockResolvedValue(null)
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    xeroService.pushBill.mockResolvedValue({ ok: true, xeroRecordId: 'BILL-1' })
    XeroSyncLog.create.mockResolvedValue({ id: 5, update: jest.fn() })

    const res = mockRes()
    await approveVendorInvoice({ params: { id: 1 }, user: { sub: 1 } }, res)

    expect(invoice.status).toBe('synced_to_xero')
    expect(res.status).toHaveBeenCalledWith(200)
    expect(payload(res).data.status).toBe('synced_to_xero')
    expect(payload(res).data.xero_bill_id).toBe('BILL-1')
  })

  test('marks the invoice failed when Xero rejects the push', async () => {
    const invoice = makeVendorInvoice()
    VendorInvoice.findByPk.mockResolvedValue(invoice)
    VendorInvoice.findOne.mockResolvedValue(null)
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    xeroService.pushBill.mockResolvedValue({ ok: false, error: 'Xero down' })
    XeroSyncLog.create.mockResolvedValue({ id: 6, update: jest.fn() })

    const res = mockRes()
    await approveVendorInvoice({ params: { id: 1 }, user: { sub: 1 } }, res)

    expect(invoice.status).toBe('failed')
    expect(payload(res).data.status).toBe('failed')
    expect(payload(res).data.xero_bill_id).toBeNull()
  })
})

describe('rejectVendorInvoice (UC-06)', () => {
  test('400s when rejection_reason is missing', async () => {
    VendorInvoice.findByPk.mockResolvedValue(makeVendorInvoice())
    const res = mockRes()
    await rejectVendorInvoice({ params: { id: 1 }, body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('MISSING_REASON')
  })

  test('409s when the invoice is not in an editable status', async () => {
    VendorInvoice.findByPk.mockResolvedValue(makeVendorInvoice({ status: 'synced_to_xero' }))
    const res = mockRes()
    await rejectVendorInvoice({ params: { id: 1 }, body: { rejection_reason: 'Bad scan' } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('INVALID_STATUS')
  })

  test('rejects the invoice with the given reason', async () => {
    const invoice = makeVendorInvoice()
    VendorInvoice.findByPk.mockResolvedValue(invoice)
    const res = mockRes()
    await rejectVendorInvoice({ params: { id: 1 }, body: { rejection_reason: 'Bad scan' } }, res)
    expect(invoice.status).toBe('rejected')
    expect(invoice.rejection_reason).toBe('Bad scan')
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

describe('calculateRebate (UC-05, cross-check with xero.test.js)', () => {
  test('is re-exported and usable directly from this controller', () => {
    expect(calculateRebate(1840, 1).rebateAmount).toBe(18.40)
  })
})
