const router = require('express').Router()
const { authenticate, authorise } = require('../middleware')
const { status, connect, callback, importNow } = require('../controllers/gmailController')

router.get('/status', authenticate, authorise('ap_specialist', 'managing_director'), status)
router.get('/connect', authenticate, authorise('managing_director'), connect)
router.get('/callback', callback)
router.post('/import', authenticate, authorise('ap_specialist', 'managing_director'), importNow)

module.exports = router
