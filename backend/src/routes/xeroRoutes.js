const router = require('express').Router()
const { authenticate, authorise } = require('../middleware')
const { connect } = require('../controllers/xeroController')

router.get('/connect', authenticate, authorise('managing_director'), connect)

// TODO (Wave 3): GET /status, GET /callback (no auth), DELETE /disconnect,
// GET /sync-logs, POST /sync-logs/:id/retry - see design/kwan-hua/api-documentation.md

module.exports = router
