const { calculateRebate } = require('../../src/controllers/vendorInvoiceController')
const { xeroService } = require('../../src/services')

describe('calculateRebate (UC-05)', () => {
  test('applies the default 1% rebate', () => {
    const { rebateAmount, verifiedTotal } = calculateRebate(1840.00, 1.00)
    expect(rebateAmount).toBe(18.40)
    expect(verifiedTotal).toBe(1821.60)
  })

  test('applies a custom rebate percentage', () => {
    const { rebateAmount, verifiedTotal } = calculateRebate(1000.00, 2.5)
    expect(rebateAmount).toBe(25.00)
    expect(verifiedTotal).toBe(975.00)
  })

  test('returns nulls when extracted_total is not yet known', () => {
    const { rebateAmount, verifiedTotal } = calculateRebate(null, 1.00)
    expect(rebateAmount).toBeNull()
    expect(verifiedTotal).toBeNull()
  })

  test('rounds to 2 decimal places', () => {
    const { rebateAmount } = calculateRebate(99.99, 1.00)
    expect(rebateAmount).toBe(1.00)
  })
})

describe('xeroService.getAuthorizationUrl (UC-01)', () => {
  const ORIGINAL_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...ORIGINAL_ENV }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  test('throws XERO_CONFIG_MISSING when client_id/redirect_uri are absent', () => {
    delete process.env.XERO_CLIENT_ID
    delete process.env.XERO_REDIRECT_URI

    expect(() => xeroService.getAuthorizationUrl()).toThrow()
    try {
      xeroService.getAuthorizationUrl()
    } catch (err) {
      expect(err.code).toBe('XERO_CONFIG_MISSING')
    }
  })

  test('builds a valid Xero authorisation URL with the required scopes', () => {
    process.env.XERO_CLIENT_ID = 'test-client-id'
    process.env.XERO_REDIRECT_URI = 'http://localhost:3000/api/xero/callback'

    const { authUrl, state } = xeroService.getAuthorizationUrl()
    const url = new URL(authUrl)

    expect(url.origin + url.pathname).toBe('https://login.xero.com/identity/connect/authorize')
    expect(url.searchParams.get('client_id')).toBe('test-client-id')
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3000/api/xero/callback')
    expect(url.searchParams.get('scope')).toContain('accounting.transactions')
    expect(url.searchParams.get('state')).toBe(state)
    expect(state).toHaveLength(32) // 16 bytes as hex
  })

  test('generates a fresh state token on every call (CSRF protection)', () => {
    process.env.XERO_CLIENT_ID = 'test-client-id'
    process.env.XERO_REDIRECT_URI = 'http://localhost:3000/api/xero/callback'

    const first = xeroService.getAuthorizationUrl()
    const second = xeroService.getAuthorizationUrl()
    expect(first.state).not.toBe(second.state)
  })
})
