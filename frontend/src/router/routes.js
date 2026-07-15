import {
  LayoutDashboard,
  Receipt,
  ClipboardList,
  BadgeDollarSign,
  Building2,
  Plug,
  CalendarDays,
  BookOpen,
  Briefcase,
  History,
  FileBarChart,
  Users,
  Settings,
} from 'lucide-react'

// NAV_ROUTES drives both the sidebar nav in AppLayout and the route tree in App.jsx.
// To add a new route: add an entry here, then add the <Route> in App.jsx.
// `sub` is the secondary supporting line rendered under `label` as a two-line
// list item in the sidebar (Material-style primary + secondary text).
export const NAV_ROUTES = [
  // ── Managing Director ────────────────────────────────────────────────────────
  {
    path: '/dashboard',
    label: 'Dashboard',
    sub: 'Executive overview',
    Icon: LayoutDashboard,
    roles: ['managing_director'],
  },
  {
    path: '/reports',
    label: 'Reports',
    sub: 'Revenue & expenses',
    Icon: FileBarChart,
    roles: ['managing_director'],
  },
  {
    path: '/management',
    label: 'Accounts Management',
    sub: 'Users & access',
    Icon: Users,
    roles: ['managing_director'],
  },

  // ── AR Specialist (design Jasper; Wave 3 implemented by Kwan Hua) ─────────────
  {
    path: '/invoices',
    label: 'Invoices',
    sub: 'Match & sync to Xero',
    Icon: Receipt,
    roles: ['ar_specialist'],
  },
  {
    path: '/service-memos',
    label: 'Memo Review',
    sub: 'Approve & match',
    Icon: ClipboardList,
    roles: ['ar_specialist'],
  },
  {
    path: '/pricing-contracts',
    label: 'Pricing Contracts',
    sub: 'Rates & surcharges',
    Icon: BadgeDollarSign,
    roles: ['ar_specialist'],
  },

  // ── AP Specialist (Kwan Hua) ─────────────────────────────────────────────────
  {
    path: '/vendor-invoices',
    label: 'Vendor Invoices',
    sub: 'OCR & rebates',
    Icon: Building2,
    roles: ['ap_specialist'],
  },

  // ── Shared: Xero settings + sync status (Kwan Hua) ───────────────────────────
  // Connect/disconnect actions inside are gated to managing_director; AP/AR see a
  // read-only status card. Sync status is the shared retry panel for both queues.
  {
    path: '/settings/xero',
    label: 'Xero Connection',
    sub: 'Integration settings',
    Icon: Plug,
    roles: ['managing_director', 'ap_specialist', 'ar_specialist'],
  },
  {
    path: '/xero/sync-status',
    label: 'Xero Sync Status',
    sub: 'Retry & status',
    Icon: History,
    roles: ['ap_specialist', 'ar_specialist'],
  },

  // ── Quotations Specialist (Zheng Bao) ────────────────────────────────────────
  {
    path: '/intake-queue',
    label: 'Intake Queue',
    sub: 'Review requests',
    Icon: CalendarDays,
    roles: ['quotations_specialist'],
  },
  {
    path: '/bookings',
    label: 'Bookings',
    sub: 'Manage & assign',
    Icon: BookOpen,
    roles: ['quotations_specialist'],
  },

  // ── Field Crew (Liang Yi, implemented by Jasper) ──────────────────────────────
  {
    path: '/jobs',
    label: 'My Jobs',
    sub: 'Assigned jobs',
    Icon: Briefcase,
    roles: ['field_crew'],
  },
  {
    path: '/memos/history',
    label: 'Memo History',
    sub: 'Past submissions',
    Icon: History,
    roles: ['field_crew'],
  },

  // ── Shared: Account Settings (every role) ─────────────────────────────────────
  {
    path: '/settings',
    label: 'Settings',
    sub: 'Profile & password',
    Icon: Settings,
    roles: ['managing_director', 'ar_specialist', 'ap_specialist', 'quotations_specialist', 'field_crew'],
  },
]

// Default landing page per role after login.
// CLAUDE.md: "My Jobs" is always the first screen for field crew - there is no separate
// dashboard for this role, and no standalone "create memo" entry point outside a job card.
export const ROLE_HOMES = {
  managing_director:     '/dashboard',
  ar_specialist:         '/invoices',
  ap_specialist:         '/vendor-invoices',
  quotations_specialist: '/intake-queue',
  field_crew:            '/jobs',
}

export function getRoleHome(role) {
  return ROLE_HOMES[role] ?? '/login'
}
