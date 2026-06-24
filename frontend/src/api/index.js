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

// Redirect to /login when the server returns 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('efar_token')
      localStorage.removeItem('efar_user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api
