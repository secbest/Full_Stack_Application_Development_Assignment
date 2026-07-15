import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Activity, LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useAuth } from '@/hooks'
import { NAV_ROUTES } from '@/router/routes'
import { Button } from '@/components/ui/button'

const SIDEBAR_KEY = 'efar.sidebarCollapsed'

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

  // Collapsed state persists across sessions so the layout the user picked sticks.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  const visibleRoutes = NAV_ROUTES.filter(r => r.roles.includes(user?.role))
  const roleMeta = ROLE_META[user?.role] ?? { label: user?.role ?? '', badge: 'bg-gray-100 text-gray-700' }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      {/* Full-panel dark background per CLAUDE.md ("Sidebar bg: #1E293B") and every
          Figma Make screen (shared.tsx's <Sidebar> sets this on the whole <aside>, not
          just a header strip) - previously only the header row was dark, and at the
          wrong hex (#1B2336). */}
      <aside
        className={`${collapsed ? 'w-[68px]' : 'w-60'} flex-shrink-0 flex flex-col bg-[#1E293B]
          overflow-hidden transition-[width] duration-300 ease-in-out`}
      >
        {/* Brand header - collapses to just the mark, with the toggle beside/below it. */}
        <div
          className={`flex items-center px-4 py-[18px] border-b border-white/10 ${
            collapsed ? 'justify-center' : 'gap-2.5'
          }`}
        >
          <Activity className={`${collapsed ? 'w-5 h-5' : 'w-4 h-4'} text-teal-400 flex-shrink-0`} />
          {!collapsed && (
            <>
              <span className="text-sm font-semibold tracking-wide text-white whitespace-nowrap">
                EFAR Platform
              </span>
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse sidebar"
                title="Collapse sidebar"
                className="ml-auto p-1 rounded-md text-slate-400 hover:bg-[#0F172A] hover:text-white transition-colors"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Expand control - only shown while collapsed, sits at the top of the rail. */}
        {collapsed && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
              className="p-2 rounded-md text-slate-400 hover:bg-[#0F172A] hover:text-white transition-colors"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Nav links - two-line list items when expanded; icon-only rail with hover
            tooltips when collapsed. */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {visibleRoutes.map(({ path, label, sub, Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/settings'}
              title={collapsed ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-[#0F172A] text-white'
                    : 'text-slate-300 hover:bg-[#0F172A] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`${collapsed ? 'w-5 h-5' : 'w-4 h-4'} flex-shrink-0`} />
                  {!collapsed && (
                    <span className="flex flex-col min-w-0 leading-tight">
                      <span className="text-sm font-medium truncate">{label}</span>
                      {sub && (
                        <span className={`text-xs truncate ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                          {sub}
                        </span>
                      )}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer - also links to /settings, alongside the NAV_ROUTES entry above */}
        <div className="px-3 py-3 border-t border-white/10 space-y-2">
          <NavLink
            to="/settings"
            end
            title={collapsed ? user?.name : undefined}
            className={({ isActive }) =>
              `block rounded-md transition-colors ${collapsed ? 'p-2' : 'px-3 py-1'} ${
                isActive ? 'bg-[#0F172A]' : 'hover:bg-[#0F172A]'
              }`
            }
          >
            {collapsed ? (
              <span className="flex items-center justify-center w-full h-5 text-sm font-semibold text-white">
                {user?.name?.[0]?.toUpperCase() ?? '?'}
              </span>
            ) : (
              <>
                <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${roleMeta.badge}`}>
                  {roleMeta.label}
                </span>
              </>
            )}
          </NavLink>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={`w-full gap-2 text-slate-300 hover:bg-[#0F172A] hover:text-white ${
              collapsed ? 'justify-center px-0' : 'justify-start'
            }`}
          >
            <LogOut className={collapsed ? 'w-5 h-5' : 'w-4 h-4'} />
            {!collapsed && 'Sign out'}
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
