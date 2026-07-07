const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { syncLogListQuerySchema } = require('../validators')
const { status, connect, callback, disconnect, listSyncLogs, retrySync } = require('../controllers/xeroController')

// UC-01: connection lifecycle
router.get('/status', authenticate, authorise('managing_director', 'ap_specialist', 'ar_specialist'), status)
router.get('/connect', authenticate, authorise('managing_director'), connect)
router.get('/callback', callback) // no auth - called by Xero's redirect (CSRF via state param)
router.delete('/disconnect', authenticate, authorise('managing_director'), disconnect)

// UC-08: sync status panel (shared AP + AR)
router.get('/sync-logs', authenticate, authorise('ap_specialist', 'ar_specialist', 'managing_director'), validate(syncLogListQuerySchema, 'query'), listSyncLogs)
router.post('/sync-logs/:id/retry', authenticate, authorise('ap_specialist', 'ar_specialist'), retrySync)

module.exports = router
