import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import {
  listNotifications, getUnreadCount, markNotificationRead, markAllNotificationsRead,
} from '@/api/notifications'

const POLL_MS = 30000

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
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 })
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  // Shared across refreshUnreadCount/handleToggle/handleItemClick/handleMarkAllRead
  // (all four are event handlers or callbacks, not the mount effect itself), so a
  // plain `let cancelled` local to one effect - as used in ReportPage.jsx - can't be
  // seen by the others. A ref set false in the mount effect's cleanup gives every
  // function the same "am I still mounted" check before calling setState post-await.
  const isMountedRef = useRef(true)

  const refreshUnreadCount = useCallback(async () => {
    try {
      const { data } = await getUnreadCount()
      if (isMountedRef.current) setUnreadCount(data.data.count)
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
      setMenuPos({ top: rect.bottom + 8, right: Math.max(8, window.innerWidth - rect.right) })
    }
    setOpen(true)
    setLoadingList(true)
    try {
      const { data } = await listNotifications()
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
      setNotifications((prev) => prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)))
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
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
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
          style={{ position: 'fixed', top: menuPos.top, right: menuPos.right }}
          className="w-80 max-h-96 overflow-y-auto rounded-lg border border-[#E2E8F0] bg-white shadow-lg z-50"
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
