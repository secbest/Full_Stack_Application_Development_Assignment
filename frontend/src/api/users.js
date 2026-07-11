// Personal account settings: profile edit + password change.
// docs/superpowers/specs/2026-07-11-account-settings-page-design.md
import api from './index'

export async function updateProfile({ name, email }) {
  const res = await api.patch('/users/me', { name, email })
  return res.data.data // { token, user }
}

export async function updatePassword({ currentPassword, newPassword }) {
  const res = await api.patch('/users/me/password', { currentPassword, newPassword })
  return res.data.data // { message }
}
