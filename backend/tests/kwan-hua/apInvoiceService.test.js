jest.mock('../../src/services/gstService', () => ({
  findApplicableRate: jest.fn(),
  toDateOnly: jest.fn((value) => String(value).slice(0, 10)),
  calculateTaxForLineItems: jest.fn((items, rate) => Math.round(items.reduce((sum, item) => sum + Number(item.amount) * Number(rate) / 100, 0) * 100) / 100),
}))

const gstService = require('../../src/services/gstService')
const apInvoiceService = require('../../src/services/apInvoiceService')

beforeEach(() => {
  jest.clearAllMocks()
  gstService.findApplicableRate.mockResolvedValue({
    id: 3,
    rate_percent: 9,
    xero_input_tax_type: 'INPUTY24',
  })
})

function validInvoice(overrides = {}) {
  return {
    vendor_name: 'Medical Supplier Pte Ltd',
    invoice_number: 'MS-100',
    invoice_date: '2026-07-01',
    due_date: '2026-07-31',
    currency_code: 'SGD',
    supplier_gst_registration_no: 'M2-1234567-8',
    gst_treatment: 'standard_rated',
    gst_rate_percent: 9,
    xero_tax_type: 'INPUTY24',
    xero_account_code: '400',
    subtotal_excluding_gst: 100,
    gst_amount: 9,
    total_including_gst: 109,
    rebate_amount: 1.09,
    verified_total: 107.91,
    is_low_confidence: false,
    VendorInvoiceItems: [{ description: 'Supplies', quantity: 2, unit_price: 50, amount: 100 }],
    ...overrides,
  }
}

describe('AP GST snapshots', () => {
  test('uses the effective Singapore input-tax code for a standard-rated purchase', async () => {
    await expect(apInvoiceService.resolveTaxSnapshot('2026-07-01', 'standard_rated')).resolves.toEqual({
      gst_rate_id: 3,
      gst_rate_percent: 9,
      gst_effective_date: '2026-07-01',
      xero_tax_type: 'INPUTY24',
    })
  })

  test('keeps purchases from a non-GST registered supplier at zero tax', async () => {
    const snapshot = await apInvoiceService.resolveTaxSnapshot('2026-07-01', 'non_gst')
    expect(snapshot).toMatchObject({ gst_rate_percent: 0, xero_tax_type: 'NRINPUT' })
    expect(gstService.findApplicableRate).not.toHaveBeenCalled()
  })
})

describe('AP approval controls', () => {
  test('accepts a reconciled and fully coded invoice', async () => {
    await expect(apInvoiceService.validateForApproval(validInvoice())).resolves.toEqual({
      can_approve: true,
      issues: [],
      requires_low_confidence_confirmation: false,
    })
  })

  test('blocks a GST mismatch and a line/subtotal mismatch', async () => {
    const result = await apInvoiceService.validateForApproval(validInvoice({
      subtotal_excluding_gst: 110,
      gst_amount: 7,
      total_including_gst: 117,
      verified_total: 115.91,
    }))
    expect(result.can_approve).toBe(false)
    expect(result.issues.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      'LINE_TOTAL_MISMATCH',
      'GST_AMOUNT_MISMATCH',
    ]))
  })

  test('requires a human confirmation for low-confidence OCR without discarding valid edits', async () => {
    const result = await apInvoiceService.validateForApproval(validInvoice({ is_low_confidence: true }))
    expect(result.can_approve).toBe(true)
    expect(result.requires_low_confidence_confirmation).toBe(true)
  })
})
