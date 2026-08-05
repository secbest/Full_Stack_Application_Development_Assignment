// Standard response helpers - use these in all controllers for consistent response shapes.

function success(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

function created(res, data) {
  return success(res, data, 201)
}

function error(res, message, code = 'BAD_REQUEST', status = 400, extra = {}) {
  return res.status(status).json({ success: false, code, message, ...extra })
}

function notFound(res, message = 'Resource not found', code = 'NOT_FOUND') {
  return error(res, message, code, 404)
}

function forbidden(res, message = 'You do not have permission to perform this action.') {
  return error(res, message, 'FORBIDDEN', 403)
}

// Every catch-all `catch (err) { error(res, err.message, ...) }` in this app forwards
// the raw error message verbatim, which is fine for most thrown errors (e.g. a
// hand-written validation message) but not for a Sequelize error specifically - a bad
// ENUM value or constraint violation can surface raw column/table/constraint names in
// err.message. This logs the real error server-side always, and only swaps in a
// generic message when the error actually came from Sequelize (identified by its
// `name` prefix, e.g. SequelizeValidationError/SequelizeDatabaseError).
function internalError(res, err) {
  console.error(err)
  const message = err.name && err.name.startsWith('Sequelize')
    ? 'A database error occurred while processing this request.'
    : err.message
  return error(res, message, 'INTERNAL_ERROR', 500)
}

const { round2 } = require('./money')

module.exports = { success, created, error, notFound, forbidden, internalError, round2 }
