jest.mock('../../src/models', () => ({
  Invoice: { findByPk: jest.fn(), findAndCountAll: jest.fn() },
  InvoiceLineItem: { findAll: jest.fn(), create: jest.fn(), findOne: jest.fn(), count: jest.fn(), bulkCreate: jest.fn() },
  Booking: { update: jest.fn(), findByPk: jest.fn() },
  Client: { findByPk: jest.fn() },
  ServiceMemo: { update: jest.fn(), findByPk: jest.fn() },
  PricingContract: { findOne: jest.fn() },
  PricingRate: { findAll: jest.fn() },
  SurchargeSchedule: { findAll: jest.fn() },
  User: { findOne: jest.fn() },
  // findOrCreate: the sync log is now one row per invoice, incremented per attempt, rather
  // than a fresh row each time. findOne: the retry endpoint reads it to enforce the cap.
  XeroSyncLog: { create: jest.fn(), findOrCreate: jest.fn(), findOne: jest.fn() },
}))

jest.mock('../../src/config', () => ({
  transaction: jest.fn((cb) => cb({ LOCK: { UPDATE: 'UPDATE' } })),
}))

jest.mock('../../src/services', () => ({
  xeroService: { pushArInvoice: jest.fn(), MAX_SYNC_ATTEMPTS: 3 },
  pricingService: { computeInvoiceLineItems: jest.fn() },
  gstService: {
    buildSnapshot: jest.fn(),
    calculateTotals: jest.fn((items, rate) => {
      const subtotal = items.reduce((sum, item) => sum + Number(item.amount), 0)
      const tax_amount = Math.round(items.reduce(
        (sum, item) => sum + Math.round(Number(item.amount) * Number(rate)) / 100,
        0
      ) * 100) / 100
      return { subtotal, tax_amount, total_amount: subtotal + tax_amount }
    }),
  },
}))

jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))

jest.mock('../../src/controllers/xeroController', () => ({ getFreshConnection: jest.fn() }))

