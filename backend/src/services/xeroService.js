const crypto = require('crypto')

// UC-01/UC-07/UC-08: Xero OAuth2 + bill sync service.
//
// SIMULATION MODE (default): the whole AP → Xero flow is demoable without live
// Xero credentials. Token exchange, org lookup and bill creation are simulated
// with generated identifiers so `npm start` + the seed data exercise every screen.
// Set XERO_SIMULATION=false (and provide real XERO_CLIENT_ID/SECRET/REDIRECT_URI
// + XERO_ENCRYPTION_KEY) to hit the real Xero API instead.

const XERO_AUTH_BASE = 'https://login.xero.com/identity/connect/authorize'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'
const XERO_BILLS_URL = 'https://api.xero.com/api.xro/2.0/Invoices'
// Scopes requested at authorize time.
//
// Xero replaced its broad scopes with granular ones: apps registered after 2 March 2026 are
// only granted the new set, and apps registered before it keep the broad set until September
// 2027. `accounting.transactions` therefore no longer exists for a newly created app, and
// because Xero rejects the ENTIRE authorize request with `invalid_scope` when any one scope is
// unavailable, requesting it fails before the consent screen even renders - which presents as
// a broken authorize link rather than a scope problem.
//
// accounting.invoices is the granular replacement covering the ACCREC sales invoices and
// ACCPAY bills this platform creates; accounting.contacts is needed because both pushes
// identify the client/vendor by Contact name. offline_access yields the refresh token.
//
// Overridable via XERO_SCOPES for an app still on the legacy broad scopes, which would need
// 'openid profile email accounting.transactions accounting.contacts offline_access'.
const DEFAULT_SCOPES = 'openid profile email accounting.invoices accounting.contacts offline_access'
const SCOPES = process.env.XERO_SCOPES || DEFAULT_SCOPES

// attempt_count >= this disables the retry button in the sync status panel (UC-08).
const MAX_SYNC_ATTEMPTS = 3

// In-memory CSRF state store, state -> issued-at epoch ms. Sufficient for a
// single-instance dev/POC server. Production should persist state in a signed cookie or a
// shared store (e.g. Redis) so it survives restarts and works across multiple instances.
//
// Entries expire: previously this was a Set that only ever shed a state on a SUCCESSFUL
// callback, so every abandoned authorize click (user closes the Xero consent tab) leaked
// one entry for the process lifetime, and a state stayed valid indefinitely.
const pendingStates = new Map()
const STATE_TTL_MS = 10 * 60 * 1000

function pruneStates(now = Date.now()) {
  for (const [state, issuedAt] of pendingStates) {
    if (now - issuedAt > STATE_TTL_MS) pendingStates.delete(state)
  }
}

// POC ships in simulation mode. Only real credentials + an explicit opt-out flip it.
function isSimulation() {
  return process.env.XERO_SIMULATION !== 'false'
}

// Logged once at startup and exposed via GET /api/xero/status.
//
// Simulation is the DEFAULT and is disabled only by the exact string 'false', so a
// deployment that supplies real Xero credentials but forgets XERO_SIMULATION=false will
// report every sync as successful while nothing whatsoever reaches Xero. A billing
// integration that silently no-ops is the worst failure mode available, so the mode is
// stated out loud rather than left implicit.
function describeMode() {
  const simulated = isSimulation()
  return {
    simulated,
    label: simulated ? 'SIMULATION' : 'LIVE',
    detail: simulated
      ? 'Xero calls are simulated - no data is sent to Xero. Set XERO_SIMULATION=false with real credentials to go live.'
      : 'Connected to the live Xero API.',
  }
}

function logMode() {
  const mode = describeMode()
  const banner = mode.simulated
    ? '[xero] MODE: SIMULATION - Xero pushes are faked and nothing reaches Xero. Set XERO_SIMULATION=false to go live.'
    : '[xero] MODE: LIVE - pushes go to the real Xero API.'
  console.log(banner)
  return mode
}

