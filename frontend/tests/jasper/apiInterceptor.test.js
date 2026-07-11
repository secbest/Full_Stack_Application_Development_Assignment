// Owner: Jasper - Account Settings bug fix (Task 4 follow-up).
// docs/superpowers/plans/2026-07-11-account-settings-page.md
//
// The global response interceptor in src/api/index.js redirects to /login and wipes the
// stored token on ANY 401, except requests to /auth/login (a 401 there means "wrong
// credentials on the login form", not "session expired"). PATCH /users/me/password also
// returns a 401 INVALID_CREDENTIALS for "wrong current password" - not an expired session -
// but the interceptor was clearing the valid session token and redirecting before
// SettingsPage's inline "Incorrect password." handling ever got a chance to run. These
// tests pin down the exclusion (and its non-regression on real 401s) directly against the
// real api instance, same pattern as ContractFormPage.test.jsx.
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'

let mock
let originalLocation

beforeEach(() => {
  mock = new MockAdapter(api)
  localStorage.setItem('efar_token', 'some-token')
  localStorage.setItem('efar_user', '{"id":1}')

  // jsdom doesn't implement real navigation, and assigning to window.location.href
  // directly logs "Not implemented: navigation" noise - swap in a plain writable object
  // for the duration of each test so we can assert on it cleanly, then restore it.
  originalLocation = window.location
  delete window.location
  window.location = { href: '' }
})

afterEach(() => {
  mock.reset()
  localStorage.clear()
  window.location = originalLocation
})

describe('api response interceptor - 401 auto-logout exclusions', () => {
  test('PATCH /users/me/password 401 (wrong current password) does not clear the token or redirect', async () => {
    mock.onPatch('/users/me/password').reply(401, {
      success: false, code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect.',
    })

    await expect(
      api.patch('/users/me/password', { currentPassword: 'wrong', newPassword: 'newpass1' })
    ).rejects.toMatchObject({ response: { status: 401 } })

    expect(localStorage.getItem('efar_token')).toBe('some-token')
    expect(window.location.href).toBe('')
  })

  test('regression guard: a 401 on any other authenticated endpoint still clears the token and redirects', async () => {
    mock.onGet('/invoices').reply(401, { success: false, code: 'UNAUTHORIZED', message: 'Session expired.' })

    await expect(api.get('/invoices')).rejects.toMatchObject({ response: { status: 401 } })

    expect(localStorage.getItem('efar_token')).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  test('regression guard: POST /auth/login 401 (wrong credentials) still does not redirect', async () => {
    mock.onPost('/auth/login').reply(401, { success: false, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' })

    await expect(api.post('/auth/login', { email: 'a@b.com', password: 'wrong' })).rejects.toMatchObject({
      response: { status: 401 },
    })

    expect(localStorage.getItem('efar_token')).toBe('some-token')
    expect(window.location.href).toBe('')
  })
})
