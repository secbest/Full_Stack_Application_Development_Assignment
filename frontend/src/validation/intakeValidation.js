import * as Yup from 'yup'

// Mirrors backend/src/validators/index.js's intakeCreateSchema field-for-field,
// including the exact enum values - the backend remains the source of truth (this
// is a UX pre-check, not a security boundary, same convention as contractValidation.js).
export const SERVICE_TYPES = ['eas', 'mts', 'event_standby', 'workplace_standby']
export const SERVICE_TYPE_LABELS = {
  eas: 'Emergency Ambulance Services (EAS)',
  mts: 'Medical Transport Services (MTS)',
  event_standby: 'Event Standby',
  workplace_standby: 'Workplace Standby',
}

const TODAY = new Date().toISOString().slice(0, 10)

export const intakeCreateSchema = Yup.object({
  customer_name: Yup.string().trim().required('Full name is required'),
  organisation: Yup.string().trim().nullable(),
  contact_email: Yup.string().email('Enter a valid email address').required('Contact email is required'),
  contact_phone: Yup.string().matches(/^\d{8}$/, 'Enter an 8-digit Singapore phone number').required('Contact phone is required'),
  service_type: Yup.string().oneOf(SERVICE_TYPES, 'Select a valid service type').required('Service type is required'),
  preferred_date: Yup.string()
    .matches(/^\d{4}-\d{2}-\d{2}$/, 'Preferred date must be a valid date')
    .required('Preferred date is required')
    .test('not-past', 'Preferred date cannot be in the past', (value) => !value || value >= TODAY),
  preferred_time: Yup.string().matches(/^\d{2}:\d{2}$/, 'Preferred time must be in HH:MM format').required('Preferred time is required'),
  pickup_location: Yup.string().trim().required('Pickup location is required'),
  destination: Yup.string().trim().required('Destination is required'),
  additional_notes: Yup.string().trim().nullable(),
})
