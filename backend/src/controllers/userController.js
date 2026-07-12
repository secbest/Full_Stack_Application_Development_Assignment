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

// GET /api/users?role=field_crew - minimal read-only user list, needed by the bookings
// crew-assignment picker so it can show real field_crew accounts instead of a hardcoded
// list that drifts from the users table.
async function listUsers(req, res) {
  try {
    const where = {}
    if (req.query.role) where.role = req.query.role

    const users = await User.findAll({
      where,
      attributes: ['id', 'name', 'role'],
      order: [['name', 'ASC']],
    })
    return success(res, users)
  } catch (err) {
    return internalError(res, err)
  }
}

module.exports = { deleteUser, updateProfile, updatePassword, listUsers }
