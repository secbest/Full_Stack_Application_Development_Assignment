// Personal account settings: profile edit + password change.
// docs/superpowers/specs/2026-07-11-account-settings-page-design.md
import api from './index'

export async function updateProfile({ name, email }) {
  const res = await api.patch('/users/me', { name, email })
  return res.data.data // { token, user }
}

export async function updatePassword({ currentPassword, newPassword }) {
  const res = await api.patch('/users/me/password', { currentPassword, newPassword })
  return res.data.data // { message, token } - token is re-signed since the backend bumps token_version on a password change
}

// Accounts Management (managing_director only).
export async function listAccounts() {
  const res = await api.get('/users')
  return res.data.data // [{ id, name, email, role, last_login_at, last_active_at, is_online, is_locked }]
}

export async function updateUser(id, { name, email, role }) {
  const res = await api.patch(`/users/${id}`, { name, email, role })
  return res.data.data // { id, name, email, role }
}

export async function forceLogoutUser(id) {
  const res = await api.post(`/users/${id}/force-logout`)
  return res.data.data // { message }
}

export async function unlockUser(id) {
  const res = await api.post(`/users/${id}/unlock`)
  return res.data.data // { message }
}
