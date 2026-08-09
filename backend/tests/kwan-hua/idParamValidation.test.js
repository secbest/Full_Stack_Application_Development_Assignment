// Regression guard for the AP/AR path-param id guards.
//
// Before these schemas existed, a non-numeric id (GET /api/invoices/abc) went straight
// into findByPk(), Postgres rejected the integer cast, and the SequelizeDatabaseError
// came back to the client as a 500 with a stack trace in the log. 14 AP/AR endpoints
// behaved this way. The id is client-supplied and malformed, so 400 is the correct
// answer; these tests pin that down at both the schema and middleware level.

const { idParamSchema, invoiceIdOnlyParamSchema, invoiceLineItemParamSchema } = require('../../src/validators')
const { validate } = require('../../src/middleware')

// Minimal Express double: records the status/body the middleware produced.
function fakeRes() {
  const res = { statusCode: null, body: null }
  res.status = (code) => { res.statusCode = code; return res }
  res.json = (payload) => { res.body = payload; return res }
  return res
}

async function run(schema, params) {
  const req = { params }
  const res = fakeRes()
  let nextCalled = false
  await validate(schema, 'params')(req, res, () => { nextCalled = true })
  return { req, res, nextCalled }
}

describe('idParamSchema', () => {
  test.each(['abc', 'undefined', 'null', '1abc', '', ' '])('rejects the non-numeric id %p', async (id) => {
    await expect(idParamSchema.validate({ id })).rejects.toThrow()
  })

  test.each(['0', '-1', '1.5'])('rejects the out-of-range id %p', async (id) => {
    await expect(idParamSchema.validate({ id })).rejects.toThrow()
  })

  test('accepts a positive integer and coerces it to a number', async () => {
    const value = await idParamSchema.validate({ id: '26' })
    expect(value.id).toBe(26)
  })
})

describe('invoiceLineItemParamSchema', () => {
  test('rejects a non-numeric itemId even when invoiceId is valid', async () => {
    await expect(invoiceLineItemParamSchema.validate({ invoiceId: '26', itemId: 'abc' })).rejects.toThrow()
  })

  test('rejects a non-numeric invoiceId even when itemId is valid', async () => {
    await expect(invoiceLineItemParamSchema.validate({ invoiceId: 'abc', itemId: '1' })).rejects.toThrow()
  })

  test('accepts and coerces both ids', async () => {
    const value = await invoiceLineItemParamSchema.validate({ invoiceId: '26', itemId: '43' })
    expect(value).toEqual({ invoiceId: 26, itemId: 43 })
  })
})

describe('invoiceIdOnlyParamSchema', () => {
  test('rejects a non-numeric invoiceId', async () => {
    await expect(invoiceIdOnlyParamSchema.validate({ invoiceId: 'abc' })).rejects.toThrow()
  })

  test('accepts and coerces a valid invoiceId', async () => {
    const value = await invoiceIdOnlyParamSchema.validate({ invoiceId: '7' })
    expect(value.invoiceId).toBe(7)
  })
})

describe('validate(schema, "params") middleware', () => {
  test('answers a malformed id with 400 VALIDATION_ERROR and never reaches the controller', async () => {
    const { res, nextCalled } = await run(idParamSchema, { id: 'abc' })

    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(res.body.errors[0].field).toBe('id')
  })

  test('passes a valid id through and hands the controller a numeric param', async () => {
    const { req, res, nextCalled } = await run(idParamSchema, { id: '26' })

    expect(nextCalled).toBe(true)
    expect(res.statusCode).toBeNull()
    expect(req.params.id).toBe(26)
  })

  test('reports both ids when a line-item route receives two bad params', async () => {
    const { res } = await run(invoiceLineItemParamSchema, { invoiceId: 'x', itemId: 'y' })

    expect(res.statusCode).toBe(400)
    expect(res.body.errors.map((e) => e.field).sort()).toEqual(['invoiceId', 'itemId'])
  })
})
