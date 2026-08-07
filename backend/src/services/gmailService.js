const crypto = require('crypto')

const AUTH_BASE = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'
const pendingStates = new Map()

function config() {
  const clientId = process.env.GOOGLE_GMAIL_CLIENT_ID
  const clientSecret = process.env.GOOGLE_GMAIL_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_GMAIL_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) throw Object.assign(new Error('Google Gmail OAuth is not configured.'), { code: 'GMAIL_CONFIG_MISSING' })
  return { clientId, clientSecret, redirectUri }
}

function tokenKey() {
  // The client secret is already a deployment secret; hashing it yields a fixed AES key
  // without introducing another value staff must copy during the first local test.
  return crypto.createHash('sha256').update(config().clientSecret).digest()
}

function encrypt(value) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', tokenKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${encrypted.toString('hex')}`
}

function decrypt(value) {
  const [ivHex, tagHex, dataHex] = String(value).split(':')
  const decipher = crypto.createDecipheriv('aes-256-gcm', tokenKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8')
}

function getAuthorizationUrl() {
  const { clientId, redirectUri } = config()
  const state = crypto.randomBytes(24).toString('hex')
  pendingStates.set(state, Date.now() + 10 * 60 * 1000)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.modify',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  return `${AUTH_BASE}?${params}`
}

function consumeState(state) {
  const expiry = pendingStates.get(state)
  pendingStates.delete(state)
  return Boolean(expiry && expiry > Date.now())
}

async function requestToken(params) {
  const response = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(params) })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error_description || body.error || 'Google token request failed.')
  return body
}

async function exchangeCode(code) {
  const { clientId, clientSecret, redirectUri } = config()
  return requestToken({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' })
}

async function accessToken(connection) {
  const { clientId, clientSecret } = config()
  const tokens = await requestToken({
    refresh_token: decrypt(connection.refresh_token), client_id: clientId, client_secret: clientSecret, grant_type: 'refresh_token',
  })
  return tokens.access_token
}

async function api(connection, path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${await accessToken(connection)}`, ...(options.headers || {}) },
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.message || 'Gmail API request failed.')
  return body
}

async function profile(accessTokenValue) {
  const response = await fetch(`${API_BASE}/profile`, { headers: { Authorization: `Bearer ${accessTokenValue}` } })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error?.message || 'Could not read Gmail profile.')
  return body
}

async function labels(connection) { return api(connection, '/labels') }

async function getOrCreateLabel(connection, name) {
  const current = await labels(connection)
  const existing = (current.labels || []).find((label) => label.name === name)
  if (existing) return existing
  return api(connection, '/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }) })
}

async function listPendingMessages(connection, intakeLabelId, processedLabelId) {
  const data = await api(connection, `/messages?${new URLSearchParams({ maxResults: '25', labelIds: intakeLabelId, q: 'has:attachment filename:pdf' })}`)
  return (data.messages || []).filter((message) => !message.labelIds?.includes(processedLabelId))
}

async function message(connection, id) { return api(connection, `/messages/${id}?format=full`) }

function pdfParts(part, out = []) {
  if (part.filename && part.mimeType === 'application/pdf' && (part.body?.attachmentId || part.body?.data)) out.push(part)
  for (const child of part.parts || []) pdfParts(child, out)
  return out
}

async function pdfAttachments(connection, fullMessage) {
  return Promise.all(pdfParts(fullMessage.payload).map(async (part) => {
    const encoded = part.body.data || (await api(connection, `/messages/${fullMessage.id}/attachments/${part.body.attachmentId}`)).data
    return { originalname: part.filename, mimetype: 'application/pdf', buffer: Buffer.from(encoded, 'base64url') }
  }))
}

async function markProcessed(connection, messageId, processedLabelId) {
  return api(connection, `/messages/${messageId}/modify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addLabelIds: [processedLabelId] }) })
}

module.exports = { encrypt, getAuthorizationUrl, consumeState, exchangeCode, profile, getOrCreateLabel, listPendingMessages, message, pdfAttachments, markProcessed }