const {
  Invoice, InvoiceLineItem, Booking, Client, ServiceMemo, PricingContract,
  PricingRate, SurchargeSchedule, XeroSyncLog,
} = require('../../src/models')
const { xeroService, pricingService, gstService } = require('../../src/services')
const notificationService = require('../../src/services/notificationService')
const xeroController = require('../../src/controllers/xeroController')
const {
  addLineItem, updateLineItem, deleteLineItem, rematchInvoice, batchApprove, retryXero, listInvoices,
} = require('../../src/controllers/invoiceController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}
function makeInvoice(overrides = {}) {
  const obj = {
    id: 1, status: 'matched', subtotal: 850,
    gst_rate_id: 3, gst_rate_percent: 9, gst_effective_date: '2026-08-01', xero_tax_type: 'OUTPUT',
    tax_amount: 76.5, total_amount: 926.5,
    ...overrides,
  }
  obj.update = jest.fn(async (fields) => { Object.assign(obj, fields); return obj })
  return obj
}

// One sync-log row per invoice, reused across attempts.
function makeSyncLog(overrides = {}) {
  const obj = { id: 1, entity_type: 'ar_invoice', entity_id: 1, status: 'pending', attempt_count: 0, ...overrides }
  obj.update = jest.fn(async (fields) => { Object.assign(obj, fields); return obj })
  return obj
}

let syncLog

beforeEach(() => {
  jest.clearAllMocks()
  // Default: a fresh log with no attempts yet, and no pre-existing log for the cap check.
  syncLog = makeSyncLog()
  XeroSyncLog.findOrCreate.mockResolvedValue([syncLog, true])
  XeroSyncLog.findOne.mockResolvedValue(null)
  gstService.buildSnapshot.mockResolvedValue({
    gst_rate_id: 3, gst_rate_percent: 9, gst_effective_date: '2026-08-01', xero_tax_type: 'OUTPUT',
  })
})

describe('rematchInvoice', () => {
  test('keeps the invoice unmatched when no contract covers the service date', async () => {
    const invoice = makeInvoice({ id: 10, status: 'unmatched', memo_id: 5, booking_id: 8, client_id: 12 })
    Invoice.findByPk.mockResolvedValue(invoice)
    ServiceMemo.findByPk.mockResolvedValue({ id: 5, service_type: 'eas', transfer_type: 'two_way_hospital', is_office_hours: true })
    Booking.findByPk.mockResolvedValue({ id: 8, scheduled_date: '2026-08-01' })
    InvoiceLineItem.count.mockResolvedValue(0)
    PricingContract.findOne.mockResolvedValue(null)

    const res = mockRes()
    await rematchInvoice({ params: { id: 10 } }, res)

    expect(res.status).toHaveBeenCalledWith(422)
    expect(payload(res).code).toBe('NO_ACTIVE_CONTRACT')
    expect(invoice.update).not.toHaveBeenCalled()
    expect(InvoiceLineItem.bulkCreate).not.toHaveBeenCalled()
  })

  test('reprices an unmatched invoice after the missing contract and rate are added', async () => {
    const invoice = makeInvoice({
      id: 10, status: 'unmatched', memo_id: 5, booking_id: 8, client_id: 12,
      contract_id: null, tax_amount: 0, subtotal: 0, total_amount: 0,
    })
    const memo = { id: 5, service_type: 'eas', transfer_type: 'two_way_hospital', is_office_hours: true }
    const generatedLine = {
      description: 'EAS - Two-Way Hospital Transfer (Office Hours)',
      quantity: 1, unit_price: 1200, amount: 1200, is_manual_adjustment: false,
    }
    Invoice.findByPk.mockResolvedValue(invoice)
    ServiceMemo.findByPk.mockResolvedValue(memo)
    Booking.findByPk.mockResolvedValue({ id: 8, scheduled_date: '2026-08-01' })
    InvoiceLineItem.count.mockResolvedValue(0)
    PricingContract.findOne.mockResolvedValue({ id: 7 })
    PricingRate.findAll.mockResolvedValue([{ id: 3, time_of_day: 'office_hours', base_amount: 1200 }])
    SurchargeSchedule.findAll.mockResolvedValue([])
    pricingService.computeInvoiceLineItems.mockReturnValue({
      matched: true, lineItems: [generatedLine], subtotal: 1200, unpriced: [],
    })
    InvoiceLineItem.findAll.mockResolvedValue([{ id: 99, ...generatedLine }])

    const res = mockRes()
    await rematchInvoice({ params: { id: 10 } }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(invoice.update).toHaveBeenCalledWith(expect.objectContaining({
      contract_id: 7, status: 'matched', subtotal: 1200, tax_amount: 108, total_amount: 1308,
    }), expect.anything())
    expect(InvoiceLineItem.bulkCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ invoice_id: 10, amount: 1200 })],
      expect.anything()
    )
    expect(payload(res).data).toMatchObject({ invoice_id: 10, status: 'matched', contract_id: 7 })
  })

  test('does not overwrite an invoice that has already left unmatched status', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ status: 'adjusted' }))
    const res = mockRes()

    await rematchInvoice({ params: { id: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('INVOICE_NOT_UNMATCHED')
    expect(PricingContract.findOne).not.toHaveBeenCalled()
  })
})

