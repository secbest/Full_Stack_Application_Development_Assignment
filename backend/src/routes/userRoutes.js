const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { ROLE } = require('../models')
const { userIdParamSchema, updateProfileSchema, updatePasswordSchema } = require('../validators/userValidators')
const { deleteUser, updateProfile, updatePassword, listUsers } = require('../controllers/userController')

// Scoped to the role that currently needs it (bookings crew assignment). Widen this
// list if another feature needs a user/crew lookup later.
router.get('/', authenticate, authorise(ROLE.QUOTATIONS_SPECIALIST, ROLE.MANAGING_DIRECTOR), listUsers)

router.patch('/me', authenticate, validate(updateProfileSchema), updateProfile)
router.patch('/me/password', authenticate, validate(updatePasswordSchema), updatePassword)
router.delete('/:id', authenticate, authorise(ROLE.MANAGING_DIRECTOR), validate(userIdParamSchema, 'params'), deleteUser)

module.exports = router
