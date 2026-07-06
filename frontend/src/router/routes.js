import {
  LayoutDashboard,
  Receipt,
  ClipboardList,
  BadgeDollarSign,
  Building2,
  Plug,
  CalendarDays,
  FilePlus,
} from 'lucide-react'

// NAV_ROUTES drives both the sidebar nav in AppLayout and the route tree in App.jsx.
// To add a new route: add an entry here, then add the <Route> in App.jsx.
export const NAV_ROUTES = [
  // ── Managing Director ────────────────────────────────────────────────────────
  {
    path: '/dashboard',
    label: 'Dashboard',
    Icon: LayoutDashboard,
    roles: ['managing_director'],
  },

  // ── AR Specialist (Jasper) ───────────────────────────────────────────────────
  {
    path: '/invoices',
    label: 'Invoices',
    Icon: Receipt,
    roles: ['ar_specialist'],
  },
  {
    path: '/service-memos',
    label: 'Memo Review',
    Icon: ClipboardList,
    roles: ['ar_specialist'],
  },
  {
    path: '/pricing-contracts',
    label: 'Pricing Contracts',
    Icon: BadgeDollarSign,
    roles: ['ar_specialist'],
  },

  // ── AP Specialist (Kwan Hua) ─────────────────────────────────────────────────
  {
    path: '/vendor-invoices',
    label: 'Vendor Invoices',
    Icon: Building2,
    roles: ['ap_specialist'],
  },
  {
    path: '/xero/connect',
    label: 'Xero Connection',
    Icon: Plug,
    roles: ['ap_specialist'],
  },

  // ── Quotations Specialist (Zheng Bao) ────────────────────────────────────────
  {
    path: '/intake-queue',
    label: 'Intake Queue',
    Icon: CalendarDays,
    roles: ['quotations_specialist'],
  },
  {
    path: '/bookings',
    label: 'Bookings',
    Icon: CalendarDays,
    roles: ['quotations_specialist'],
  },

  // ── Field Crew (Liang Yi) ────────────────────────────────────────────────────
  {
    path: '/service-memos/new',
    label: 'New Memo',
    Icon: FilePlus,
    roles: ['field_crew'],
  },
]

// Default landing page per role after login
export const ROLE_HOMES = {
  managing_director:     '/dashboard',
  ar_specialist:         '/invoices',
  ap_specialist:         '/vendor-invoices',
  quotations_specialist: '/intake-queue',
  field_crew:            '/service-memos/new',
}

export function getRoleHome(role) {
  return ROLE_HOMES[role] ?? '/login'
}