describe('addLineItem (UC-05)', () => {
  test('404s when the invoice does not exist', async () => {
    Invoice.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await addLineItem({ params: { invoiceId: 1 }, body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('blocks edits once the invoice is approved or synced', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ status: 'approved' }))
    const res = mockRes()
    await addLineItem({ params: { invoiceId: 1 }, body: { description: 'x', quantity: 1, unit_price: 10 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('INVOICE_LOCKED')
  })

  test('rejects a missing description or non-positive quantity/price', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice())
    const res = mockRes()
    await addLineItem({ params: { invoiceId: 1 }, body: { description: '  ', quantity: 0, unit_price: 10 } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('VALIDATION_ERROR')
  })

  test('adds a manual line item, flips a matched invoice to adjusted, and recalculates totals', async () => {
    const invoice = makeInvoice({ status: 'matched', tax_amount: 0 })
    Invoice.findByPk.mockResolvedValue(invoice)
    InvoiceLineItem.create.mockResolvedValue({ id: 9, invoice_id: 1, description: 'Extra mileage', quantity: 1, unit_price: 40, amount: 40, is_manual_adjustment: true })
    InvoiceLineItem.findAll.mockResolvedValue([{ amount: 850 }, { amount: 40 }])

    const res = mockRes()
    await addLineItem({ params: { invoiceId: 1 }, body: { description: 'Extra mileage', quantity: 1, unit_price: 40 } }, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(invoice.status).toBe('adjusted')
    expect(payload(res).data.invoice.subtotal).toBe(890)
  })
})

describe('updateLineItem (UC-05)', () => {
  test('rejects a negative quantity', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice())
    InvoiceLineItem.findOne.mockResolvedValue({ id: 1, invoice_id: 1, quantity: 1, unit_price: 10, amount: 10 })
    const res = mockRes()
    await updateLineItem({ params: { invoiceId: 1, itemId: 1 }, body: { quantity: -1 } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('VALIDATION_ERROR')
  })

  test('404s when the line item does not belong to this invoice', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice())
    InvoiceLineItem.findAll.mockResolvedValue([]) // for the not-found path we short-circuit below
    InvoiceLineItem.findOne.mockResolvedValue(null)
    const res = mockRes()
    await updateLineItem({ params: { invoiceId: 1, itemId: 999 }, body: { quantity: 2 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('recomputes amount = quantity * unit_price and re-totals the invoice', async () => {
    const invoice = makeInvoice({ status: 'matched' })
    Invoice.findByPk.mockResolvedValue(invoice)
    const item = { id: 1, invoice_id: 1, description: 'Base', quantity: 1, unit_price: 850, amount: 850 }
    item.update = jest.fn(async (f) => Object.assign(item, f))
    InvoiceLineItem.findOne.mockResolvedValue(item)
    InvoiceLineItem.findAll.mockResolvedValue([{ amount: 950 }])

    const res = mockRes()
    await updateLineItem({ params: { invoiceId: 1, itemId: 1 }, body: { unit_price: 950 } }, res)

    expect(item.amount).toBe(950)
    expect(invoice.status).toBe('adjusted')
    expect(res.status).toHaveBeenCalledWith(200)
  })

  test('flips an unmatched invoice to adjusted, same as addLineItem', async () => {
    const invoice = makeInvoice({ status: 'unmatched', subtotal: 0, total_amount: 0 })
    Invoice.findByPk.mockResolvedValue(invoice)
    const item = { id: 1, invoice_id: 1, description: 'Manual price', quantity: 1, unit_price: 100, amount: 100 }
    item.update = jest.fn(async (f) => Object.assign(item, f))
    InvoiceLineItem.findOne.mockResolvedValue(item)
    InvoiceLineItem.findAll.mockResolvedValue([{ amount: 120 }])

    const res = mockRes()
    await updateLineItem({ params: { invoiceId: 1, itemId: 1 }, body: { unit_price: 120 } }, res)

    expect(invoice.status).toBe('adjusted')
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

describe('deleteLineItem (UC-05)', () => {
  test('403s when trying to delete an engine-generated line item', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice())
    InvoiceLineItem.findOne.mockResolvedValue({ id: 1, is_manual_adjustment: false })
    const res = mockRes()
    await deleteLineItem({ params: { invoiceId: 1, itemId: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(payload(res).code).toBe('SYSTEM_LINE_ITEM')
  })

  test('deletes a manual line item and recalculates totals', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice())
    const item = { id: 2, is_manual_adjustment: true, destroy: jest.fn().mockResolvedValue() }
    InvoiceLineItem.findOne.mockResolvedValue(item)
    InvoiceLineItem.findAll.mockResolvedValue([{ amount: 850 }])
    const res = mockRes()
    await deleteLineItem({ params: { invoiceId: 1, itemId: 2 } }, res)
    expect(item.destroy).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

describe('batchApprove (UC-06)', () => {
  test('rejects an empty/non-array invoice_ids', async () => {
    const res = mockRes()
    await batchApprove({ body: { invoice_ids: [] }, user: { sub: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('VALIDATION_ERROR')
  })

  test('503s when Xero is not connected', async () => {
    xeroController.getFreshConnection.mockResolvedValue(null)
    const res = mockRes()
    await batchApprove({ body: { invoice_ids: [1] }, user: { sub: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(503)
    expect(payload(res).code).toBe('XERO_NOT_CONNECTED')
  })

  test('skips invoices not in matched/adjusted status and syncs the rest', async () => {
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    const eligible = makeInvoice({ id: 1, status: 'matched' })
    const ineligible = makeInvoice({ id: 2, status: 'unmatched' })
    Invoice.findByPk.mockImplementation((id) => Promise.resolve(id === 1 ? eligible : ineligible))
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: true, xeroRecordId: 'INV-XR-1' })

    const res = mockRes()
    await batchApprove({ body: { invoice_ids: [1, 2] }, user: { sub: 1 } }, res)

    expect(payload(res).data.approved).toEqual([1])
    expect(payload(res).data.skipped).toEqual([2])
    expect(payload(res).data.queued_for_xero).toEqual([1])
    expect(eligible.status).toBe('synced_to_xero')
  })

  test('marks an invoice failed and notifies when the Xero push itself fails', async () => {
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    const invoice = makeInvoice({ id: 3, status: 'matched', approved_by: 7 })
    Invoice.findByPk.mockResolvedValue(invoice)
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: false, error: 'Xero rejected the invoice' })

    const res = mockRes()
    await batchApprove({ body: { invoice_ids: [3] }, user: { sub: 1 } }, res)

    expect(invoice.status).toBe('failed')
    expect(payload(res).data.queued_for_xero).toEqual([])
    expect(notificationService.create).toHaveBeenCalled()
  })
})

describe('retryXero (UC-07 alt / UC-10)', () => {
  test('404s when the invoice does not exist', async () => {
    Invoice.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('409s when the invoice is not in failed status', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ status: 'matched' }))
    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('INVOICE_NOT_FAILED')
  })

  test('503s when Xero is not connected', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ status: 'failed' }))
    xeroController.getFreshConnection.mockResolvedValue(null)
    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(503)
  })

  test('502s when Xero rejects the retried push', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ status: 'failed' }))
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: false, error: 'still down' })
    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(502)
    expect(payload(res).code).toBe('XERO_SYNC_ERROR')
  })

  test('re-syncs successfully and advances the invoice to synced_to_xero', async () => {
    const invoice = makeInvoice({ status: 'failed' })
    Invoice.findByPk.mockResolvedValue(invoice)
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: true, xeroRecordId: 'INV-XR-99' })
    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(payload(res).data.xero_invoice_id).toBe('INV-XR-99')
    expect(invoice.status).toBe('synced_to_xero')
  })

  // Regression: this route used to create a brand-new sync log at attempt_count 1 on every
  // call, so the UC-08 three-attempt ceiling - which reads attempt_count - was unreachable
  // here even though the Sync Status screen enforced it.
  test('reuses the invoice\'s existing sync log and increments the attempt count', async () => {
    const invoice = makeInvoice({ status: 'failed' })
    Invoice.findByPk.mockResolvedValue(invoice)
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: true, xeroRecordId: 'INV-XR-100' })

    // An existing log from the first, failed attempt.
    const existing = makeSyncLog({ status: 'failed', attempt_count: 1 })
    XeroSyncLog.findOne.mockResolvedValue(existing)
    XeroSyncLog.findOrCreate.mockResolvedValue([existing, false])

    await retryXero({ params: { id: 1 } }, mockRes())

    expect(XeroSyncLog.create).not.toHaveBeenCalled()
    expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', attempt_count: 2 }))
  })

  test('refuses a retry once the attempt ceiling is reached', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ status: 'failed' }))
    XeroSyncLog.findOne.mockResolvedValue(makeSyncLog({ status: 'failed', attempt_count: 3 }))

    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('RETRY_LIMIT_REACHED')
    expect(xeroService.pushArInvoice).not.toHaveBeenCalled()
  })
})

