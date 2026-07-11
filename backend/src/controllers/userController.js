const bcrypt = require('bcryptjs')
const { Op } = require('sequelize')
const { User } = require('../models')
const { success, error, internalError } = require('../utils')
const { signToken } = require('../utils/token')

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

module.exports = { updateProfile, updatePassword }
