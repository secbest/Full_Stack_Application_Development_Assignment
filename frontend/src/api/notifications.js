// Notification bell API calls. Reuses the shared `api` axios instance (src/api/index.js)
// rather than a new one - it already attaches the JWT bearer token and redirects to
// /login on a real 401.
import api from './index'

export function listNotifications(params) {
  return api.get('/notifications', { params })
}

export function getUnreadCount() {
  return api.get('/notifications/unread-count')
}

export function markNotificationRead(id) {
  return api.patch(`/notifications/${id}/read`)
}

export function markAllNotificationsRead() {
  return api.patch('/notifications/read-all')
}
