// Standard response helpers - use these in all controllers for consistent response shapes.

function success(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

function created(res, data) {
  return success(res, data, 201)
}

function error(res, message, code = 'BAD_REQUEST', status = 400) {
  return res.status(status).json({ success: false, code, message })
}

function notFound(res, message = 'Resource not found') {
  return error(res, message, 'NOT_FOUND', 404)
}

function forbidden(res, message = 'You do not have permission to perform this action.') {
  return error(res, message, 'FORBIDDEN', 403)
}

module.exports = { success, created, error, notFound, forbidden }
