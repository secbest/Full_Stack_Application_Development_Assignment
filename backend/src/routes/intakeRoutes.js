const router = require('express').Router()
const { authenticate, authorise } = require('../middleware')
const { createIntake, listIntakes, getIntakeById, confirmIntake, rejectIntake, deleteIntake } = require('../controllers/intakeController')

router.post('/', createIntake)
router.get('/', authenticate, authorise('quotations_specialist'), listIntakes)
router.get('/:id', authenticate, authorise('quotations_specialist'), getIntakeById)
router.post('/:id/confirm', authenticate, authorise('quotations_specialist'), confirmIntake)
router.post('/:id/reject', authenticate, authorise('quotations_specialist'), rejectIntake)
router.delete('/:id', authenticate, authorise('quotations_specialist'), deleteIntake)

module.exports = router
