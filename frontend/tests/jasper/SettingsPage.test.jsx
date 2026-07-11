import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import AppLayout from '@/layouts/AppLayout'
import SettingsPage from '@/pages/settings/SettingsPage'

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
}
function makeToken(payload) {
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.fakesignature`
}

const CURRENT_USER = { sub: 7, name: 'Sarah Lim', email: 'sarah@efar.com.sg', role: 'ar_specialist', exp: Math.floor(Date.now() / 1000) + 3600 }

let mock

beforeEach(() => {
  mock = new MockAdapter(api)
  localStorage.setItem('efar_token', makeToken(CURRENT_USER))
})

afterEach(() => {
  mock.reset()
  localStorage.clear()
})

function renderSettingsPage() {
  return render(
    <AuthProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/settings']}>
          <Routes>
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </AuthProvider>
  )
}

describe('SettingsPage - Profile Information card', () => {
  test('pre-fills name and email from the logged-in user', () => {
    renderSettingsPage()
    expect(screen.getByLabelText(/^Name/i)).toHaveValue('Sarah Lim')
    expect(screen.getByLabelText(/^Email/i)).toHaveValue('sarah@efar.com.sg')
  })

  test('successful update shows a success toast and stores the new token', async () => {
    const user = userEvent.setup()
    const newToken = makeToken({ ...CURRENT_USER, name: 'Sarah Lim-Tan' })
    mock.onPatch('/users/me').reply(200, {
      success: true,
      data: { token: newToken, user: { id: 7, name: 'Sarah Lim-Tan', email: 'sarah@efar.com.sg', role: 'ar_specialist' } },
    })
    renderSettingsPage()

    await user.clear(screen.getByLabelText(/^Name/i))
    await user.type(screen.getByLabelText(/^Name/i), 'Sarah Lim-Tan')
    await user.click(screen.getByRole('button', { name: /Save Profile/i }))

    await screen.findByText('Profile updated successfully.')
    expect(localStorage.getItem('efar_token')).toBe(newToken)
  })

  test('email conflict shows an inline error under the Email field', async () => {
    const user = userEvent.setup()
    mock.onPatch('/users/me').reply(409, {
      success: false, code: 'EMAIL_IN_USE', message: 'An account with this email already exists.',
    })
    renderSettingsPage()

    await user.clear(screen.getByLabelText(/^Email/i))
    await user.type(screen.getByLabelText(/^Email/i), 'taken@efar.com.sg')
    await user.click(screen.getByRole('button', { name: /Save Profile/i }))

    await screen.findByText('An account with this email already exists.')
  })
})

describe('SettingsPage - Change Password card', () => {
  test('successful change clears the fields and shows a success toast', async () => {
    const user = userEvent.setup()
    mock.onPatch('/users/me/password').reply(200, { success: true, data: { message: 'Password updated successfully.' } })
    renderSettingsPage()

    await user.type(screen.getByLabelText(/Current Password/i), 'oldpass1')
    await user.type(screen.getByLabelText(/^New Password/i), 'newpass1')
    await user.type(screen.getByLabelText(/Confirm New Password/i), 'newpass1')
    await user.click(screen.getByRole('button', { name: /Save Password/i }))

    await screen.findByText('Password updated successfully.')
    expect(screen.getByLabelText(/Current Password/i)).toHaveValue('')
  })

  test('mismatched confirmation shows a client-side validation error', async () => {
    const user = userEvent.setup()
    renderSettingsPage()

    await user.type(screen.getByLabelText(/Current Password/i), 'oldpass1')
    await user.type(screen.getByLabelText(/^New Password/i), 'newpass1')
    await user.type(screen.getByLabelText(/Confirm New Password/i), 'different1')
    await user.click(screen.getByRole('button', { name: /Save Password/i }))

    await screen.findByText('Passwords must match')
  })

  test('wrong current password shows an inline error and keeps the fields filled', async () => {
    const user = userEvent.setup()
    mock.onPatch('/users/me/password').reply(401, { success: false, code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.' })
    renderSettingsPage()

    await user.type(screen.getByLabelText(/Current Password/i), 'wrongpass')
    await user.type(screen.getByLabelText(/^New Password/i), 'newpass1')
    await user.type(screen.getByLabelText(/Confirm New Password/i), 'newpass1')
    await user.click(screen.getByRole('button', { name: /Save Password/i }))

    await screen.findByText('Incorrect password.')
    expect(screen.getByLabelText(/Current Password/i)).toHaveValue('wrongpass')
  })
})

describe('AppLayout sidebar entry point', () => {
  test('clicking the user footer navigates to /settings', async () => {
    const user = userEvent.setup()
    localStorage.setItem('efar_token', makeToken({ sub: 1, name: 'Doris Tan', email: 'doris@efar.com.sg', role: 'managing_director', exp: Math.floor(Date.now() / 1000) + 3600 }))

    render(
      <AuthProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<div>Dashboard Stub</div>} />
              <Route path="/settings" element={<div>Settings Stub</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </AuthProvider>
    )

    await user.click(screen.getByText('Doris Tan'))
    await screen.findByText('Settings Stub')
  })
})
