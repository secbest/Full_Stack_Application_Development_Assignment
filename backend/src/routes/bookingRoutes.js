const router = require('express').Router()
const { authenticate, authorise } = require('../middleware')
const { listMyJobs, listBookings, getBookingById, updateBookingCrew } = require('../controllers/bookingController')

router.get(
  '/my-jobs',
  authenticate,
  authorise('field_crew', 'managing_director'),
  listMyJobs
)

router.get('/', authenticate, authorise('quotations_specialist', 'ar_specialist', 'managing_director'), listBookings)

router.get(
  '/:id',
  authenticate,
  authorise('field_crew', 'ar_specialist', 'managing_director'),
  getBookingById
)

router.patch('/:id/crew', authenticate, authorise('quotations_specialist'), updateBookingCrew)

module.exports = router
