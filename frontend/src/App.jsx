import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks'
import { getRoleHome } from './router/routes'

// Guards
import ProtectedRoute from './router/ProtectedRoute'
import RoleRoute from './router/RoleRoute'

// Shell
import AppLayout from './layouts/AppLayout'

// Error pages (public - no shell)
import ForbiddenPage from './pages/ForbiddenPage'
import NotFoundPage from './pages/NotFoundPage'

// Auth
import LoginPage from './pages/auth/LoginPage'

// Managing Director
import DashboardPage from './pages/dashboard/DashboardPage'

// AR Specialist (Jasper)
import InvoiceListPage from './pages/invoices/InvoiceListPage'
import PricingContractPage from './pages/invoices/PricingContractPage'
import ServiceMemoListPage from './pages/memos/ServiceMemoListPage'

// AP Specialist (Kwan Hua)
import VendorInvoiceListPage from './pages/vendor/VendorInvoiceListPage'
import XeroConnectPage from './pages/vendor/XeroConnectPage'

// Quotations Specialist (Zheng Bao)
import BookingListPage from './pages/bookings/BookingListPage'
import IntakeQueuePage from './pages/bookings/IntakeQueuePage'

// Field Crew (Liang Yi)
import ServiceMemoFormPage from './pages/memos/ServiceMemoFormPage'

// Dev only - remove before submission
import UITestPage from './pages/UITestPage'

// Redirects authenticated users to their role's home page
function RoleHomeRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={getRoleHome(user.role)} replace />
}

export default function App() {
  return (
    <Routes>
      {/* ── Public ─────────────────────────────────────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/403"   element={<ForbiddenPage />} />
      <Route path="/404"   element={<NotFoundPage />} />

      {/* Dev only */}
      <Route path="/ui-test" element={<UITestPage />} />

      {/* ── Authenticated shell ─────────────────────────────────────────────── */}
      {/* ProtectedRoute redirects to /login if no valid JWT.                    */}
      {/* AppLayout renders the sidebar and <Outlet /> for page content.         */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>

          {/* Root: redirect to the logged-in user's role home */}
          <Route index element={<RoleHomeRedirect />} />

          {/* ── Managing Director ──────────────────────────────────────────── */}
          <Route element={<RoleRoute roles={['managing_director']} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          {/* ── AR Specialist (Jasper) ─────────────────────────────────────── */}
          <Route element={<RoleRoute roles={['ar_specialist']} />}>
            <Route path="/invoices"           element={<InvoiceListPage />} />
            <Route path="/service-memos"      element={<ServiceMemoListPage />} />
            <Route path="/pricing-contracts"  element={<PricingContractPage />} />
          </Route>

          {/* ── AP Specialist (Kwan Hua) ───────────────────────────────────── */}
          <Route element={<RoleRoute roles={['ap_specialist']} />}>
            <Route path="/vendor-invoices" element={<VendorInvoiceListPage />} />
            <Route path="/xero/connect"    element={<XeroConnectPage />} />
          </Route>

          {/* ── Quotations Specialist (Zheng Bao) ─────────────────────────── */}
          <Route element={<RoleRoute roles={['quotations_specialist']} />}>
            <Route path="/bookings" element={<BookingListPage />} />
            <Route path="/intake-queue" element={<IntakeQueuePage />} />
          </Route>

          {/* ── Field Crew (Liang Yi) ──────────────────────────────────────── */}
          <Route element={<RoleRoute roles={['field_crew']} />}>
            <Route path="/service-memos/new" element={<ServiceMemoFormPage />} />
          </Route>

        </Route>
      </Route>

      {/* ── Catch-all ──────────────────────────────────────────────────────── */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
