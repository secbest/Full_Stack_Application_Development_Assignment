const jwt = require('jsonwebtoken')

// Verifies the JWT in the Authorization header.
// Attaches decoded payload to req.user on success.
function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing or invalid token.' })
  }
  const token = header.slice(7)
  try {
    const secret = process.env.NODE_ENV === 'production' ? process.env.JWT_SECRET : process.env.DEV_JWT_SECRET
    req.user = jwt.verify(token, secret)
    next()
  } catch {
    res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Token is invalid or expired.' })
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

module.exports = { authenticate, authorise, requireRole }
