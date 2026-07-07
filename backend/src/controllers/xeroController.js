const { xeroService } = require('../services')
const { success, error } = require('../utils')

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

module.exports = { connect }
