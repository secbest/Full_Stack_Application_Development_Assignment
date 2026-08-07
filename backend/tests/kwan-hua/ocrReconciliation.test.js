// ocrService.reconcile - the part of the OCR pipeline that does NOT take the model's word
// for anything.
//
// is_low_confidence used to rest solely on a `confidence` number Gemini reported about
// itself. LLM self-reported confidence is not calibrated, so it was a poor sole gate on
// whether a human ever looks at a vendor invoice - and nothing anywhere checked the single
// most standard AP control: that the extracted line items actually sum to the extracted
// invoice total.
const { reconcile, repairMissingGstAmount, CONFIDENCE_THRESHOLD } = require('../../src/services/ocrService')

// A clean extraction: three items summing exactly to the stated total.
function goodExtraction(overrides = {}) {
  return {
    vendor_name: 'Medisupply Pte Ltd',
    invoice_number: 'MS-2026-0412',
    invoice_date: '2026-07-14',
    extracted_total: 1080,
    confidence: 0.94,
    items: [
      { description: 'Oxygen cylinder refill', quantity: 4, unit_price: 120, amount: 480 },
      { description: 'Disposable kits', quantity: 20, unit_price: 25, amount: 500 },
      { description: 'Delivery', quantity: 1, unit_price: 100, amount: 100 },
    ],
    ...overrides,
  }
}

function checkFor(result, name) {
  return result.checks.find((c) => c.check === name)
}

describe('repairMissingGstAmount', () => {
  test('derives a missing 9% GST amount from a printed subtotal and total, then flags it for review', () => {
    const repaired = repairMissingGstAmount({
      subtotal_excluding_gst: 1343,
      gst_amount: 0,
      gst_rate_percent: 0,
      total_including_gst: 1463.87,
    })

    expect(repaired).toMatchObject({
      gst_amount: 120.87,
      gst_rate_percent: 9,
      gst_amount_inferred_from_totals: true,
    })
    expect(reconcile({ ...goodExtraction(), ...repaired, extracted_total: 1463.87, items: [
      { description: 'Masks', amount: 1343 },
    ] }).isLowConfidence).toBe(true)
  })

  test('does not guess tax for a difference that is not a Singapore GST rate', () => {
    const original = {
      subtotal_excluding_gst: 100,
      gst_amount: 0,
      total_including_gst: 110,
    }
    expect(repairMissingGstAmount(original)).toBe(original)
  })
})

describe('reconcile - the arithmetic control', () => {
  test('a fully consistent extraction reconciles and keeps the model confidence', () => {
    const result = reconcile(goodExtraction())
    expect(result.reconciles).toBe(true)
    expect(result.itemsSum).toBe(1080)
    expect(result.discrepancy).toBe(0)
    expect(result.confidence).toBe(0.94)
    expect(result.isLowConfidence).toBe(false)
  })

  // The core finding: items summing to 980 against a stated total of 1080 used to flow
  // straight through to verified_total, the rebate, and Xero, unchallenged.
  test('catches line items that do not sum to the stated invoice total', () => {
    const result = reconcile(goodExtraction({ extracted_total: 1080, items: [
      { description: 'Oxygen cylinder refill', quantity: 4, unit_price: 120, amount: 480 },
      { description: 'Disposable kits', quantity: 20, unit_price: 25, amount: 500 },
    ] }))

    expect(result.reconciles).toBe(false)
    expect(result.itemsSum).toBe(980)
    expect(result.discrepancy).toBe(100)
    expect(result.isLowConfidence).toBe(true)
    expect(checkFor(result, 'items_sum_matches_total').passed).toBe(false)
    expect(checkFor(result, 'items_sum_matches_total').detail).toContain('980.00')
    expect(checkFor(result, 'items_sum_matches_total').detail).toContain('1080.00')
  })

  test('tolerates a single rounding cent between the items and the total', () => {
    const result = reconcile(goodExtraction({ extracted_total: 1080.01 }))
    expect(result.reconciles).toBe(true)
    expect(checkFor(result, 'items_sum_matches_total').passed).toBe(true)
  })

  test('catches a line whose amount does not match quantity x unit price', () => {
    const result = reconcile(goodExtraction({
      extracted_total: 999,
      items: [{ description: 'Fuel', quantity: 2, unit_price: 10, amount: 999 }],
    }))
    expect(checkFor(result, 'line_arithmetic').passed).toBe(false)
    expect(result.reconciles).toBe(false)
  })

  test('does not fault a line when the model gave no quantity or unit price to check against', () => {
    // Some invoices print only a description and an amount. That is not an error.
    const result = reconcile({
      vendor_name: 'V', invoice_number: 'N', invoice_date: '2026-07-14',
      extracted_total: 300, confidence: 0.9,
      items: [{ description: 'Consultancy', amount: 300 }],
    })
    expect(checkFor(result, 'line_arithmetic').passed).toBe(true)
    expect(result.reconciles).toBe(true)
  })

  test('flags an extraction with no line items at all', () => {
    const result = reconcile(goodExtraction({ items: [] }))
    expect(checkFor(result, 'items_present').passed).toBe(false)
    expect(result.reconciles).toBe(false)
    expect(result.isLowConfidence).toBe(true)
  })

  test('flags a missing or unusable invoice date', () => {
    expect(checkFor(reconcile(goodExtraction({ invoice_date: '' })), 'invoice_date_present').passed).toBe(false)
    expect(checkFor(reconcile(goodExtraction({ invoice_date: 'July 2026' })), 'invoice_date_present').passed).toBe(false)
    expect(checkFor(reconcile(goodExtraction()), 'invoice_date_present').passed).toBe(true)
  })
})

describe('reconcile - confidence can be lowered by facts but never raised by the model', () => {
  // The whole point: a document cannot talk its way past arithmetic. Even a model
  // asserting total certainty is capped once a check fails.
  test('caps confidence when a check fails, however confident the model claims to be', () => {
    const result = reconcile(goodExtraction({
      confidence: 1,
      extracted_total: 5000, // does not match the 1080 of items
    }))
    expect(result.confidence).toBeLessThanOrEqual(0.5)
    expect(result.isLowConfidence).toBe(true)
  })

  test('a low self-reported confidence still flags an otherwise consistent invoice', () => {
    const result = reconcile(goodExtraction({ confidence: 0.4 }))
    expect(result.reconciles).toBe(true)
    expect(result.confidence).toBe(0.4)
    expect(result.confidence).toBeLessThan(CONFIDENCE_THRESHOLD)
    expect(result.isLowConfidence).toBe(true)
  })

  test('a missing confidence field does not silently become high confidence', () => {
    const clean = reconcile(goodExtraction({ confidence: undefined }))
    expect(clean.reconciles).toBe(true)
    expect(clean.confidence).toBe(1)

    const broken = reconcile(goodExtraction({ confidence: undefined, extracted_total: 99 }))
    expect(broken.isLowConfidence).toBe(true)
  })

  test('every check carries a human-readable detail for the review screen', () => {
    for (const check of reconcile(goodExtraction({ extracted_total: 1 })).checks) {
      expect(typeof check.detail).toBe('string')
      expect(check.detail.length).toBeGreaterThan(0)
      expect(typeof check.passed).toBe('boolean')
    }
  })
})
