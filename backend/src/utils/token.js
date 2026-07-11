const jwt = require('jsonwebtoken')

// Shared by authController (register/login) and userController (profile update) -
// every JWT this app issues carries the same claim shape, so a caller only needs to
// know signToken(user), not the individual claim names.
function signToken(user) {
  const secret = process.env.NODE_ENV === 'production'
    ? process.env.JWT_SECRET
    : process.env.DEV_JWT_SECRET
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email, role: user.role },
    secret,
    { expiresIn: '8h' }
  )
}

module.exports = { signToken }