describe('line item provenance (audit trail)', () => {
  test('marks an edited engine line as overridden and keeps the engine\'s original figures', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ status: 'matched' }))
    const item = {
      id: 1, invoice_id: 1, description: 'EAS base rate', quantity: 1, unit_price: 950, amount: 950,
      is_manual_adjustment: false, was_manually_edited: false, engine_unit_price: null, engine_amount: null,
    }
    item.update = jest.fn(async (f) => Object.assign(item, f))
    InvoiceLineItem.findOne.mockResolvedValue(item)
    InvoiceLineItem.findAll.mockResolvedValue([{ amount: 4321 }])

    await updateLineItem({ params: { invoiceId: 1, itemId: 1 }, body: { unit_price: 4321 } }, mockRes())

    // Still engine-sourced, but no longer purely engine-derived - and the original is kept.
    expect(item.is_manual_adjustment).toBe(false)
    expect(item.was_manually_edited).toBe(true)
    expect(Number(item.engine_unit_price)).toBe(950)
    expect(Number(item.engine_amount)).toBe(950)
  })

  test('a second edit keeps the engine figures from the first, not the previous manual value', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ status: 'adjusted' }))
    const item = {
      id: 1, invoice_id: 1, description: 'EAS base rate', quantity: 1, unit_price: 4321, amount: 4321,
      is_manual_adjustment: false, was_manually_edited: true, engine_unit_price: 950, engine_amount: 950,
    }
    item.update = jest.fn(async (f) => Object.assign(item, f))
    InvoiceLineItem.findOne.mockResolvedValue(item)
    InvoiceLineItem.findAll.mockResolvedValue([{ amount: 1000 }])

    await updateLineItem({ params: { invoiceId: 1, itemId: 1 }, body: { unit_price: 1000 } }, mockRes())

    expect(Number(item.engine_unit_price)).toBe(950)
  })

  test('editing only the description does not brand the line as overridden', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ status: 'matched' }))
    const item = {
      id: 1, invoice_id: 1, description: 'EAS base rate', quantity: 1, unit_price: 950, amount: 950,
      is_manual_adjustment: false, was_manually_edited: false, engine_unit_price: null, engine_amount: null,
    }
    item.update = jest.fn(async (f) => Object.assign(item, f))
    InvoiceLineItem.findOne.mockResolvedValue(item)
    InvoiceLineItem.findAll.mockResolvedValue([{ amount: 950 }])

    await updateLineItem({ params: { invoiceId: 1, itemId: 1 }, body: { description: 'EAS base rate (one-way)' } }, mockRes())

    expect(item.was_manually_edited).toBe(false)
    expect(item.engine_unit_price).toBeNull()
  })
})

describe('listInvoices query bounds', () => {
  const { Op } = require('sequelize')

  // Regression: to_date is a bare date, created_at is a timestamp, so Op.lte compared against
  // 00:00 and "invoices up to today" silently excluded everything created today.
  test('to_date covers the whole end date rather than stopping at its midnight', async () => {
    Invoice.findAndCountAll.mockResolvedValue({ rows: [], count: 0 })
    await listInvoices({ query: { to_date: '2026-08-04' } }, mockRes())

    const where = Invoice.findAndCountAll.mock.calls[0][0].where
    expect(where.created_at[Op.lte]).toBeUndefined()
    expect(where.created_at[Op.lt]).toEqual(new Date('2026-08-05T00:00:00.000Z'))
  })

  test('caps an absurd ?limit', async () => {
    Invoice.findAndCountAll.mockResolvedValue({ rows: [], count: 0 })
    await listInvoices({ query: { limit: '100000' } }, mockRes())
    expect(Invoice.findAndCountAll.mock.calls[0][0].limit).toBe(100)
  })
})
