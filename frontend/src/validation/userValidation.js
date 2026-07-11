import * as Yup from 'yup'

// Mirrors backend/src/validators/userValidators.js field-for-field.
export const updateProfileSchema = Yup.object({
  name: Yup.string().min(2).max(100).required('Name is required'),
  email: Yup.string().email('Must be a valid email').required('Email is required'),
})

// confirmPassword is a frontend-only check - it is never sent to the backend.
export const changePasswordSchema = Yup.object({
  currentPassword: Yup.string().required('Current password is required'),
  newPassword: Yup.string().min(8, 'Password must be at least 8 characters').required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .required('Please confirm your new password'),
})
