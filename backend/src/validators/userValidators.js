const Yup = require('yup')

// Field rules mirror registerSchema in backend/src/validators/index.js exactly, so a
// value that would be rejected at registration is rejected the same way here.
const updateProfileSchema = Yup.object({
  name: Yup.string().min(2).max(100).required('Name is required'),
  email: Yup.string().email('Must be a valid email').required('Email is required'),
})

const updatePasswordSchema = Yup.object({
  currentPassword: Yup.string().required('Current password is required'),
  newPassword: Yup.string().min(8, 'Password must be at least 8 characters').required('New password is required'),
})

module.exports = { updateProfileSchema, updatePasswordSchema }
