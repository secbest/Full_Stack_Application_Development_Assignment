const router = require('express').Router()
const { authenticate, authorise } = require('../middleware')
const { ROLE } = require('../models')
const { listClients } = require('../controllers/clientController')

// Scoped to the roles that currently need it (pricing contracts). Widen this list if
// another feature needs client lookups later.
router.get('/', authenticate, authorise(ROLE.AR_SPECIALIST, ROLE.MANAGING_DIRECTOR), listClients)

module.exports = router
