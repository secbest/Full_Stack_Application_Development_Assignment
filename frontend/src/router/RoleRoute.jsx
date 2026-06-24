import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks'

// Redirects to /403 if the logged-in user's role is not in the allowed list.
// Must be used inside a ProtectedRoute (assumes user is already authenticated).
//
// Usage:
//   <Route element={<RoleRoute roles={['ar_specialist']} />}>
//     <Route path="/invoices" element={<InvoiceListPage />} />
//   </Route>
export default function RoleRoute({ roles }) {
  const { user } = useAuth()
  if (!user || !roles.includes(user.role)) return <Navigate to="/403" replace />
  return <Outlet />
}
