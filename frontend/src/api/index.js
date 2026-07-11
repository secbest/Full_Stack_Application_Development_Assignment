import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

// Attach Bearer token from localStorage on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('efar_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Redirect to /login when the server returns 401 for authenticated requests.
// Skip the redirect for the login endpoint itself - a 401 there means wrong credentials,
// not an expired session, so the login page handles it with an inline error message.
// Skip the redirect for the password-change endpoint too - a 401 there means the user
// mistyped their current password, not an expired session, so SettingsPage handles it
// with an inline error message.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLoginRequest = err.config?.url?.includes('/auth/login')
    const isPasswordChangeRequest = err.config?.url?.includes('/users/me/password')
    if (err.response?.status === 401 && !isLoginRequest && !isPasswordChangeRequest) {
      localStorage.removeItem('efar_token')
      localStorage.removeItem('efar_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
