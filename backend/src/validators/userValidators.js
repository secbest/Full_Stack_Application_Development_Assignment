const Yup = require('yup')

// Field rules mirror registerSchema in backend/src/validators/index.js exactly, so a
// value that would be rejected at registration is rejected the same way here - including
// the @efar.com.sg domain restriction, since every account is an EFAR staff account.
const EFAR_EMAIL_DOMAIN = /@efar\.com\.sg$/i

const updateProfileSchema = Yup.object({
  name: Yup.string().min(2).max(100).required('Name is required'),
  email: Yup.string().email('Must be a valid email').matches(EFAR_EMAIL_DOMAIN, 'Email must be an @efar.com.sg address').required('Email is required'),
})

const updatePasswordSchema = Yup.object({
  currentPassword: Yup.string().required('Current password is required'),
  newPassword: Yup.string().min(8, 'Password must be at least 8 characters').required('New password is required'),
})

module.exports = { updateProfileSchema, updatePasswordSchema }
