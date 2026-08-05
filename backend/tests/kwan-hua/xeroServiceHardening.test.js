// xeroService hardening: simulation-mode visibility, CSRF state expiry, and the AR payload
// identity fields.
const xeroService = require('../../src/services/xeroService')

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  jest.restoreAllMocks()
})

describe('simulation mode is stated, not implied', () => {
  // Simulation is the DEFAULT and is disabled only by the exact string 'false'. A deployment
  // with real credentials that forgets XERO_SIMULATION=false reports every sync as
  // successful while nothing reaches Xero - so the mode has to be visible.
  test('defaults to simulation when the flag is unset', () => {
    delete process.env.XERO_SIMULATION
    expect(xeroService.isSimulation()).toBe(true)
    expect(xeroService.describeMode()).toMatchObject({ simulated: true, label: 'SIMULATION' })
  })

  test('only the exact string "false" switches to live', () => {
    process.env.XERO_SIMULATION = 'false'
    expect(xeroService.describeMode()).toMatchObject({ simulated: false, label: 'LIVE' })

    // Anything else stays safely simulated rather than half-enabling a real integration.
    for (const value of ['0', 'no', 'FALSE', 'true', '']) {
      process.env.XERO_SIMULATION = value
      expect(xeroService.isSimulation()).toBe(true)
    }
  })

  test('describeMode explains the consequence, so a UI can warn rather than show all-green', () => {
    delete process.env.XERO_SIMULATION
    expect(xeroService.describeMode().detail).toMatch(/no data is sent to Xero/i)
  })

  test('logMode announces the mode at startup', () => {
    delete process.env.XERO_SIMULATION
    const log = jest.spyOn(console, 'log').mockImplementation(() => {})
    xeroService.logMode()
    expect(log).toHaveBeenCalledWith(expect.stringContaining('SIMULATION'))
  })
})

describe('OAuth CSRF state lifecycle', () => {
  function issueState() {
    process.env.XERO_CLIENT_ID = 'client-id'
    process.env.XERO_REDIRECT_URI = 'http://localhost:3000/api/xero/callback'
    return xeroService.getAuthorizationUrl().state
  }

  test('a freshly issued state is accepted exactly once', () => {
    const state = issueState()
    expect(xeroService.consumeState(state)).toBe(true)
    // Replay must fail: a state is single-use.
    expect(xeroService.consumeState(state)).toBe(false)
  })

  test('rejects a state that was never issued', () => {
    expect(xeroService.consumeState('never-issued')).toBe(false)
    expect(xeroService.consumeState(undefined)).toBe(false)
  })

  // Previously states were held in a Set that only shed an entry on a SUCCESSFUL callback,
  // so every abandoned consent screen leaked one forever and stayed valid indefinitely.
  test('a state past its TTL is rejected', () => {
    const state = issueState()
    const expired = Date.now() + xeroService.STATE_TTL_MS + 1000
    jest.spyOn(Date, 'now').mockReturnValue(expired)
    expect(xeroService.consumeState(state)).toBe(false)
  })

  test('the authorize URL requests the granular scopes and carries the state', () => {
    const state = issueState()
    const { authUrl } = xeroService.getAuthorizationUrl()
    expect(authUrl).toContain('accounting.invoices')
    expect(authUrl).toContain('offline_access')
    expect(authUrl).not.toContain('accounting.transactions')
    expect(typeof state).toBe('string')
  })

  test('throws a typed error when the client id or redirect uri is missing', () => {
    delete process.env.XERO_CLIENT_ID
    expect(() => xeroService.getAuthorizationUrl()).toThrow(/not configured/i)
  })
})

describe('pushArInvoice carries the invoice identity into Xero', () => {
  // Runs against the live code path (simulation returns a stub before building a payload),
  // with fetch stubbed so nothing leaves the process.
  function stubXeroOk() {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ Invoices: [{ InvoiceID: 'xero-uuid-1' }] }),
    })
    global.fetch = fetchMock
    return fetchMock
  }

  function connection() {
    // AES-256-GCM needs a 32-byte key as 64 hex chars.
    process.env.XERO_ENCRYPTION_KEY = 'a'.repeat(64)
    return { xero_tenant_id: 'tenant-1', access_token: xeroService.encryptToken('access-token') }
  }

  beforeEach(() => { process.env.XERO_SIMULATION = 'false' })

  function payloadFrom(fetchMock) {
    return JSON.parse(fetchMock.mock.calls[0][1].body).Invoices[0]
  }

  // Without these fields a synced sales invoice arrived Xero-auto-numbered and dated the
  // day of the push, with nothing tying it back to EFAR invoice #42 or the job it came from.
  test('sends a Reference naming the EFAR invoice and its booking', async () => {
    const fetchMock = stubXeroOk()
    const result = await xeroService.pushArInvoice(
      { id: 42, client_name: 'Jurong Shipyard', total_amount: 500, InvoiceLineItems: [], booking_reference: 'BK-2026-0031', service_date: '2026-07-14' },
      connection()
    )

    expect(result).toEqual({ ok: true, xeroRecordId: 'xero-uuid-1' })
    const sent = payloadFrom(fetchMock)
    expect(sent.Reference).toBe('EFAR Invoice #42 / Booking BK-2026-0031')
    expect(sent.Date).toBe('2026-07-14')
    expect(sent.Type).toBe('ACCREC')
    expect(sent.Status).toBe('DRAFT')
    expect(sent.Contact).toEqual({ Name: 'Jurong Shipyard' })
  })

  test('still sends a usable Reference when the invoice has no linked booking', async () => {
    const fetchMock = stubXeroOk()
    await xeroService.pushArInvoice({ id: 7, client_name: 'Acme', total_amount: 100, InvoiceLineItems: [] }, connection())
    const sent = payloadFrom(fetchMock)
    expect(sent.Reference).toBe('EFAR Invoice #7')
    expect(sent.Date).toBeUndefined()
  })

  test('never throws on a Xero rejection - it reports the error for the sync log', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ Elements: [{ ValidationErrors: [{ Message: 'Contact name is required' }] }] }),
    })
    const result = await xeroService.pushArInvoice({ id: 9, total_amount: 10, InvoiceLineItems: [] }, connection())
    expect(result).toEqual({ ok: false, error: 'Contact name is required' })
  })
})
