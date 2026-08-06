const bcrypt = require('bcryptjs')
const { User } = require('../models')
const { success, created, error } = require('../utils')
const { loginSchema } = require('../validators')
const { signToken } = require('../utils/token')

async function register(req, res) {
  try {
    const body = req.body
    const exists = await User.findOne({ where: { email: body.email } })
    if (exists) return error(res, 'An account with this email already exists.', 'EMAIL_IN_USE', 409)
    const hash = await bcrypt.hash(body.password, 12)
    const user = await User.create({ name: body.name, email: body.email, password: hash, role: body.role })
    const token = signToken(user)
    return created(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// Consecutive failed attempts before an account auto-locks. Cleared by
// userController.unlockUser (managing_director only).
const MAX_FAILED_LOGIN_ATTEMPTS = 5

async function login(req, res) {
  try {
    const body = await loginSchema.validate(req.body, { abortEarly: false, stripUnknown: true })
    const user = await User.findOne({ where: { email: body.email } })

    if (user && user.is_locked) {
      return error(
        res,
        'This account has been locked after too many failed login attempts. Ask a Managing Director to unlock it.',
        'ACCOUNT_LOCKED',
        403
      )
    }

    // Constant-time comparison: always run bcrypt even when user not found to prevent timing attacks
    const hash = user ? user.password : '$2b$12$invalidhashfortimingreasons00000000000'
    const valid = await bcrypt.compare(body.password, hash)

    if (!user || !valid) {
      if (user) {
        const failedCount = user.failed_login_count + 1
        await user.update({ failed_login_count: failedCount, is_locked: failedCount >= MAX_FAILED_LOGIN_ATTEMPTS })
      }
      return error(res, 'Invalid email or password.', 'INVALID_CREDENTIALS', 401)
    }

    await user.update({ failed_login_count: 0, last_login_at: new Date(), last_active_at: new Date() })

    const token = signToken(user)
    return success(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 422)
    return error(res, 'Invalid email or password.', 'INVALID_CREDENTIALS', 401)
  }
}

module.exports = { register, login }
