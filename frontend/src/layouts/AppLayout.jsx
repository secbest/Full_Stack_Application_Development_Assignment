import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Activity, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks'
import { NAV_ROUTES } from '@/router/routes'
import { Button } from '@/components/ui/button'

const ROLE_META = {
  managing_director:     { label: 'Managing Director', badge: 'bg-blue-100 text-blue-700' },
  ar_specialist:         { label: 'AR Specialist',     badge: 'bg-emerald-100 text-emerald-700' },
  ap_specialist:         { label: 'AP Specialist',     badge: 'bg-amber-100 text-amber-700' },
  quotations_specialist: { label: 'Quotations Spec',   badge: 'bg-violet-100 text-violet-700' },
  field_crew:            { label: 'Field Crew',        badge: 'bg-slate-100 text-slate-700' },
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const visibleRoutes = NAV_ROUTES.filter(r => r.roles.includes(user?.role))
  const roleMeta = ROLE_META[user?.role] ?? { label: user?.role ?? '', badge: 'bg-gray-100 text-gray-700' }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-[#1B2336] border-r border-border">
        {/* Brand header */}
        <div className="flex items-center gap-2.5 px-5 py-[18px] bg-[#1B2336]">
          <Activity className="w-4 h-4 text-teal-400 flex-shrink-0" />
          <span className="text-sm font-semibold tracking-wide text-white">EFAR Platform</span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {visibleRoutes.map(({ path, label, Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'text-white hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-3 border-t border-border space-y-2">
          <div className="px-3 py-1">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-300 truncate">{user?.email}</p>
            <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${roleMeta.badge}`}>
              {roleMeta.label}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-white hover:bg-white/10 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
