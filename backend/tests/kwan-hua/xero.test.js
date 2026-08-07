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
    // accounting.invoices is Xero's granular replacement for the retired broad
    // accounting.transactions scope, and is what grants creation of both the ACCREC sales
    // invoices and ACCPAY bills this platform pushes. Requesting the retired scope makes Xero
    // reject the whole authorize request with invalid_scope for any app registered after
    // 2 March 2026, so asserting the granular name here is the point of the test.
    const scope = url.searchParams.get('scope')
    expect(scope).toContain('accounting.invoices')
    expect(scope).not.toContain('accounting.transactions')
    expect(scope).toContain('accounting.contacts')
    expect(scope).toContain('accounting.settings.read')
    expect(scope).toContain('offline_access') // required for a refresh token
    expect(url.searchParams.get('state')).toBe(state)
    expect(state).toHaveLength(32) // 16 bytes as hex
  })

  test('XERO_SCOPES overrides the default set for an app still on the legacy broad scopes', () => {
    process.env.XERO_CLIENT_ID = 'test-client-id'
    process.env.XERO_REDIRECT_URI = 'http://localhost:3000/api/xero/callback'
    process.env.XERO_SCOPES = 'openid accounting.transactions offline_access'

    // The module reads XERO_SCOPES at load time, so re-require it in isolation.
    jest.resetModules()
    const reloaded = require('../../src/services/xeroService')
    const url = new URL(reloaded.getAuthorizationUrl().authUrl)

    expect(url.searchParams.get('scope')).toBe('openid accounting.transactions offline_access')
    delete process.env.XERO_SCOPES
    jest.resetModules()
  })

  test('generates a fresh state token on every call (CSRF protection)', () => {
    process.env.XERO_CLIENT_ID = 'test-client-id'
    process.env.XERO_REDIRECT_URI = 'http://localhost:3000/api/xero/callback'

    const first = xeroService.getAuthorizationUrl()
    const second = xeroService.getAuthorizationUrl()
    expect(first.state).not.toBe(second.state)
  })
})

describe('xeroService.consumeState (UC-01 CSRF)', () => {
  beforeEach(() => {
    process.env.XERO_CLIENT_ID = 'test-client-id'
    process.env.XERO_REDIRECT_URI = 'http://localhost:3000/api/xero/callback'
  })

  test('a freshly issued state validates exactly once', () => {
    const { state } = xeroService.getAuthorizationUrl()
    expect(xeroService.consumeState(state)).toBe(true)
    expect(xeroService.consumeState(state)).toBe(false) // single-use
  })

  test('an unknown or empty state is rejected', () => {
    expect(xeroService.consumeState('never-issued')).toBe(false)
    expect(xeroService.consumeState(undefined)).toBe(false)
  })
})

describe('xeroService.isSimulation', () => {
  const ORIGINAL_ENV = process.env
  beforeEach(() => { process.env = { ...ORIGINAL_ENV } })
  afterAll(() => { process.env = ORIGINAL_ENV })

  test('defaults to simulation when the flag is unset', () => {
    delete process.env.XERO_SIMULATION
    expect(xeroService.isSimulation()).toBe(true)
  })

  test('only XERO_SIMULATION="false" turns simulation off', () => {
    process.env.XERO_SIMULATION = 'false'
    expect(xeroService.isSimulation()).toBe(false)
    process.env.XERO_SIMULATION = 'true'
    expect(xeroService.isSimulation()).toBe(true)
  })
})

describe('xeroService.computeRetryAvailable (UC-08)', () => {
  test('failed + under the attempt cap + connected => retryable', () => {
    expect(xeroService.computeRetryAvailable({ status: 'failed', attempt_count: 1 }, true)).toBe(true)
  })
  test('not retryable once attempt_count hits the cap of 3', () => {
    expect(xeroService.computeRetryAvailable({ status: 'failed', attempt_count: 3 }, true)).toBe(false)
  })
  test('not retryable when Xero is disconnected', () => {
    expect(xeroService.computeRetryAvailable({ status: 'failed', attempt_count: 1 }, false)).toBe(false)
  })
  test('not retryable for a successful sync', () => {
    expect(xeroService.computeRetryAvailable({ status: 'success', attempt_count: 1 }, true)).toBe(false)
  })
})

