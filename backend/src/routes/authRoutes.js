const router = require('express').Router()
const { register, login } = require('../controllers/authController')
const { validate } = require('../middleware')
const { registerSchema } = require('../validators')

// registerSchema validation runs through the same shared `validate` middleware every other
// route in the app uses, so a bad field returns the standard 400 { errors: [{ field, message }] }
// shape instead of the ad-hoc 422 the controller used to return.
router.post('/register', validate(registerSchema), register)
router.post('/login', login)

module.exports = router