// UC-08 rule, extracted as a pure function so it can be unit-tested and reused
// by both the sync-logs list and the retry endpoint.
function computeRetryAvailable(log, xeroConnected) {
  return log.status === 'failed' && log.attempt_count < MAX_SYNC_ATTEMPTS && xeroConnected
}

// Builds the Xero OAuth2 authorisation URL with a fresh CSRF state token and
// registers that state so the /callback handler can verify it later (UC-01 step 3).
function getAuthorizationUrl() {
  const { XERO_CLIENT_ID, XERO_REDIRECT_URI } = process.env
  if (!XERO_CLIENT_ID || !XERO_REDIRECT_URI) {
    const err = new Error('Xero client_id or redirect_uri not configured in environment')
    err.code = 'XERO_CONFIG_MISSING'
    throw err
  }

  const state = crypto.randomBytes(16).toString('hex')
  pruneStates()
  pendingStates.set(state, Date.now())
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: XERO_CLIENT_ID,
    redirect_uri: XERO_REDIRECT_URI,
    scope: SCOPES,
    state,
  })

  return { authUrl: `${XERO_AUTH_BASE}?${params.toString()}`, state }
}

// Verifies and consumes a CSRF state token (single-use). Returns false if the
// state was never issued or has already been used - the caller redirects with
// ?error=invalid_state in that case.
function consumeState(state) {
  pruneStates()
  if (!state || !pendingStates.has(state)) return false
  // Single-use even if expired-and-pruned above would have caught it: delete regardless.
  const issuedAt = pendingStates.get(state)
  pendingStates.delete(state)
  return Date.now() - issuedAt <= STATE_TTL_MS
}

// ─── Token encryption (AES-256-GCM) ─────────────────────────────────────────
// access_token/refresh_token are encrypted before being written to
// xero_connections and are never returned in any API response.

function getEncryptionKey() {
  const hex = process.env.XERO_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) {
    const err = new Error('XERO_ENCRYPTION_KEY must be a 64-character (32-byte) hex string.')
    err.code = 'XERO_CONFIG_MISSING'
    throw err
  }
  return Buffer.from(hex, 'hex')
}

function encryptToken(plain) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':')
}

function decryptToken(payload) {
  const [ivHex, tagHex, dataHex] = String(payload).split(':')
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8')
}

// ─── OAuth2 token exchange (UC-01 steps 5-7) ────────────────────────────────

async function exchangeCodeForTokens(code) {
  if (isSimulation()) {
    return {
      accessToken: `sim-access-${crypto.randomBytes(8).toString('hex')}`,
      refreshToken: `sim-refresh-${crypto.randomBytes(8).toString('hex')}`,
      expiresIn: 1800,
    }
  }

  const { XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI } = process.env
  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET || !XERO_REDIRECT_URI) {
    const err = new Error('Xero client_id, client_secret or redirect_uri not configured.')
    err.code = 'XERO_CONFIG_MISSING'
    throw err
  }

  const basic = Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64')
  const resp = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: XERO_REDIRECT_URI }),
  })
  if (!resp.ok) throw new Error(`Xero token exchange failed (${resp.status})`)
  const json = await resp.json()
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresIn: json.expires_in }
}

// Refreshes an expired access token using the stored refresh token (UC-02).
// Xero rotates the refresh token on every use, so the caller MUST persist both
// the new access AND refresh tokens. Returns the same shape as the initial exchange.
async function refreshTokens(refreshTokenPlain) {
  if (isSimulation()) {
    return {
      accessToken: `sim-access-${crypto.randomBytes(8).toString('hex')}`,
      refreshToken: `sim-refresh-${crypto.randomBytes(8).toString('hex')}`,
      expiresIn: 1800,
    }
  }

  const { XERO_CLIENT_ID, XERO_CLIENT_SECRET } = process.env
  if (!XERO_CLIENT_ID || !XERO_CLIENT_SECRET) {
    const err = new Error('Xero client_id or client_secret not configured.')
    err.code = 'XERO_CONFIG_MISSING'
    throw err
  }

  const basic = Buffer.from(`${XERO_CLIENT_ID}:${XERO_CLIENT_SECRET}`).toString('base64')
  const resp = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshTokenPlain }),
  })
  if (!resp.ok) throw new Error(`Xero token refresh failed (${resp.status})`)
  const json = await resp.json()
  return { accessToken: json.access_token, refreshToken: json.refresh_token, expiresIn: json.expires_in }
}

