const Yup = require('yup')

// Owner: Jasper (Wave 2 field ops - client feedback item 1).
// Body validation for POST /api/bookings/:id/milestone. The client sends only the
// milestone type - recorded_at is server-set in the controller, so any timestamp a
// client tried to smuggle in is stripped by stripUnknown.
const MILESTONE_TYPES = ['activated', 'arrived_at_location', 'en_route', 'arrived_at_destination', 'job_completed']

const milestoneBodySchema = Yup.object({
  milestone_type: Yup.string()
    .oneOf(MILESTONE_TYPES, `milestone_type must be one of: ${MILESTONE_TYPES.join(', ')}`)
    .required('milestone_type is required'),
})

const bookingIdParamSchema = Yup.object({
  id: Yup.number().integer().positive().required('A valid booking id is required'),
})

// POST /api/bookings/:id/reject - field crew declining a job they're assigned to.
// A reason is mandatory so Quotations has context when reassigning, same rule as
// intakeRejectSchema's rejection_reason.
const bookingRejectSchema = Yup.object({
  reason: Yup.string().trim().required('A reason is required to reject this job'),
})

module.exports = { MILESTONE_TYPES, milestoneBodySchema, bookingIdParamSchema, bookingRejectSchema }
