const bcrypt = require('bcryptjs')
const { Op } = require('sequelize')
const { User } = require('../models')
const { success, notFound, error, internalError } = require('../utils')
const { signToken } = require('../utils/token')

// DELETE /api/users/:id - managing_director only. None of the FK associations onto
// User (bookings, memos, invoices, etc.) cascade, so removing an account with history
// throws a SequelizeForeignKeyConstraintError - caught below and surfaced as a 409
// rather than a raw 500, since the real fix for that case is deactivating the account,
// not deleting it.
async function deleteUser(req, res) {
  try {
    if (req.user.sub === req.params.id) {
      return error(res, 'You cannot remove your own account while logged in.', 'CANNOT_REMOVE_SELF', 409)
    }

    const user = await User.findByPk(req.params.id)
    if (!user) return notFound(res, 'No user with this id.', 'USER_NOT_FOUND')

    await user.destroy()
    return success(res, { message: 'User removed.' })
  } catch (err) {
    if (err.name === 'SequelizeForeignKeyConstraintError') {
      return error(
        res,
        'This user has associated records (bookings, memos, invoices, etc.) and cannot be removed.',
        'USER_IN_USE',
        409
      )
    }
    return internalError(res, err)
  }
}

async function updateProfile(req, res) {
  try {
    const { name, email } = req.body
    const existing = await User.findOne({ where: { email, id: { [Op.ne]: req.user.sub } } })
    if (existing) return error(res, 'An account with this email already exists.', 'EMAIL_IN_USE', 409)

    const user = await User.findByPk(req.user.sub)
    user.name = name
    user.email = email
    await user.save()

    const token = signToken(user)
    return success(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    return internalError(res, err)
  }
}

async function updatePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await User.findByPk(req.user.sub)
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return error(res, 'Current password is incorrect.', 'INVALID_CREDENTIALS', 401)

    user.password = await bcrypt.hash(newPassword, 12)
    await user.save()

    return success(res, { message: 'Password updated successfully.' })
  } catch (err) {
    return internalError(res, err)
  }
}

// "Currently Online" on Accounts Management means active within this window.
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

function isOnline(lastActiveAt) {
  if (!lastActiveAt) return false
  return Date.now() - new Date(lastActiveAt).getTime() <= ONLINE_THRESHOLD_MS
}

// GET /api/users?role=field_crew - read-only user list. The quotations_specialist crew
// picker only ever needs id/name/role, but the managing_director's Accounts Management
// screen needs the session/security fields too - gated on role rather than a query flag
// so a non-MD caller can never read another user's email or lock status.
async function listUsers(req, res) {
  try {
    const where = {}
    if (req.query.role) where.role = req.query.role

    const isManagingDirector = req.user.role === 'managing_director'
    const attributes = isManagingDirector
      ? ['id', 'name', 'email', 'role', 'last_login_at', 'last_active_at', 'is_locked']
      : ['id', 'name', 'role']

    const users = await User.findAll({ where, attributes, order: [['name', 'ASC']] })
    if (!isManagingDirector) return success(res, users)

    return success(res, users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      last_login_at: u.last_login_at,
      last_active_at: u.last_active_at,
      is_online: isOnline(u.last_active_at),
      is_locked: u.is_locked,
    })))
  } catch (err) {
    return internalError(res, err)
  }
}

// PATCH /api/users/:id - managing_director only. Edits another user's profile fields
// from the Accounts Management screen. (updateProfile above is the self-service /me
// route - this is the admin equivalent, and additionally accepts `role`.)
async function updateUser(req, res) {
  try {
    const user = await User.findByPk(req.params.id)
    if (!user) return notFound(res, 'No user with this id.', 'USER_NOT_FOUND')

    const { name, email, role } = req.body
    const existing = await User.findOne({ where: { email, id: { [Op.ne]: user.id } } })
    if (existing) return error(res, 'An account with this email already exists.', 'EMAIL_IN_USE', 409)

    user.name = name
    user.email = email
    user.role = role
    await user.save()

    return success(res, { id: user.id, name: user.name, email: user.email, role: user.role })
  } catch (err) {
    return internalError(res, err)
  }
}

// POST /api/users/:id/force-logout - managing_director only. Bumping token_version
// invalidates every JWT already issued to this user: their next request fails
// authenticate()'s token_version check with 401 TOKEN_REVOKED, and the frontend's
// response interceptor (src/api/index.js) redirects them to /login.
async function forceLogout(req, res) {
  try {
    const user = await User.findByPk(req.params.id)
    if (!user) return notFound(res, 'No user with this id.', 'USER_NOT_FOUND')

    await user.update({ token_version: user.token_version + 1 })
    return success(res, { message: 'User has been logged out of all sessions.' })
  } catch (err) {
    return internalError(res, err)
  }
}

// POST /api/users/:id/unlock - managing_director only. Clears the lockout that
// authController.login sets after MAX_FAILED_LOGIN_ATTEMPTS consecutive failures.
async function unlockUser(req, res) {
  try {
    const user = await User.findByPk(req.params.id)
    if (!user) return notFound(res, 'No user with this id.', 'USER_NOT_FOUND')

    await user.update({ is_locked: false, failed_login_count: 0 })
    return success(res, { message: 'User account has been unlocked.' })
  } catch (err) {
    return internalError(res, err)
  }
}

module.exports = { deleteUser, updateProfile, updatePassword, listUsers, updateUser, forceLogout, unlockUser }
