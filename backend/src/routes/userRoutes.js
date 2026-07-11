const router = require('express').Router()
const { authenticate, validate } = require('../middleware')
const { updateProfileSchema, updatePasswordSchema } = require('../validators/userValidators')
const { updateProfile, updatePassword } = require('../controllers/userController')

router.patch('/me', authenticate, validate(updateProfileSchema), updateProfile)
router.patch('/me/password', authenticate, validate(updatePasswordSchema), updatePassword)

module.exports = router
