const jwt = require('jsonwebtoken')
const { User } = require('../models')

// How stale last_active_at must be before authenticate() bothers writing a fresh
// value. Without this, every authenticated request (there are many per page load)
// would issue an UPDATE - this keeps it to at most one write per user per minute.
const LAST_ACTIVE_STALE_MS = 60 * 1000

// Verifies the JWT in the Authorization header, then checks it against the user's
// current token_version - a mismatch means a Managing Director has force-logged-out
// this account since the token was issued (see userController.forceLogout). Also
// stamps last_active_at (throttled) so Accounts Management's "Currently Online"
// status has real data to read.
// Attaches decoded payload to req.user on success.
async function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing or invalid token.' })
  }
  const token = header.slice(7)

  let payload
  try {
    const secret = process.env.NODE_ENV === 'production' ? process.env.JWT_SECRET : process.env.DEV_JWT_SECRET
    payload = jwt.verify(token, secret)
  } catch {
    return res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Token is invalid or expired.' })
  }

  try {
    const user = await User.findByPk(payload.sub, { attributes: ['id', 'token_version', 'last_active_at'] })
    if (!user || user.token_version !== payload.token_version) {
      return res.status(401).json({ success: false, code: 'TOKEN_REVOKED', message: 'This session has been logged out. Please sign in again.' })
    }

    const lastActive = user.last_active_at ? new Date(user.last_active_at).getTime() : 0
    if (Date.now() - lastActive > LAST_ACTIVE_STALE_MS) {
      await user.update({ last_active_at: new Date() })
    }

    req.user = payload
    next()
  } catch (err) {
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Something went wrong while authenticating this request.' })
  }
}

// Restricts a route to specific role slugs.
// Usage: authorise('ap_specialist', 'managing_director')
function authorise(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Not authenticated.' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, code: 'FORBIDDEN', message: 'You do not have permission to perform this action.' })
    }
    next()
  }
}

// requireRole is an alias for authorise - kept for backward compatibility
const requireRole = authorise

// Reusable Yup validation middleware factory.
// Usage: validate(schema) validates req.body (default); validate(schema, 'query') or
// validate(schema, 'params') validates the matching request property instead.
//
// On success, req[source] is REPLACED with the validated value - Yup's `stripUnknown`
// removes any fields not declared in the schema and applies declared `.default()` values
// (e.g. `page` defaults to 1), so every downstream controller can trust req.body/query/params
// is already the shape the schema describes.
//
// On failure, responds 400 with the same envelope shape for every route in the app:
//   { success: false, code: 'VALIDATION_ERROR', message: '...', errors: [{ field, message }] }
// abortEarly: false means Yup collects every failing field in one pass instead of stopping
// at the first error, so the client sees the full list of problems in a single round trip.
function validate(schema, source = 'body') {
  return async (req, res, next) => {
    try {
      req[source] = await schema.validate(req[source], { abortEarly: false, stripUnknown: true })
      next()
    } catch (err) {
      if (err.name !== 'ValidationError') return next(err)
      const errors = err.inner && err.inner.length
        ? err.inner.map((e) => ({ field: e.path, message: e.message }))
        : [{ field: err.path || null, message: err.message }]
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'One or more fields failed validation.',
        errors,
      })
    }
  }
}

module.exports = { authenticate, authorise, requireRole, validate }
