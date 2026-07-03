// Placeholder scope: only the two read routes Field Crew needs today. Zheng Bao owns
// booking management (POST /, PATCH /:id/status, crew assignment) - merge with his
// bookingRoutes.js rather than building on top of this file once his lands.
const router = require('express').Router()
const { authenticate, authorise } = require('../middleware')
const { listMyJobs, getBookingById } = require('../controllers/bookingController')

router.get(
  '/my-jobs',
  authenticate,
  authorise('field_crew', 'managing_director'),
  listMyJobs
)

router.get(
  '/:id',
  authenticate,
  authorise('field_crew', 'ar_specialist', 'managing_director'),
  getBookingById
)

module.exports = router
