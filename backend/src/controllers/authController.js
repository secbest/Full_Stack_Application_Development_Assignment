const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { User } = require('../models')
const { success, created, error } = require('../utils')
const { registerSchema, loginSchema } = require('../validators')

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

async function register(req, res) {
  try {
    const body = await registerSchema.validate(req.body, { abortEarly: false, stripUnknown: true })
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
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 422)
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

async function login(req, res) {
  try {
    const body = await loginSchema.validate(req.body, { abortEarly: false, stripUnknown: true })
    const user = await User.findOne({ where: { email: body.email } })
    // Constant-time comparison: always run bcrypt even when user not found to prevent timing attacks
    const hash = user ? user.password : '$2b$12$invalidhashfortimingreasons00000000000'
    const valid = await bcrypt.compare(body.password, hash)
    if (!user || !valid) return error(res, 'Invalid email or password.', 'INVALID_CREDENTIALS', 401)
    const token = signToken(user)
    return success(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 422)
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

module.exports = { register, login }