// Adds an AccountCode to each line item when one is configured. Xero draft invoices
// can be created without account codes, but supplying them lets the bill/invoice be
// approved in Xero without further edits.
function withAccountCode(lineItems, accountCode) {
  if (!accountCode) return lineItems
  return lineItems.map((li) => ({ ...li, AccountCode: accountCode }))
}

// Resolves the connected tenant id + organisation name after token exchange.
//
// Returns `availableOrgs` alongside the chosen one. Where the authorising login has access
// to more than one Xero organisation, taking tenants[0] silently is a real hazard - an
// accountant who books for several companies could have EFAR's invoices pushed into
// another client's ledger with no indication it happened. The first org is still selected
// so the flow completes, but the alternatives are surfaced (logged here, and returned so
// the settings screen can show which org was picked and offer to switch).
async function fetchOrganisation(accessToken) {
  if (isSimulation()) {
    return {
      tenantId: 'demo-tenant-efar-2026',
      orgName: 'Emergencies First Aid & Rescue Pte Ltd',
      availableOrgs: [{ tenantId: 'demo-tenant-efar-2026', orgName: 'Emergencies First Aid & Rescue Pte Ltd' }],
    }
  }
  const resp = await fetch(XERO_CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  })
  if (!resp.ok) throw new Error(`Xero connections lookup failed (${resp.status})`)
  const tenants = await resp.json()
  if (!Array.isArray(tenants) || tenants.length === 0) throw new Error('No Xero organisation is linked to this login.')

  const availableOrgs = tenants.map((t) => ({ tenantId: t.tenantId, orgName: t.tenantName }))
  if (availableOrgs.length > 1) {
    console.warn(
      `[xero] This login has access to ${availableOrgs.length} Xero organisations: ${availableOrgs.map((o) => o.orgName).join(', ')}. ` +
      `Connecting to "${availableOrgs[0].orgName}". Verify this is the intended organisation on the Xero settings screen before syncing.`
    )
  }
  return { tenantId: availableOrgs[0].tenantId, orgName: availableOrgs[0].orgName, availableOrgs }
}

