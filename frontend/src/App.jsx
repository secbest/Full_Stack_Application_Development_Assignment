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

// Public intake portal (no login required - see design/figma-make-prompts.md's
// "Public Intake Form Note"; POST /api/intake is unauthenticated on the backend)
import PublicIntakeFormPage from './pages/intake/PublicIntakeFormPage'

// Managing Director
import DashboardPage from './pages/dashboard/DashboardPage'
import ReportPage from './pages/dashboard/ReportPage'
import RevenueLeakagePage from './pages/dashboard/RevenueLeakagePage'
import ManagementPage from './pages/dashboard/Management'
import FleetTrackerPage from './pages/dashboard/FleetTrackerPage'
import SettingsPage from './pages/settings/SettingsPage'

// AR Specialist (design Jasper; Wave 3 implemented by Kwan Hua)
import InvoiceListPage from './pages/invoices/InvoiceListPage'
import InvoiceDetailPage from './pages/invoices/InvoiceDetailPage'
import PricingContractPage from './pages/invoices/PricingContractPage'
import ContractDetailPage from './pages/invoices/ContractDetailPage'
import ContractFormPage from './pages/invoices/ContractFormPage'
import ServiceMemoListPage from './pages/memos/ServiceMemoListPage'

// AP Specialist (Kwan Hua)
import VendorInvoiceListPage from './pages/vendor/VendorInvoiceListPage'
import VendorInvoiceReviewPage from './pages/vendor/VendorInvoiceReviewPage'
import XeroConnectPage from './pages/vendor/XeroConnectPage'
import XeroSyncStatusPage from './pages/vendor/XeroSyncStatusPage'

// Quotations Specialist (Zheng Bao)
import BookingListPage from './pages/bookings/BookingListPage'
import IntakeQueuePage from './pages/bookings/IntakeQueuePage'

// Field Crew (Liang Yi, implemented by Jasper - see README)
import MyJobsPage from './pages/jobs/MyJobsPage'
import MemoWizardPage from './pages/jobs/memo-wizard/MemoWizardPage'
import MemoHistoryPage from './pages/memos/MemoHistoryPage'

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
      <Route path="/login"  element={<LoginPage />} />
      <Route path="/intake" element={<PublicIntakeFormPage />} />
      <Route path="/403"    element={<ForbiddenPage />} />
      <Route path="/404"    element={<NotFoundPage />} />

      {/* Dev only */}
      <Route path="/ui-test" element={<UITestPage />} />

      {/* ── Authenticated shell ─────────────────────────────────────────────── */}
      {/* ProtectedRoute redirects to /login if no valid JWT.                    */}
      {/* AppLayout renders the sidebar and <Outlet /> for page content.         */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>

          {/* Root: redirect to the logged-in user's role home */}
          <Route index element={<RoleHomeRedirect />} />

          {/* Account Settings: every authenticated role, no RoleRoute restriction. */}
          <Route path="/settings" element={<SettingsPage />} />

          {/* ── Managing Director ──────────────────────────────────────────── */}
          <Route element={<RoleRoute roles={['managing_director']} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/reports" element={<ReportPage />} />
            <Route path="/management" element={<ManagementPage />} />
            <Route path="/fleet-tracker" element={<FleetTrackerPage />} />
          </Route>

          {/* ── Revenue Leakage report (Kwan Hua): MD reads it, AR acts on it ─ */}
          <Route element={<RoleRoute roles={['managing_director', 'ar_specialist']} />}>
            <Route path="/reports/revenue-leakage" element={<RevenueLeakagePage />} />
          </Route>

          {/* ── AR Specialist (design Jasper; Wave 3 by Kwan Hua) ──────────── */}
          <Route element={<RoleRoute roles={['ar_specialist']} />}>
            <Route path="/invoices"           element={<InvoiceListPage />} />
            <Route path="/invoices/:id"       element={<InvoiceDetailPage />} />
            <Route path="/service-memos"      element={<ServiceMemoListPage />} />
            <Route path="/pricing-contracts"           element={<PricingContractPage />} />
            <Route path="/pricing-contracts/new"       element={<ContractFormPage />} />
            <Route path="/pricing-contracts/:id"       element={<ContractDetailPage />} />
            <Route path="/pricing-contracts/:id/edit"  element={<ContractFormPage />} />
          </Route>

          {/* ── AP Specialist (Kwan Hua) ───────────────────────────────────── */}
          {/* Doris needs read-only access to the AP queue to connect the invoice inbox
              and view vendor spend; AP-only write controls remain guarded by the API. */}
          <Route element={<RoleRoute roles={['ap_specialist', 'managing_director']} />}>
            <Route path="/vendor-invoices"     element={<VendorInvoiceListPage />} />
          </Route>
          <Route element={<RoleRoute roles={['ap_specialist']} />}>
            <Route path="/vendor-invoices/:id" element={<VendorInvoiceReviewPage />} />
          </Route>

          {/* ── Shared: Xero settings + sync status (Kwan Hua) ──────────────── */}
          {/* /settings/xero must match xeroController.js's hardcoded OAuth callback
              redirect target exactly - see design/kwan-hua/api-documentation.md UC-01. */}
          <Route element={<RoleRoute roles={['managing_director', 'ap_specialist', 'ar_specialist']} />}>
            <Route path="/settings/xero"    element={<XeroConnectPage />} />
            <Route path="/xero/sync-status" element={<XeroSyncStatusPage />} />
          </Route>

          {/* ── Quotations Specialist (Zheng Bao) ─────────────────────────── */}
          <Route element={<RoleRoute roles={['quotations_specialist']} />}>
            <Route path="/bookings" element={<BookingListPage />} />
            <Route path="/intake-queue" element={<IntakeQueuePage />} />
          </Route>

          {/* ── Field Crew (Liang Yi, implemented by Jasper) ────────────────── */}
          <Route element={<RoleRoute roles={['field_crew']} />}>
            <Route path="/jobs" element={<MyJobsPage />} />
            <Route path="/jobs/:bookingId/memo" element={<MemoWizardPage />} />
            <Route path="/memos/history" element={<MemoHistoryPage />} />
          </Route>

        </Route>
      </Route>

      {/* ── Catch-all ──────────────────────────────────────────────────────── */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
