const sequelize = require('../config')
const { XeroConnection, VendorInvoice, VendorInvoiceItem, Invoice, InvoiceLineItem, Client, Booking, User, XeroSyncLog } = require('../models')
const { xeroService } = require('../services')
const vendorInvoiceAuditService = require('../services/vendorInvoiceAuditService')
const notificationService = require('../services/notificationService')
const { success, error, notFound } = require('../utils')

async function resolveArSpecialistId() {
  try {
    const arSpecialist = await User.findOne({ where: { role: 'ar_specialist' } })
    return arSpecialist ? arSpecialist.id : null
  } catch (err) {
    console.error('[xeroController] Failed to resolve the AR Specialist fallback for a retry-failure notification:', err.message)
    return null
  }
}

// Single active Xero org at a time - the most recently connected row with is_connected = true.
async function getActiveConnection() {
  return XeroConnection.findOne({ where: { is_connected: true }, order: [['connected_at', 'DESC']] })
}

// Ensures the connection holds a non-expired access token before a Xero API call (UC-02).
// Real Xero access tokens live ~30 min; this proactively refreshes (and persists the rotated
// tokens) when within 60s of expiry. Returns the connection, or null if the refresh failed
// (refresh token revoked/expired) - callers treat null as "not connected" (503).
// No-op in simulation mode.
async function ensureFreshConnection(connection) {
  if (!connection) return null
  if (xeroService.isSimulation()) return connection

  const expiryMs = connection.token_expiry ? new Date(connection.token_expiry).getTime() : 0
  if (expiryMs - Date.now() > 60 * 1000) return connection // still valid

  try {
    const currentRefresh = xeroService.decryptToken(connection.refresh_token)
    const tokens = await xeroService.refreshTokens(currentRefresh)
    await connection.update({
      access_token: xeroService.encryptToken(tokens.accessToken),
      refresh_token: xeroService.encryptToken(tokens.refreshToken),
      token_expiry: new Date(Date.now() + (tokens.expiresIn || 1800) * 1000),
    })
    return connection
  } catch (err) {
    console.error('[xero] token refresh failed - marking connection inactive:', err.message)
    await connection.update({ is_connected: false })
    return null
  }
}

// Convenience: the active connection with a guaranteed-fresh token (or null).
async function getFreshConnection() {
  return ensureFreshConnection(await getActiveConnection())
}

