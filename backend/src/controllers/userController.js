const { User } = require('../models')
const { success, notFound, error, internalError } = require('../utils')

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

module.exports = { deleteUser }
