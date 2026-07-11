const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { ROLE } = require('../models')
const { userIdParamSchema } = require('../validators')
const { deleteUser } = require('../controllers/userController')

router.delete('/:id', authenticate, authorise(ROLE.MANAGING_DIRECTOR), validate(userIdParamSchema, 'params'), deleteUser)

module.exports = router
