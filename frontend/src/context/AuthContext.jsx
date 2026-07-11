import { createContext, useContext, useState } from 'react'
import api from '../api'

const AuthContext = createContext(null)

// Decodes the JWT payload without verifying the signature.
// The server validates signatures on every API call; the client only needs the claims for UI routing.
function decodeJwt(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return null
  }
}

// Returns the decoded payload if the token exists and has not expired, otherwise null.
function getUserFromToken(token) {
  if (!token) return null
  const payload = decodeJwt(token)
  if (!payload) return null
  if (payload.exp && payload.exp * 1000 < Date.now()) return null
  return payload
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('efar_token'))
  // user is always derived from the JWT - no separate localStorage key needed.
  // This means dev test tokens (set directly in localStorage) work without logging in.
  const [user, setUser] = useState(() => getUserFromToken(localStorage.getItem('efar_token')))

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    const newToken = data.data.token
    localStorage.setItem('efar_token', newToken)
    const decoded = getUserFromToken(newToken)
    setToken(newToken)
    setUser(decoded)
    return decoded
  }

  function logout() {
    localStorage.removeItem('efar_token')
    setToken(null)
    setUser(null)
  }

  // Used after a profile edit: the backend re-signs a JWT with the new name/email
  // claims (see backend/src/controllers/userController.js), so the client must swap
  // its stored token the same way login() does, or a page refresh would show stale data.
  function updateUser(newToken) {
    localStorage.setItem('efar_token', newToken)
    const decoded = getUserFromToken(newToken)
    setToken(newToken)
    setUser(decoded)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
