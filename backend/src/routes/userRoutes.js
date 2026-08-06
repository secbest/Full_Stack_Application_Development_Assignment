const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { ROLE } = require('../models')
const { userIdParamSchema, updateProfileSchema, updatePasswordSchema, updateUserSchema } = require('../validators/userValidators')
const { deleteUser, updateProfile, updatePassword, listUsers, updateUser, forceLogout, unlockUser } = require('../controllers/userController')

// Scoped to the roles that currently need it (bookings crew assignment, and Accounts
// Management). Widen this list if another feature needs a user/crew lookup later.
router.get('/', authenticate, authorise(ROLE.QUOTATIONS_SPECIALIST, ROLE.MANAGING_DIRECTOR), listUsers)

router.patch('/me', authenticate, validate(updateProfileSchema), updateProfile)
router.patch('/me/password', authenticate, validate(updatePasswordSchema), updatePassword)

// These three are registered AFTER /me and /me/password so a PATCH /me request
// matches the exact route above rather than being captured by the :id param below.
router.patch('/:id', authenticate, authorise(ROLE.MANAGING_DIRECTOR), validate(userIdParamSchema, 'params'), validate(updateUserSchema), updateUser)
router.post('/:id/force-logout', authenticate, authorise(ROLE.MANAGING_DIRECTOR), validate(userIdParamSchema, 'params'), forceLogout)
router.post('/:id/unlock', authenticate, authorise(ROLE.MANAGING_DIRECTOR), validate(userIdParamSchema, 'params'), unlockUser)

router.delete('/:id', authenticate, authorise(ROLE.MANAGING_DIRECTOR), validate(userIdParamSchema, 'params'), deleteUser)

module.exports = router