// ─── Bill push (UC-07) ──────────────────────────────────────────────────────
// Pushes a vendor invoice to Xero as a DRAFT accounts-payable bill.
// Never throws: returns { ok, xeroRecordId } on success or { ok:false, error }
// on failure so the caller can persist the sync-log outcome uniformly.
async function pushBill(invoice, connection) {
  try {
    const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100
    const gstRate = Number(invoice.gst_rate_percent)
    const storedSubtotal = Number(invoice.subtotal_excluding_gst)
    const storedTax = Number(invoice.gst_amount)
    const storedTotal = Number(invoice.total_including_gst)
    const storedNet = Number(invoice.verified_total)
    const missingAmount = [
      invoice.gst_rate_percent,
      invoice.subtotal_excluding_gst,
      invoice.gst_amount,
      invoice.total_including_gst,
      invoice.verified_total,
    ].some((value) => value === null || value === undefined || value === '')
    if (!invoice.due_date || !invoice.xero_account_code || !invoice.xero_tax_type
      || missingAmount || ![gstRate, storedSubtotal, storedTax, storedTotal, storedNet].every(Number.isFinite)) {
      return {
        ok: false,
        error: 'AP accounting fields are incomplete. Set the due date, expense account, GST treatment, tax amounts, and net payable before syncing.',
      }
    }

    let lineItems = (invoice.VendorInvoiceItems || []).map((item) => ({
      Description: item.description,
      Quantity: Number(item.quantity),
      UnitAmount: Number(item.unit_price),
      AccountCode: invoice.xero_account_code,
      TaxType: invoice.xero_tax_type,
      TaxAmount: roundMoney(Number(item.amount || 0) * gstRate / 100),
    }))
    // Retry compatibility for invoices approved before line-level AP controls existed.
    // New approvals cannot reach this path without line items (validateForApproval blocks
    // them), but a historical failed sync must remain recoverable after the migration.
    if (!lineItems.length && storedSubtotal > 0) {
      lineItems = [{
        Description: invoice.vendor_name || 'Legacy vendor invoice',
        Quantity: 1,
        UnitAmount: storedSubtotal,
        AccountCode: invoice.xero_account_code,
        TaxType: invoice.xero_tax_type,
        TaxAmount: storedTax,
      }]
    }
    if (!lineItems.length) return { ok: false, error: 'At least one AP invoice line item is required before syncing.' }

    const calculatedSubtotal = roundMoney(lineItems.reduce(
      (sum, item) => sum + roundMoney(item.Quantity * item.UnitAmount), 0
    ))
    const calculatedTax = roundMoney(lineItems.reduce((sum, item) => sum + item.TaxAmount, 0))
    if (Math.abs(calculatedSubtotal - storedSubtotal) > 0.01 || Math.abs(calculatedTax - storedTax) > 0.01) {
      return {
        ok: false,
        error: `AP invoice totals are inconsistent: lines/tax calculate to ${calculatedSubtotal.toFixed(2)} + ${calculatedTax.toFixed(2)}, but the invoice stores ${storedSubtotal.toFixed(2)} + ${storedTax.toFixed(2)}.`,
      }
    }
    if (Math.abs(roundMoney(storedSubtotal + storedTax) - storedTotal) > 0.01) {
      return { ok: false, error: 'AP subtotal plus GST does not equal the stored total including GST.' }
    }

    const rebateAmount = roundMoney(Number(invoice.rebate_amount || 0))
    const items = [...lineItems]
    if (rebateAmount > 0) {
      // The EFAR rebate is a reduction after the supplier invoice's stated GST. Keeping
      // it as a no-tax negative line preserves the input GST printed on the source invoice
      // while making Xero's draft total equal EFAR's approved net payable.
      items.push({
        Description: `EFAR rebate (${Number(invoice.rebate_percentage || 0).toFixed(2)}%)`,
        Quantity: 1,
        UnitAmount: -rebateAmount,
        AccountCode: invoice.xero_account_code,
        TaxType: 'NONE',
        TaxAmount: 0,
      })
    }
    if (Math.abs(roundMoney(storedTotal - rebateAmount) - storedNet) > 0.01) {
      return { ok: false, error: 'AP net payable does not equal total including GST less rebate.' }
    }

    if (isSimulation()) return { ok: true, xeroRecordId: crypto.randomUUID() }

    const accessToken = decryptToken(connection.access_token)
    const payload = {
      Invoices: [{
        Type: 'ACCPAY',
        Contact: { Name: invoice.vendor_name },
        InvoiceNumber: invoice.invoice_number,
        Date: invoice.invoice_date || undefined,
        DueDate: invoice.due_date,
        CurrencyCode: invoice.currency_code || 'SGD',
        Reference: `EFAR AP #${invoice.id}`,
        LineItems: items,
        LineAmountTypes: 'Exclusive',
        Status: 'DRAFT',
      }],
    }

    const resp = await fetch(XERO_BILLS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Xero-tenant-id': connection.xero_tenant_id,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      const msg = json?.Elements?.[0]?.ValidationErrors?.[0]?.Message || json?.Message || `Xero returned ${resp.status}`
      return { ok: false, error: msg }
    }
    const validationMessage = json?.Invoices?.[0]?.ValidationErrors?.[0]?.Message
    if (validationMessage) return { ok: false, error: validationMessage }
    return { ok: true, xeroRecordId: json?.Invoices?.[0]?.InvoiceID || null }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// Pushes an AR invoice to Xero as an ACCREC (accounts-receivable) sales invoice.
// Same never-throws contract as pushBill. In simulation mode it returns a Xero-style
// invoice id (e.g. INV-XR-20260622-0042) so the AR sync flow is demoable offline.
async function pushArInvoice(invoice, connection) {
  try {
    const gstRate = Number(invoice.gst_rate_percent)
    const storedTax = Number(invoice.tax_amount)
    if (!Number.isFinite(gstRate) || !invoice.xero_tax_type || !Number.isFinite(storedTax)) {
      return {
        ok: false,
        error: 'GST configuration is missing from this invoice. Run the GST migration or regenerate the invoice before syncing.',
      }
    }

    const lineItems = (invoice.InvoiceLineItems || invoice.line_items || []).map((item) => ({
      Description: item.description,
      Quantity: Number(item.quantity),
      UnitAmount: Number(item.unit_price),
      TaxType: invoice.xero_tax_type,
      // EFAR freezes the invoice's GST at creation. Supplying the line tax prevents a
      // future Xero rate-table change from altering this historical draft on sync.
      TaxAmount: Math.round((Number(item.amount || 0) * gstRate / 100 + Number.EPSILON) * 100) / 100,
    }))
    const items = lineItems.length ? lineItems : [{
      Description: 'EFAR ambulance services',
      Quantity: 1,
      UnitAmount: Number(invoice.subtotal || 0),
      TaxType: invoice.xero_tax_type,
      TaxAmount: storedTax,
    }]
    const calculatedTax = Math.round((items.reduce((sum, item) => sum + Number(item.TaxAmount || 0), 0) + Number.EPSILON) * 100) / 100
    if (Math.abs(calculatedTax - storedTax) > 0.001) {
      return {
        ok: false,
        error: `Invoice GST is inconsistent: stored tax is ${storedTax.toFixed(2)} but its line items total ${calculatedTax.toFixed(2)}. Recalculate the invoice before syncing.`,
      }
    }

    // Simulation follows the same validation and tax calculations as live mode. Otherwise
    // a demo could report a successful sync for an invoice that live Xero would reject.
    if (isSimulation()) {
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const seq = String(invoice.id || 0).padStart(4, '0')
      return { ok: true, xeroRecordId: `INV-XR-${stamp}-${seq}` }
    }

    const accessToken = decryptToken(connection.access_token)
    const payload = {
      Invoices: [{
        Type: 'ACCREC',
        Contact: { Name: invoice.client_name || (invoice.Client && invoice.Client.name) || 'EFAR Client' },
        LineItems: withAccountCode(items, process.env.XERO_SALES_ACCOUNT_CODE),
        LineAmountTypes: 'Exclusive',
        // Reference and Date carry the invoice's identity into Xero. Without them a synced
        // sales invoice arrived Xero-auto-numbered and dated the day of the push, with
        // nothing linking it back to EFAR invoice #42 or the job it came from - so
        // reconciling Xero against this platform became a manual exercise, which is the
        // problem the platform exists to remove. pushBill already sent its equivalents.
        Reference: invoice.booking_reference
          ? `EFAR Invoice #${invoice.id} / Booking ${invoice.booking_reference}`
          : `EFAR Invoice #${invoice.id}`,
        // The date the service was delivered, not the date it happened to be synced.
        Date: invoice.service_date ? String(invoice.service_date).slice(0, 10) : undefined,
        Status: 'DRAFT',
      }],
    }
    const resp = await fetch(XERO_BILLS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Xero-tenant-id': connection.xero_tenant_id,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    })
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      const msg = json?.Elements?.[0]?.ValidationErrors?.[0]?.Message || json?.Message || `Xero returned ${resp.status}`
      return { ok: false, error: msg }
    }
    return { ok: true, xeroRecordId: json?.Invoices?.[0]?.InvoiceID || null }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

module.exports = {
  MAX_SYNC_ATTEMPTS,
  STATE_TTL_MS,
  isSimulation,
  describeMode,
  logMode,
  computeRetryAvailable,
  getAuthorizationUrl,
  consumeState,
  encryptToken,
  decryptToken,
  exchangeCodeForTokens,
  refreshTokens,
  fetchOrganisation,
  pushBill,
  pushArInvoice,
}
