// Minimal read-only user list - needed by the bookings crew-assignment picker so it can
// show real field_crew accounts instead of a hardcoded list that drifts from the users table.
const { User } = require('../models')
const { success, internalError } = require('../utils')

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

module.exports = { listUsers }
