const crypto = require('crypto')

// UC-01: Xero OAuth2 connection - authorisation URL construction.
// Token exchange (the /callback handler) and disconnect are Wave 3 scope; this
// service only builds the URL the frontend redirects the admin to.

const XERO_AUTH_BASE = 'https://login.xero.com/identity/connect/authorize'
const SCOPES = 'openid profile email accounting.transactions accounting.contacts offline_access'

// Builds the Xero OAuth2 authorisation URL with a fresh CSRF state token.
// The state token is not persisted here - the Wave 3 callback handler is
// responsible for storing and verifying it against the redirect's `state` param.
function getAuthorizationUrl() {
  const { XERO_CLIENT_ID, XERO_REDIRECT_URI } = process.env
  if (!XERO_CLIENT_ID || !XERO_REDIRECT_URI) {
    const err = new Error('Xero client_id or redirect_uri not configured in environment')
    err.code = 'XERO_CONFIG_MISSING'
    throw err
  }

  const state = crypto.randomBytes(16).toString('hex')
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: XERO_CLIENT_ID,
    redirect_uri: XERO_REDIRECT_URI,
    scope: SCOPES,
    state,
  })

  return { authUrl: `${XERO_AUTH_BASE}?${params.toString()}`, state }
}

module.exports = { getAuthorizationUrl }
