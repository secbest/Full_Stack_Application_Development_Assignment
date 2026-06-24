import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks'

// Redirects to /login if there is no valid, unexpired JWT in localStorage.
// Used as a layout route - all authenticated pages nest inside this.
export default function ProtectedRoute() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}
