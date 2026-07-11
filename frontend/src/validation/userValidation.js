import * as Yup from 'yup'

// Mirrors backend/src/validators/userValidators.js field-for-field, including the
// @efar.com.sg domain restriction - every account on this platform is EFAR staff.
const EFAR_EMAIL_DOMAIN = /@efar\.com\.sg$/i

export const updateProfileSchema = Yup.object({
  name: Yup.string().min(2).max(100).required('Name is required'),
  email: Yup.string().email('Must be a valid email').matches(EFAR_EMAIL_DOMAIN, 'Email must be an @efar.com.sg address').required('Email is required'),
})

// confirmPassword is a frontend-only check - it is never sent to the backend.
export const changePasswordSchema = Yup.object({
  currentPassword: Yup.string().required('Current password is required'),
  newPassword: Yup.string().min(8, 'Password must be at least 8 characters').required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .required('Please confirm your new password'),
})
