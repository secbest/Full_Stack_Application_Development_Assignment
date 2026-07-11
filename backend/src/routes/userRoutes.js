const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { ROLE } = require('../models')
const { userIdParamSchema, updateProfileSchema, updatePasswordSchema } = require('../validators/userValidators')
const { deleteUser, updateProfile, updatePassword } = require('../controllers/userController')

router.patch('/me', authenticate, validate(updateProfileSchema), updateProfile)
router.patch('/me/password', authenticate, validate(updatePasswordSchema), updatePassword)
router.delete('/:id', authenticate, authorise(ROLE.MANAGING_DIRECTOR), validate(userIdParamSchema, 'params'), deleteUser)

module.exports = router
