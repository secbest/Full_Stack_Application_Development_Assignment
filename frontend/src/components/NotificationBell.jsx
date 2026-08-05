import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import {
  listNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead,
} from '@/api/notifications'

const POLL_MS = 30000
const MENU_WIDTH = 320
const VIEWPORT_GUTTER = 8

function formatRelativeTime(isoString) {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - new Date(isoString).getTime()) / 1000))
  if (diffSeconds < 60) return 'just now'
  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} min ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hr ago`
  return `${Math.floor(diffHours / 24)}d ago`
}

// Bell + unread badge shared by every role's chrome (AppLayout mounts it in both the
// desktop sidebar header and the mobile top bar). The dropdown is rendered through a
// portal into document.body rather than as a normal child: the sidebar <aside> sets
// both `overflow-hidden` and (from the md breakpoint up) a permanent `translate-x-0`
// transform, and any `transform` on an ancestor becomes the containing block for a
// `position: fixed` descendant - without the portal the dropdown would be clipped to
// the sidebar's own bounds instead of floating over the page.
export function NotificationBell() {
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [menuPos, setMenuPos] = useState({ top: 0, left: VIEWPORT_GUTTER })
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  // Shared across refreshUnreadCount/handleToggle/handleItemClick/handleMarkAllRead
  // (all four are event handlers or callbacks, not the mount effect itself), so a
  // plain `let cancelled` local to one effect - as used in ReportPage.jsx - can't be
  // seen by the others. A ref set false in the mount effect's cleanup gives every
  // function the same "am I still mounted" check before calling setState post-await.
  const isMountedRef = useRef(true)
  // Guards against an in-flight unread-count request resolving after a newer one has
  // been issued (or after a local optimistic update). Without this, a poll tick fired
  // just before "Mark all as read" can still be awaiting its response when the click's
  // optimistic setUnreadCount(0) runs, then land afterwards and clobber it back to the
  // stale pre-mark-all count. Every call bumps the token before awaiting and both the
  // request and any optimistic write check the token still matches before applying -
  // whichever happens last wins, instead of whichever network response arrives last.
  const unreadCountTokenRef = useRef(0)

  const refreshUnreadCount = useCallback(async () => {
    const token = ++unreadCountTokenRef.current
    try {
      const { data } = await getUnreadCount()
      if (isMountedRef.current && unreadCountTokenRef.current === token) setUnreadCount(data.data.count)
    } catch {
      // Degrade quietly - keep the last known count, the next poll will recover it.
    }
  }, [])

  // Fetch at mount (this is what satisfies "notified when she logs in"), then re-poll
  // every 30s so a notification created while already logged in still surfaces.
  // Paused while the tab is hidden so a backgrounded session doesn't hold a Supabase
  // connection open all day, and refetched immediately on becoming visible again.
  useEffect(() => {
    isMountedRef.current = true
    refreshUnreadCount()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refreshUnreadCount()
    }, POLL_MS)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') refreshUnreadCount()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      isMountedRef.current = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refreshUnreadCount])

  useEffect(() => {
    if (!open) return undefined
    function handleClickOutside(e) {
      const clickedButton = buttonRef.current && buttonRef.current.contains(e.target)
      const clickedMenu = menuRef.current && menuRef.current.contains(e.target)
      if (!clickedButton && !clickedMenu) setOpen(false)
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    function handleResize() {
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', handleResize)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', handleResize)
    }
  }, [open])

  async function handleToggle() {
    if (open) {
      setOpen(false)
      return
    }
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      // Align the panel's right edge with the bell when space permits, then clamp it
      // inside the viewport. This matters on desktop, where the bell sits near the
      // left edge inside the sidebar and an unclamped right alignment renders most of
      // the 320px panel off-screen.
      const preferredLeft = rect.right - MENU_WIDTH
      const maxLeft = Math.max(VIEWPORT_GUTTER, window.innerWidth - MENU_WIDTH - VIEWPORT_GUTTER)
      const left = Math.min(Math.max(VIEWPORT_GUTTER, preferredLeft), maxLeft)
      setMenuPos({ top: rect.bottom + VIEWPORT_GUTTER, left })
    }
    setOpen(true)
    setLoadingList(true)
    try {
      // unread_only: once something is read it drops out of the dropdown - the list
      // is a to-do queue, not a history log.
      const { data } = await listNotifications({ unread_only: 'true' })
      if (isMountedRef.current) setNotifications(data.data)
    } catch {
      if (isMountedRef.current) setNotifications([])
    } finally {
      if (isMountedRef.current) setLoadingList(false)
    }
  }

  async function handleItemClick(notification) {
    setOpen(false)
    if (!notification.is_read) {
      unreadCountTokenRef.current += 1
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id))
      setUnreadCount((prev) => Math.max(0, prev - 1))
      try {
        await markNotificationRead(notification.id)
      } catch {
        refreshUnreadCount()
      }
    }
    if (notification.link) navigate(notification.link)
  }

  async function handleMarkAllRead() {
    unreadCountTokenRef.current += 1
    setNotifications([])
    setUnreadCount(0)
    try {
      await markAllNotificationsRead()
    } catch {
      refreshUnreadCount()
    }
  }

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={open}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        className="relative p-2 rounded-md text-slate-300 hover:bg-[#0F172A] hover:text-white transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-[10px] font-semibold text-white leading-none">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="dialog"
          aria-label="Notifications panel"
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
          className="w-80 max-w-[calc(100vw-1rem)] max-h-96 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white shadow-lg z-50"
        >
          {loadingList ? (
            <p className="px-4 py-6 text-sm text-center text-[#64748B]">Loading...</p>
          ) : notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-[#64748B]">No notifications yet.</p>
          ) : (
            <>
              <ul>
                {notifications.map((n) => (
                  <li key={n.id} className="border-b border-[#E2E8F0] last:border-b-0">
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className="w-full text-left px-4 py-3 hover:bg-[#F1F5F9] transition-colors flex items-start gap-2"
                    >
                      {!n.is_read && (
                        <span className="mt-1.5 w-2 h-2 rounded-full bg-[#3B82F6] flex-shrink-0" aria-hidden="true" />
                      )}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-medium text-[#1E293B]">{n.title}</span>
                        {n.body && <span className="block text-xs text-[#64748B] mt-0.5 line-clamp-2">{n.body}</span>}
                        <span className="block text-xs text-[#94A3B8] mt-1">{formatRelativeTime(n.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="w-full px-4 py-2.5 text-sm text-center text-[#3B82F6] hover:bg-[#F1F5F9] transition-colors"
              >
                Mark all as read
              </button>
            </>
          )}
        </div>,
        document.body
      )}
    </>
  )
}
