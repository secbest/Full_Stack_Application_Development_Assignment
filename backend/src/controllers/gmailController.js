const { GmailConnection } = require('../models')
const gmailService = require('../services/gmailService')
const { receiveInboundEmail } = require('./vendorInvoiceController')
const { success, error } = require('../utils')

const INTAKE_LABEL = 'EFAR AP Invoices'
const PROCESSED_LABEL = 'EFAR AP Processed'

async function activeConnection() {
  return GmailConnection.findOne({ where: { is_connected: true }, order: [['connected_at', 'DESC']] })
}

function capturedResponse() {
  const result = { statusCode: 200, body: null }
  return {
    result,
    status(code) { result.statusCode = code; return this },
    json(body) { result.body = body; return this },
  }
}

async function importPendingGmailInvoices() {
  const connection = await activeConnection()
  if (!connection) return { connected: false, imported: [], message: 'Gmail is not connected.' }

  const intakeLabel = await gmailService.getOrCreateLabel(connection, INTAKE_LABEL)
  const processedLabel = await gmailService.getOrCreateLabel(connection, PROCESSED_LABEL)
  const candidates = await gmailService.listPendingMessages(connection, intakeLabel.id, processedLabel.id)
  const imported = []

  for (const candidate of candidates) {
    const fullMessage = await gmailService.message(connection, candidate.id)
    if ((fullMessage.labelIds || []).includes(processedLabel.id)) continue
    const files = await gmailService.pdfAttachments(connection, fullMessage)
    if (!files.length) continue
    const captured = capturedResponse()
    await receiveInboundEmail({
      internal_email_intake: true,
      body: { message_id: `gmail:${fullMessage.id}` },
      files,
    }, captured)
    const failed = captured.result.statusCode >= 400 || (captured.result.body?.data?.received || []).some((row) => row.status === 'failed')
    if (!failed) await gmailService.markProcessed(connection, fullMessage.id, processedLabel.id)
    imported.push({ gmail_message_id: fullMessage.id, imported: !failed, result: captured.result.body?.data || captured.result.body })
  }
  return { connected: true, inbox: connection.gmail_address, imported }
}

async function status(req, res) {
  try {
    const connection = await activeConnection()
    return success(res, {
      is_connected: Boolean(connection),
      gmail_address: connection?.gmail_address || process.env.GOOGLE_GMAIL_INBOX || null,
      intake_label: INTAKE_LABEL,
      processed_label: PROCESSED_LABEL,
      configured: Boolean(process.env.GOOGLE_GMAIL_CLIENT_ID && process.env.GOOGLE_GMAIL_CLIENT_SECRET && process.env.GOOGLE_GMAIL_REDIRECT_URI),
    })
  } catch (err) { return error(res, err.message, 'INTERNAL_ERROR', 500) }
}

async function connect(req, res) {
  try { return success(res, { auth_url: gmailService.getAuthorizationUrl() }) }
  catch (err) { return error(res, err.message, err.code || 'INTERNAL_ERROR', 500) }
}

async function callback(req, res) {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173'
  const redirect = (query) => res.redirect(`${frontend}/vendor-invoices?${query}`)
  try {
    if (req.query.error) return redirect('gmail_error=access_denied')
    if (!gmailService.consumeState(req.query.state)) return redirect('gmail_error=invalid_state')
    if (!req.query.code) return redirect('gmail_error=missing_code')
    const tokens = await gmailService.exchangeCode(req.query.code)
    if (!tokens.refresh_token) throw new Error('Google did not provide an offline refresh token. Remove this app from your Google Account and connect again.')
    const profile = await gmailService.profile(tokens.access_token)
    const address = String(profile.emailAddress || '').toLowerCase()
    await GmailConnection.update({ is_connected: false }, { where: { is_connected: true } })
    const existing = await GmailConnection.findOne({ where: { gmail_address: address } })
    const values = { refresh_token: gmailService.encrypt(tokens.refresh_token), is_connected: true, connected_at: new Date() }
    if (existing) await existing.update(values)
    else await GmailConnection.create({ gmail_address: address, connected_by: null, ...values })
    return redirect('gmail_connected=true')
  } catch (err) {
    console.error('[gmail/callback] failed:', err.message)
    return redirect('gmail_error=token_exchange_failed')
  }
}

async function importNow(req, res) {
  try { return success(res, await importPendingGmailInvoices()) }
  catch (err) { return error(res, err.message, 'GMAIL_IMPORT_FAILED', 502) }
}

module.exports = { status, connect, callback, importNow, importPendingGmailInvoices }
