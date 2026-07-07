import * as Yup from 'yup'

// loginSchema - used by the login form
export const loginSchema = Yup.object({
  email: Yup.string().email('Enter a valid email address').required('Email is required'),
  password: Yup.string().required('Password is required'),
})
// Validation schema for booking assignment actions.
// This ensures the crew assignment form cannot submit without a selected crew member.
export const bookingAssignmentSchema = Yup.object({
  assignedCrew: Yup.string().required('Select a crew member to assign'),
})

// Validation schema for intake rejection actions.
// The rejection reason is required before a submission can be marked Rejected.
export const intakeRejectSchema = Yup.object({
  rejectionReason: Yup.string().required('Please enter a rejection reason'),
})

// Placeholder schema for intake review actions.
// This can be extended later if the intake review modal needs validation for tier or notes.
export const intakeReviewSchema = Yup.object({
  actionTier: Yup.string().required('Service tier is required'),
  internalNotes: Yup.string(),
})
// Add feature-specific schemas in this file as you build each form.
// e.g. export const memoSchema = Yup.object({ ... })
