const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { milestoneBodySchema, bookingIdParamSchema, bookingRejectSchema } = require('../validators')
const { listMyJobs, listBookings, getBookingById, updateBookingCrew, rejectBooking, deleteBooking } = require('../controllers/bookingController')
const { recordMilestone } = require('../controllers/jobMilestoneController')

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

router.delete('/:id', authenticate, authorise('quotations_specialist'), deleteBooking)

// Jasper (client feedback item 1) - crew taps a button as each job stage happens;
// the server records the timestamp. Also the real "start job" action: recording
// 'activated' moves a confirmed booking to in_progress.
router.post(
  '/:id/milestone',
  authenticate,
  authorise('field_crew', 'managing_director'),
  validate(bookingIdParamSchema, 'params'),
  validate(milestoneBodySchema),
  recordMilestone
)

// Field crew declining a job (current or upcoming) - sends it back to Quotations for
// reassignment. Same field_crew-only-their-own-booking rule as the milestone route.
router.post(
  '/:id/reject',
  authenticate,
  authorise('field_crew', 'managing_director'),
  validate(bookingIdParamSchema, 'params'),
  validate(bookingRejectSchema),
  rejectBooking
)

module.exports = router
