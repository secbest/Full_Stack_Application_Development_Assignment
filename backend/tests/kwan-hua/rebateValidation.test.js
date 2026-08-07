// The vendor-invoice PATCH schemas.
//
// PATCH /api/vendor-invoices/:id used to read req.body directly - the only route in the AP
// area with no schema. Its single downstream guard rejected a NEGATIVE verified_total, which
// a negative rebate_percentage can never trigger because it makes verified_total LARGER.
// These tests pin the arithmetic that made that a money bug, then the bounds that stop it.
const { vendorInvoiceUpdateSchema, vendorInvoiceItemCreateSchema, vendorInvoiceItemUpdateSchema } = require('../../src/validators')
const { calculateRebate } = require('../../src/controllers/vendorInvoiceController')

async function validationErrors(schema, body) {
  try {
    await schema.validate(body, { abortEarly: false, stripUnknown: true })
    return null
  } catch (err) {
    return err.errors
  }
}

describe('calculateRebate - why the bounds matter', () => {
  test('a normal rebate reduces what EFAR pays', () => {
    expect(calculateRebate(1000, 50)).toEqual({ rebateAmount: 500, verifiedTotal: 500 })
    expect(calculateRebate(1000, 1)).toEqual({ rebateAmount: 10, verifiedTotal: 990 })
  })

  // This is the bug the schema now prevents: unbounded, a -50% "rebate" turns a $1,000
  // invoice into a $1,500 payable, and the negative-verified_total guard never fires
  // because 1500 is positive.
  test('a negative percentage would INFLATE the payable past the invoice total', () => {
    const { rebateAmount, verifiedTotal } = calculateRebate(1000, -50)
    expect(rebateAmount).toBe(-500)
    expect(verifiedTotal).toBe(1500)
    expect(verifiedTotal).toBeGreaterThan(1000)
    expect(verifiedTotal).toBeGreaterThan(0) // so a "verifiedTotal < 0" check cannot catch it
  })

  test('a non-numeric percentage produces NaN rather than a value', () => {
    const { rebateAmount } = calculateRebate(1000, Number('abc'))
    expect(rebateAmount).toBeNaN()
  })

  test('defers cleanly when there is no extracted total yet', () => {
    expect(calculateRebate(null, 5)).toEqual({ rebateAmount: null, verifiedTotal: null })
  })
})

describe('vendorInvoiceUpdateSchema', () => {
  test('rejects a negative rebate_percentage', async () => {
    const errors = await validationErrors(vendorInvoiceUpdateSchema, { rebate_percentage: -50 })
    expect(errors).toContain('rebate_percentage cannot be negative')
  })

  test('rejects a rebate_percentage above 100', async () => {
    const errors = await validationErrors(vendorInvoiceUpdateSchema, { rebate_percentage: 150 })
    expect(errors).toContain('rebate_percentage cannot exceed 100')
  })

  test('rejects a non-numeric rebate_percentage before it can reach a DECIMAL column as NaN', async () => {
    expect(await validationErrors(vendorInvoiceUpdateSchema, { rebate_percentage: 'abc' })).not.toBeNull()
  })

  test('rejects a zero or negative extracted_total', async () => {
    expect(await validationErrors(vendorInvoiceUpdateSchema, { extracted_total: 0 })).toContain('extracted_total must be a positive number')
    expect(await validationErrors(vendorInvoiceUpdateSchema, { extracted_total: -5 })).toContain('extracted_total must be a positive number')
  })

  test('rejects a blank vendor_name or invoice_number', async () => {
    expect(await validationErrors(vendorInvoiceUpdateSchema, { vendor_name: '   ' })).toContain('vendor_name cannot be blank')
    expect(await validationErrors(vendorInvoiceUpdateSchema, { invoice_number: '' })).toContain('invoice_number cannot be blank')
  })

  test('rejects a malformed invoice_date', async () => {
    expect(await validationErrors(vendorInvoiceUpdateSchema, { invoice_date: '14/07/2026' })).toContain('invoice_date must be in YYYY-MM-DD format')
  })

  test('accepts the boundary values 0 and 100', async () => {
    expect(await validationErrors(vendorInvoiceUpdateSchema, { rebate_percentage: 0 })).toBeNull()
    expect(await validationErrors(vendorInvoiceUpdateSchema, { rebate_percentage: 100 })).toBeNull()
  })

  test('is a partial update - a single field is valid on its own, and an empty body is a no-op', async () => {
    expect(await validationErrors(vendorInvoiceUpdateSchema, { vendor_name: 'Medisupply' })).toBeNull()
    expect(await validationErrors(vendorInvoiceUpdateSchema, {})).toBeNull()
  })
})

describe('vendorInvoiceItemUpdateSchema', () => {
  // `amount` is derived server-side from quantity x unit_price, so accepting it from the
  // client is exactly the hole that let a line item claim a total its figures did not
  // support. stripUnknown must therefore drop it.
  test('strips any client-supplied amount instead of honouring it', async () => {
    const cleaned = await vendorInvoiceItemUpdateSchema.validate(
      { quantity: 2, unit_price: 10, amount: 999 },
      { abortEarly: false, stripUnknown: true }
    )
    expect(cleaned.amount).toBeUndefined()
    expect(cleaned).toEqual({ quantity: 2, unit_price: 10 })
  })

  test('rejects a non-positive quantity', async () => {
    expect(await validationErrors(vendorInvoiceItemUpdateSchema, { quantity: 0 })).toContain('quantity must be a positive number')
    expect(await validationErrors(vendorInvoiceItemUpdateSchema, { quantity: -1 })).toContain('quantity must be a positive number')
  })

  test('rejects a negative unit_price but allows a genuine zero-cost line', async () => {
    expect(await validationErrors(vendorInvoiceItemUpdateSchema, { unit_price: -1 })).toContain('unit_price cannot be negative')
    expect(await validationErrors(vendorInvoiceItemUpdateSchema, { unit_price: 0 })).toBeNull()
  })

  test('rejects non-numeric figures', async () => {
    expect(await validationErrors(vendorInvoiceItemUpdateSchema, { quantity: 'two' })).not.toBeNull()
    expect(await validationErrors(vendorInvoiceItemUpdateSchema, { unit_price: 'ten' })).not.toBeNull()
  })
})

describe('vendorInvoiceItemCreateSchema', () => {
  test('requires every editable line field', async () => {
    const errors = await validationErrors(vendorInvoiceItemCreateSchema, {})

    expect(errors).toEqual(expect.arrayContaining([
      'description is required',
      'quantity is required',
      'unit_price is required',
    ]))
  })

  test('accepts a valid zero-cost line and strips a client-supplied amount', async () => {
    const cleaned = await vendorInvoiceItemCreateSchema.validate(
      { description: 'Complimentary item', quantity: 1, unit_price: 0, amount: 999 },
      { abortEarly: false, stripUnknown: true }
    )

    expect(cleaned).toEqual({ description: 'Complimentary item', quantity: 1, unit_price: 0 })
  })
})