// GET /api/xero/status - UC-01: current connection state for the settings page.
// Tokens are never included in the response.
async function status(req, res) {
  try {
    const conn = await getActiveConnection()
    // `mode` tells the settings screen whether pushes are real. In simulation every sync
    // reports success without contacting Xero, so a UI that cannot distinguish the two
    // would show a fully green integration that has never sent anything.
    const mode = xeroService.describeMode()
    if (!conn) {
      return success(res, {
        is_connected: false,
        xero_org_name: null,
        xero_tenant_id: null,
        connected_at: null,
        token_expiry: null,
        mode,
      })
    }
    return success(res, {
      is_connected: true,
      xero_org_name: conn.xero_org_name,
      xero_tenant_id: conn.xero_tenant_id,
      connected_at: conn.connected_at,
      token_expiry: conn.token_expiry,
      mode,
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// GET /api/xero/connect - UC-01 step 3: returns the Xero OAuth2 authorisation
// URL for the frontend to redirect the Managing Director to.
async function connect(req, res) {
  try {
    const { authUrl } = xeroService.getAuthorizationUrl()
    return success(res, { auth_url: authUrl })
  } catch (err) {
    if (err.code === 'XERO_CONFIG_MISSING') return error(res, err.message, 'XERO_CONFIG_MISSING', 500)
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// GET /api/xero/callback - UC-01 steps 5-7: Xero redirects here after the admin
// approves. No auth (called by Xero, not a logged-in session). Always redirects
// back to the frontend settings page with a success or error query flag.
async function callback(req, res) {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173'
  const redirect = (qs) => res.redirect(`${frontend}/settings/xero?${qs}`)
  const { code, state, error: xeroError } = req.query

  try {
    if (xeroError) return redirect('error=access_denied')
    if (!xeroService.consumeState(state)) return redirect('error=invalid_state')
    if (!code) return redirect('error=code_expired')

    const tokens = await xeroService.exchangeCodeForTokens(code)
    const org = await xeroService.fetchOrganisation(tokens.accessToken)
    const tokenExpiry = new Date(Date.now() + (tokens.expiresIn || 1800) * 1000)

    // Encrypt tokens before persisting when talking to the real Xero API.
    // In simulation mode the tokens are throwaway placeholders, so they are
    // stored as-is (matching the demo seed) and no encryption key is required.
    const sim = xeroService.isSimulation()
    const accessToken = sim ? tokens.accessToken : xeroService.encryptToken(tokens.accessToken)
    const refreshToken = sim ? tokens.refreshToken : xeroService.encryptToken(tokens.refreshToken)

    const payload = {
      xero_tenant_id: org.tenantId,
      xero_org_name: org.orgName,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expiry: tokenExpiry,
      is_connected: true,
      connected_at: new Date(),
    }

    // Only one org connected at a time - retire any previous connections first.
    await XeroConnection.update({ is_connected: false }, { where: { is_connected: true } })
    const existing = await XeroConnection.findOne({ where: { xero_tenant_id: org.tenantId } })
    if (existing) await existing.update(payload)
    else await XeroConnection.create(payload)

    return redirect('connected=true')
  } catch (err) {
    console.error('[xero/callback] Token exchange failed:', err.message)
    return redirect('error=token_exchange_failed')
  }
}

// DELETE /api/xero/disconnect - UC-01: marks the active connection inactive.
// The row is retained (is_connected = false) for audit purposes.
async function disconnect(req, res) {
  try {
    const conn = await getActiveConnection()
    if (!conn) return error(res, 'No active Xero connection found.', 'NOT_CONNECTED', 404)
    await conn.update({ is_connected: false })
    return success(res, { message: 'Xero disconnected successfully.' })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// GET /api/xero/expense-accounts - exposes only active accounts suitable for
// supplier bills. The access token remains server-side and is refreshed first.
async function expenseAccounts(req, res) {
  try {
    const conn = await getFreshConnection()
    if (!conn) {
      return error(
        res,
        'Xero is not connected. Ask the Managing Director to connect Xero before selecting an expense account.',
        'XERO_NOT_CONNECTED',
        503
      )
    }
    const accounts = await xeroService.listExpenseAccounts(conn)
    return success(res, { accounts, simulated: xeroService.isSimulation() })
  } catch (err) {
    return error(res, err.message, 'XERO_ACCOUNT_LOOKUP_FAILED', 502)
  }
}

// Resolves a human-readable reference for a sync log's polymorphic entity.
async function resolveEntityReference(log) {
  if (log.entity_type === 'vendor_invoice') {
    const vi = await VendorInvoice.findByPk(log.entity_id, { attributes: ['vendor_name', 'invoice_number'] })
    return vi ? `${vi.vendor_name} - ${vi.invoice_number}` : null
  }
  if (log.entity_type === 'ar_invoice') {
    // The Invoice model has no invoice_number column (unlike VendorInvoice) - the
    // client name + id is the only human-readable identifier it actually has.
    const inv = await Invoice.findByPk(log.entity_id, { include: [{ model: Client, attributes: ['name'] }] }).catch(() => null)
    return inv ? `${inv.Client ? inv.Client.name : 'Unknown Client'} - Invoice #${inv.id}` : null
  }
  return null
}

// GET /api/xero/sync-logs - UC-08: unified sync history across AP + AR.
async function listSyncLogs(req, res) {
  try {
    const { status: statusFilter, entity_type, page, limit } = req.query
    const where = {}
    if (statusFilter) where.status = statusFilter
    if (entity_type) where.entity_type = entity_type

    const offset = (page - 1) * limit
    const { rows, count } = await XeroSyncLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    })

    const conn = await getActiveConnection()
    const xeroConnected = !!conn

    const data = await Promise.all(rows.map(async (log) => ({
      id: log.id,
      entity_type: log.entity_type,
      entity_id: log.entity_id,
      entity_reference: await resolveEntityReference(log),
      xero_record_id: log.xero_record_id,
      status: log.status,
      attempt_count: log.attempt_count,
      error_message: log.error_message,
      synced_at: log.synced_at,
      created_at: log.createdAt,
      retry_available: xeroService.computeRetryAvailable(log, xeroConnected),
    })))

    return success(res, {
      data,
      pagination: { page, limit, total: count, total_pages: Math.ceil(count / limit) || 1 },
      xero_connected: xeroConnected,
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// POST /api/xero/sync-logs/:id/retry - UC-08 step 4: retry a failed sync.
async function retrySync(req, res) {
  try {
    // Claim the log row under a lock and flip it to `pending` before pushing. Xero does
    // not deduplicate, so two concurrent retries on the same log both used to read
    // status='failed' with the same attempt_count, both push, and create two records in
    // Xero for one entity. Moving the row out of `failed` inside the transaction means the
    // second request fails its own status check instead.
    let log
    try {
      log = await sequelize.transaction(async (t) => {
        const row = await XeroSyncLog.findByPk(req.params.id, { lock: t.LOCK.UPDATE, transaction: t })
        if (!row) throw Object.assign(new Error('Sync log entry not found.'), { httpCode: 404 })
        if (row.status !== 'failed') {
          throw Object.assign(new Error('Only failed sync log entries can be retried.'), { httpCode: 409, code: 'NOT_FAILED' })
        }
        if (row.attempt_count >= xeroService.MAX_SYNC_ATTEMPTS) {
          throw Object.assign(
            new Error('This sync has failed 3 or more times. Please contact support - this likely indicates a configuration issue in Xero.'),
            { httpCode: 409, code: 'RETRY_LIMIT_REACHED' }
          )
        }
        await row.update({ status: 'pending' }, { transaction: t })
        return row
      })
    } catch (err) {
      if (err.httpCode) return error(res, err.message, err.code || 'NOT_FOUND', err.httpCode)
      throw err
    }

    // Restores the log to `failed` when the retry cannot proceed, so the row does not
    // sit in `pending` forever (which no screen offers a way out of).
    const releaseClaim = (message) => log.update({ status: 'failed', error_message: message })

    const conn = await getFreshConnection()
    if (!conn) {
      await releaseClaim('Xero is not connected.')
      return error(res, 'Xero is not connected. Ask the Managing Director to reconnect before retrying.', 'XERO_NOT_CONNECTED', 503)
    }

    // Vendor invoices (AP) push as ACCPAY bills; AR invoices push as ACCREC sales
    // invoices - these are different Xero payload shapes (pushBill vs pushArInvoice),
    // so both branches need their real record, not just the vendor-invoice one.
    let vendorInvoice = null
    let arInvoice = null
    let result

    if (log.entity_type === 'vendor_invoice') {
      vendorInvoice = await VendorInvoice.findByPk(log.entity_id, { include: [{ model: VendorInvoiceItem }] })
      if (!vendorInvoice) {
        await releaseClaim('The vendor invoice for this sync log no longer exists.')
        return notFound(res, 'The vendor invoice for this sync log no longer exists.')
      }
      // Already in Xero: adopt that record instead of pushing a second bill for it. This
      // is the case where a previous attempt actually succeeded but the response was lost.
      if (vendorInvoice.xero_bill_id) {
        await log.update({ status: 'success', xero_record_id: vendorInvoice.xero_bill_id, error_message: null, synced_at: log.synced_at || new Date() })
        await vendorInvoice.update({ status: 'synced_to_xero' })
        await vendorInvoiceAuditService.record({
          invoiceId: vendorInvoice.id,
          userId: req.user?.sub || null,
          action: 'sync_adopted',
          note: `Existing Xero bill ${vendorInvoice.xero_bill_id} was adopted during retry.`,
        })
        return success(res, {
          id: log.id,
          status: 'success',
          attempt_count: log.attempt_count,
          xero_record_id: vendorInvoice.xero_bill_id,
          error_message: null,
          synced_at: log.synced_at,
          note: 'This invoice was already present in Xero - the existing record was adopted rather than creating a duplicate bill.',
        })
      }
      result = await xeroService.pushBill(vendorInvoice, conn)
    } else if (log.entity_type === 'ar_invoice') {
      arInvoice = await Invoice.findByPk(log.entity_id, {
        include: [{ model: InvoiceLineItem }, { model: Client, attributes: ['name'] }, { model: Booking, attributes: ['reference_number', 'scheduled_date'] }],
      })
      if (!arInvoice) {
        await releaseClaim('The AR invoice for this sync log no longer exists.')
        return notFound(res, 'The AR invoice for this sync log no longer exists.')
      }
      if (arInvoice.xero_invoice_id) {
        await log.update({ status: 'success', xero_record_id: arInvoice.xero_invoice_id, error_message: null, synced_at: log.synced_at || new Date() })
        await arInvoice.update({ status: 'synced_to_xero' })
        return success(res, {
          id: log.id,
          status: 'success',
          attempt_count: log.attempt_count,
          xero_record_id: arInvoice.xero_invoice_id,
          error_message: null,
          synced_at: log.synced_at,
          note: 'This invoice was already present in Xero - the existing record was adopted rather than creating a duplicate invoice.',
        })
      }
      result = await xeroService.pushArInvoice(
        {
          id: arInvoice.id,
          client_name: arInvoice.Client ? arInvoice.Client.name : null,
          subtotal: arInvoice.subtotal,
          gst_rate_percent: arInvoice.gst_rate_percent,
          tax_amount: arInvoice.tax_amount,
          total_amount: arInvoice.total_amount,
          xero_tax_type: arInvoice.xero_tax_type,
          InvoiceLineItems: arInvoice.InvoiceLineItems,
          booking_reference: arInvoice.Booking ? arInvoice.Booking.reference_number : null,
          service_date: arInvoice.Booking ? arInvoice.Booking.scheduled_date : null,
        },
        conn
      )
    } else {
      await releaseClaim(`Unknown sync log entity_type "${log.entity_type}".`)
      return error(res, `Unknown sync log entity_type "${log.entity_type}".`, 'INTERNAL_ERROR', 500)
    }

    const attempt_count = log.attempt_count + 1

    if (result.ok) {
      const syncedAt = new Date()
      await log.update({ status: 'success', attempt_count, xero_record_id: result.xeroRecordId, error_message: null, synced_at: syncedAt })
      if (vendorInvoice) await vendorInvoice.update({ status: 'synced_to_xero', xero_bill_id: result.xeroRecordId })
      if (vendorInvoice) {
        await vendorInvoiceAuditService.record({
          invoiceId: vendorInvoice.id,
          userId: req.user?.sub || null,
          action: 'sync_retry_succeeded',
          changes: { status: { from: 'failed', to: 'synced_to_xero' }, xero_bill_id: { from: null, to: result.xeroRecordId } },
          note: `Xero retry attempt ${attempt_count} succeeded.`,
        })
      }
      if (arInvoice) await arInvoice.update({ status: 'synced_to_xero', xero_invoice_id: result.xeroRecordId })
      return success(res, {
        id: log.id,
        status: 'success',
        attempt_count,
        xero_record_id: result.xeroRecordId,
        error_message: null,
        synced_at: syncedAt,
      })
    }

    await log.update({ status: 'failed', attempt_count, error_message: result.error })
    if (vendorInvoice) {
      await vendorInvoice.update({ status: 'failed' })
      await vendorInvoiceAuditService.record({
        invoiceId: vendorInvoice.id,
        userId: req.user?.sub || null,
        action: 'sync_retry_failed',
        note: `Xero retry attempt ${attempt_count} failed: ${result.error}`,
      })
      notificationService.create({
        user_id: vendorInvoice.uploaded_by,
        type: 'xero_sync_failed',
        title: `Xero sync failed again for ${vendorInvoice.vendor_name}`,
        body: result.error,
        link: '/xero/sync-status',
      })
    }
    if (arInvoice) {
      await arInvoice.update({ status: 'failed' })
      const recipientId = arInvoice.approved_by || (await resolveArSpecialistId())
      if (recipientId) {
        notificationService.create({
          user_id: recipientId,
          type: 'xero_sync_failed',
          title: `Xero sync failed again for invoice #${arInvoice.id}`,
          body: result.error,
          link: '/xero/sync-status',
        })
      }
    }
    return success(res, {
      id: log.id,
      status: 'failed',
      attempt_count,
      xero_record_id: null,
      error_message: result.error,
      synced_at: null,
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

module.exports = { getActiveConnection, ensureFreshConnection, getFreshConnection, status, connect, callback, disconnect, expenseAccounts, listSyncLogs, retrySync }
