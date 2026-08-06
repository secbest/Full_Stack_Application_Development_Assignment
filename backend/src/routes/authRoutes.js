const router = require('express').Router()
const { register, login, logout } = require('../controllers/authController')
const { authenticate, authorise, validate } = require('../middleware')
const { ROLE } = require('../models')
const { registerSchema } = require('../validators')

// registerSchema validation runs through the same shared `validate` middleware every other
// route in the app uses, so a bad field returns the standard 400 { errors: [{ field, message }] }
// shape instead of the ad-hoc 422 the controller used to return.
//
// Gated to managing_director: this accepts an arbitrary `role` in the body, so a fully
// public registration endpoint would let anyone self-register as managing_director and
// then use that token against every other MD-only route (Accounts Management, etc).
// The only in-app caller is AddUserModal in Management.jsx, which already runs as an
// authenticated managing_director and already sends the bearer token via the shared
// axios instance - no frontend change needed. The first admin account is created
// directly in the DB via scripts/seed-users.js, bypassing this endpoint entirely, so
// gating it doesn't create a bootstrap chicken-and-egg problem.
router.post('/register', authenticate, authorise(ROLE.MANAGING_DIRECTOR), validate(registerSchema), register)
router.post('/login', login)
router.post('/logout', authenticate, logout)

module.exports = router
