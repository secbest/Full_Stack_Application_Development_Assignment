const router = require('express').Router()
const { authenticate, authorise } = require('../middleware')
const { ROLE } = require('../models')
const { listUsers } = require('../controllers/userController')

// Scoped to the role that currently needs it (bookings crew assignment). Widen this
// list if another feature needs a user/crew lookup later.
router.get('/', authenticate, authorise(ROLE.QUOTATIONS_SPECIALIST, ROLE.MANAGING_DIRECTOR), listUsers)

module.exports = router
