import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Activity, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useAuth, useIsMobile } from '@/hooks'
import { NAV_ROUTES } from '@/router/routes'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/components/NotificationBell'

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
  const location = useLocation()

  // Below `md` the sidebar stops being part of the page flow and becomes an off-canvas
  // drawer: a fixed 240px rail left the field crew ~135px of usable width on a phone.
  // This needs JS rather than pure CSS because the drawer carries state - it has to close
  // itself on navigation, on Escape, and it must not claim dialog semantics on desktop.
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Collapsed state persists across sessions so the layout the user picked sticks.
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  // Collapsing to an icon rail is a desktop-only affordance - an overlay drawer is either
  // open at full width or not shown at all, so the stored preference is ignored on mobile
  // rather than overwritten (widening the window restores whatever the user chose).
  const showRail = collapsed && !isMobile

  // Growing past the breakpoint with the drawer open would otherwise leave a dialog and a
  // locked body behind on a layout that no longer has a drawer at all.
  useEffect(() => {
    if (!isMobile) setDrawerOpen(false)
  }, [isMobile])

  // Any route change closes the drawer, so tapping a link does not leave the overlay
  // sitting on top of the screen the user just asked for.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  // Stop the page behind the drawer scrolling under the user's finger. The previous value
  // is restored rather than cleared, in case anything else set it.
  useEffect(() => {
    if (!isMobile || !drawerOpen) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [isMobile, drawerOpen])

  const visibleRoutes = NAV_ROUTES.filter(r => r.roles.includes(user?.role))
  const roleMeta = ROLE_META[user?.role] ?? { label: user?.role ?? '', badge: 'bg-gray-100 text-gray-700' }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Mobile top bar ───────────────────────────────────────────────────────
          Replaces the sidebar as the persistent chrome under `md`. Fixed rather than
          in-flow so a long wizard step scrolls under it instead of pushing it away.

          Gated on isMobile rather than only `md:hidden` so desktop does not carry a
          hamburger in its DOM at all - it keeps the two navigation affordances mutually
          exclusive in the accessibility tree, not just visually. The class is kept as
          well, so a stale breakpoint read can never paint two navigations at once. */}
      {isMobile && (
        <header className="md:hidden fixed top-0 inset-x-0 z-30 h-14 flex items-center gap-3 px-4 bg-[#1E293B]">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={drawerOpen}
            aria-controls="app-sidebar"
            className="-ml-1 p-2 rounded-md text-slate-300 hover:bg-[#0F172A] hover:text-white transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Activity className="w-4 h-4 text-teal-400 flex-shrink-0" />
          <span className="text-sm font-semibold tracking-wide text-white">EFAR Platform</span>
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>
      )}

      {/* Backdrop - only exists while the drawer is actually open on a phone. */}
      {isMobile && drawerOpen && (
        <div
          data-testid="sidebar-backdrop"
          onClick={() => setDrawerOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/50"
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────────────────────
          One markup tree for both breakpoints. Under `md` it is a fixed overlay that
          slides in from the left; from `md` up it is the original in-flow column, with
          the desktop classes left exactly as they were so nothing can regress there.

          Full-panel dark background per CLAUDE.md ("Sidebar bg: #1E293B") and every
          Figma Make screen (shared.tsx's <Sidebar> sets this on the whole <aside>, not
          just a header strip). */}
      <aside
        id="app-sidebar"
        role={isMobile && drawerOpen ? 'dialog' : undefined}
        aria-modal={isMobile && drawerOpen ? 'true' : undefined}
        aria-label="Main navigation"
        aria-hidden={isMobile && !drawerOpen ? 'true' : undefined}
        className={`
          fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw]
          ${drawerOpen ? 'translate-x-0' : '-translate-x-full'}
          transition-transform duration-300 ease-in-out
          md:static md:z-auto md:max-w-none md:translate-x-0 md:transition-[width]
          ${showRail ? 'md:w-[68px]' : 'md:w-60'}
          flex-shrink-0 flex flex-col bg-[#1E293B] overflow-hidden
        `}
      >
        {/* Brand header - collapses to just the mark on the desktop rail, with the
            toggle beside/below it. On mobile it carries the drawer's close button. */}
        <div
          className={`flex items-center px-4 py-[18px] border-b border-white/10 ${
            showRail ? 'md:justify-center' : 'gap-2.5'
          }`}
        >
          <Activity className={`${showRail ? 'md:w-5 md:h-5' : ''} w-4 h-4 text-teal-400 flex-shrink-0`} />
          {!showRail && (
            <>
              <span className="text-sm font-semibold tracking-wide text-white whitespace-nowrap">
                EFAR Platform
              </span>
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation menu"
                  className="ml-auto p-2 rounded-md text-slate-400 hover:bg-[#0F172A] hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              ) : (
                <>
                  <NotificationBell />
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
            </>
          )}
        </div>

        {/* Desktop rail controls. The bell remains reachable while the sidebar is
            collapsed; this branch never overlaps with the mobile top-bar bell. */}
        {showRail && (
          <div className="flex flex-col items-center gap-1 pt-2">
            <NotificationBell />
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

        {/* Nav links - two-line list items normally; icon-only rail with hover tooltips
            when collapsed on desktop. Taller rows on mobile for a 44px touch target. */}
        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {visibleRoutes.map(({ path, label, sub, Icon }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/settings'}
              title={showRail ? label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 md:py-2 rounded-md transition-colors ${
                  showRail ? 'md:justify-center' : ''
                } ${
                  isActive
                    ? 'bg-[#0F172A] text-white'
                    : 'text-slate-300 hover:bg-[#0F172A] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={`${showRail ? 'md:w-5 md:h-5' : ''} w-4 h-4 flex-shrink-0`} />
                  {!showRail && (
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
            title={showRail ? user?.name : undefined}
            className={({ isActive }) =>
              `block rounded-md transition-colors ${showRail ? 'md:p-2' : 'px-3 py-1'} ${
                isActive ? 'bg-[#0F172A]' : 'hover:bg-[#0F172A]'
              }`
            }
          >
            {showRail ? (
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
            title={showRail ? 'Sign out' : undefined}
            className={`w-full gap-2 text-slate-300 hover:bg-[#0F172A] hover:text-white ${
              showRail ? 'md:justify-center md:px-0' : 'justify-start'
            }`}
          >
            <LogOut className={`${showRail ? 'md:w-5 md:h-5' : ''} w-4 h-4`} />
            {!showRail && 'Sign out'}
          </Button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────────
          pt-14 clears the fixed mobile top bar; from `md` up there is no top bar. */}
      <main className="flex-1 overflow-auto pt-14 md:pt-0">
        <Outlet />
      </main>
    </div>
  )
}
