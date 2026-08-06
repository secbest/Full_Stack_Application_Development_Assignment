const Yup = require('yup')

const userIdParamSchema = Yup.object({
  id: Yup.number().integer().positive().required('A valid user id is required'),
})

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

// Role list mirrors registerSchema's in backend/src/validators/index.js - each
// validators file keeps its own copy rather than sharing one, matching that file's
// existing convention.
const ROLES = ['managing_director', 'ar_specialist', 'ap_specialist', 'quotations_specialist', 'field_crew']

const updateUserSchema = Yup.object({
  name: Yup.string().min(2).max(100).required('Name is required'),
  email: Yup.string().email('Must be a valid email').matches(EFAR_EMAIL_DOMAIN, 'Email must be an @efar.com.sg address').required('Email is required'),
  role: Yup.string().oneOf(ROLES, `Role must be one of: ${ROLES.join(', ')}`).required('Role is required'),
})

module.exports = { userIdParamSchema, updateProfileSchema, updatePasswordSchema, updateUserSchema }
