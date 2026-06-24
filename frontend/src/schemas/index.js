import * as Yup from 'yup'

// loginSchema - used by the login form
export const loginSchema = Yup.object({
  email: Yup.string().email('Enter a valid email address').required('Email is required'),
  password: Yup.string().required('Password is required'),
})

// Add feature-specific schemas in this file as you build each form.
// e.g. export const memoSchema = Yup.object({ ... })