describe('xeroService token encryption (AES-256-GCM)', () => {
  const ORIGINAL_ENV = process.env
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    process.env.XERO_ENCRYPTION_KEY = 'a'.repeat(64) // 32 bytes as hex
  })
  afterAll(() => { process.env = ORIGINAL_ENV })

  test('round-trips a token and does not store it in plaintext', () => {
    const secret = 'super-secret-refresh-token'
    const enc = xeroService.encryptToken(secret)
    expect(enc).not.toContain(secret)
    expect(enc.split(':')).toHaveLength(3) // iv:tag:ciphertext
    expect(xeroService.decryptToken(enc)).toBe(secret)
  })

  test('throws XERO_CONFIG_MISSING when the key is not a 64-char hex string', () => {
    process.env.XERO_ENCRYPTION_KEY = 'too-short'
    expect(() => xeroService.encryptToken('x')).toThrow()
    try {
      xeroService.encryptToken('x')
    } catch (err) {
      expect(err.code).toBe('XERO_CONFIG_MISSING')
    }
  })
})

describe('xeroService.pushBill (UC-07 simulation)', () => {
  const ORIGINAL_ENV = process.env
  beforeEach(() => { process.env = { ...ORIGINAL_ENV } })
  afterAll(() => { process.env = ORIGINAL_ENV })

  test('simulated push succeeds and returns a generated Xero record id', async () => {
    delete process.env.XERO_SIMULATION // default = simulate
    const result = await xeroService.pushBill(
      {
        id: 1,
        vendor_name: 'Esso',
        invoice_number: 'INV-1',
        due_date: '2026-07-31',
        currency_code: 'SGD',
        xero_account_code: '400',
        xero_tax_type: 'NRINPUT',
        gst_rate_percent: 0,
        subtotal_excluding_gst: 100,
        gst_amount: 0,
        total_including_gst: 100,
        rebate_percentage: 1,
        rebate_amount: 1,
        verified_total: 99,
        VendorInvoiceItems: [{ description: 'Fuel', quantity: 1, unit_price: 100, amount: 100 }],
      },
      { xero_tenant_id: 'demo', access_token: 'demo' }
    )
    expect(result.ok).toBe(true)
    expect(typeof result.xeroRecordId).toBe('string')
    expect(result.xeroRecordId.length).toBeGreaterThan(0)
  })

  test('simulated AR invoice push returns a Xero-style invoice id', async () => {
    delete process.env.XERO_SIMULATION
    const result = await xeroService.pushArInvoice(
      {
        id: 42, client_name: 'TTSH', subtotal: 850, gst_rate_percent: 9,
        tax_amount: 76.5, total_amount: 926.5, xero_tax_type: 'OUTPUT', InvoiceLineItems: [],
      },
      { xero_tenant_id: 'demo', access_token: 'demo' }
    )
    expect(result.ok).toBe(true)
    expect(result.xeroRecordId).toMatch(/^INV-XR-/)
  })
})

describe('xeroService.refreshTokens (UC-02)', () => {
  const ORIGINAL_ENV = process.env
  beforeEach(() => { process.env = { ...ORIGINAL_ENV } })
  afterAll(() => { process.env = ORIGINAL_ENV })

  test('simulation mode returns a fresh rotated token pair without calling Xero', async () => {
    delete process.env.XERO_SIMULATION
    const tokens = await xeroService.refreshTokens('sim-refresh-old')
    expect(tokens.accessToken).toMatch(/^sim-access-/)
    expect(tokens.refreshToken).toMatch(/^sim-refresh-/)
    expect(tokens.expiresIn).toBeGreaterThan(0)
  })

  test('real mode throws XERO_CONFIG_MISSING when client credentials are absent', async () => {
    process.env.XERO_SIMULATION = 'false'
    delete process.env.XERO_CLIENT_ID
    delete process.env.XERO_CLIENT_SECRET
    await expect(xeroService.refreshTokens('x')).rejects.toMatchObject({ code: 'XERO_CONFIG_MISSING' })
  })
})
