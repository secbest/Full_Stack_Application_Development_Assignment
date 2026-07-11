# Account Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every role a personal `/settings` page (profile edit + password change), reachable by clicking the sidebar user footer.

**Architecture:** Two new backend `PATCH` endpoints under `/api/users` (profile, password) sharing the existing JWT-based auth; one new shared React page consumed by all 5 roles, wired into the existing single-app/single-layout routing.

**Tech Stack:** Express, Sequelize, Yup, bcryptjs, jsonwebtoken (backend); React, Formik, Yup, Axios, Jest + React Testing Library + axios-mock-adapter (frontend).

## Global Constraints

- Password minimum length is 8 characters, matching `registerSchema` in `backend/src/validators/index.js:8`.
- No email re-verification flow - the project has no email service (CLAUDE.md: "No email confirmations"). Email edits apply immediately.
- Role is never self-editable from this page - role changes remain Managing-Director-only via the existing Accounts Management page.
- Every role can reach and use this page - no `authorise(...)` role restriction on the new endpoints or route, only `authenticate`.
- Use a hyphen (`-`), never an em dash, in any comments or docs this plan adds (CLAUDE.md writing style rule).

---

### Task 1: Backend profile/password validators

**Files:**
- Create: `backend/src/validators/userValidators.js`
- Test: `backend/tests/jasper/userValidators.test.js`

**Interfaces:**
- Produces: `updateProfileSchema` (Yup object: `{ name, email }`), `updatePasswordSchema` (Yup object: `{ currentPassword, newPassword }`) - both consumed by Task 2's routes.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/jasper/userValidators.test.js
const { updateProfileSchema, updatePasswordSchema } = require('../../src/validators/userValidators')

describe('updateProfileSchema', () => {
  test('accepts a valid name and email', async () => {
    await expect(
      updateProfileSchema.validate({ name: 'Jasper Tan', email: 'jasper@efar.com' })
    ).resolves.toEqual({ name: 'Jasper Tan', email: 'jasper@efar.com' })
  })

  test('rejects a missing name', async () => {
    await expect(
      updateProfileSchema.validate({ email: 'jasper@efar.com' })
    ).rejects.toThrow('Name is required')
  })

  test('rejects an invalid email', async () => {
    await expect(
      updateProfileSchema.validate({ name: 'Jasper Tan', email: 'not-an-email' })
    ).rejects.toThrow('Must be a valid email')
  })
})

describe('updatePasswordSchema', () => {
  test('accepts a valid current + new password pair', async () => {
    await expect(
      updatePasswordSchema.validate({ currentPassword: 'oldpass1', newPassword: 'newpass1' })
    ).resolves.toEqual({ currentPassword: 'oldpass1', newPassword: 'newpass1' })
  })

  test('rejects a new password shorter than 8 characters', async () => {
    await expect(
      updatePasswordSchema.validate({ currentPassword: 'oldpass1', newPassword: 'short' })
    ).rejects.toThrow('Password must be at least 8 characters')
  })

  test('rejects a missing current password', async () => {
    await expect(
      updatePasswordSchema.validate({ newPassword: 'newpass1' })
    ).rejects.toThrow('Current password is required')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/jasper/userValidators.test.js`
Expected: FAIL with `Cannot find module '../../src/validators/userValidators'`

- [ ] **Step 3: Write minimal implementation**

```js
// backend/src/validators/userValidators.js
const Yup = require('yup')

// Field rules mirror registerSchema in backend/src/validators/index.js exactly, so a
// value that would be rejected at registration is rejected the same way here.
const updateProfileSchema = Yup.object({
  name: Yup.string().min(2).max(100).required('Name is required'),
  email: Yup.string().email('Must be a valid email').required('Email is required'),
})

const updatePasswordSchema = Yup.object({
  currentPassword: Yup.string().required('Current password is required'),
  newPassword: Yup.string().min(8, 'Password must be at least 8 characters').required('New password is required'),
})

module.exports = { updateProfileSchema, updatePasswordSchema }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/jasper/userValidators.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/src/validators/userValidators.js backend/tests/jasper/userValidators.test.js
git commit -m "Add profile/password validators for account settings"
```

---

### Task 2: Backend `userController` + `userRoutes` (profile update, password change)

**Files:**
- Create: `backend/src/utils/token.js`
- Create: `backend/src/controllers/userController.js`
- Create: `backend/src/routes/userRoutes.js`
- Modify: `backend/src/controllers/authController.js` (use the shared `signToken` instead of its private copy)
- Modify: `backend/src/routes/index.js:7-8` (replace the commented-out placeholder with a real mount)
- Test: `backend/tests/jasper/userController.test.js`

**Interfaces:**
- Consumes: `updateProfileSchema`, `updatePasswordSchema` from Task 1 (used by the route's `validate(...)` middleware, not by the controller directly).
- Produces: `signToken(user)` in `backend/src/utils/token.js` (returns a JWT string - same claim shape as before: `{ sub, name, email, role }`), `updateProfile(req, res)` and `updatePassword(req, res)` in `userController.js`, mounted as `PATCH /api/users/me` and `PATCH /api/users/me/password`.

- [ ] **Step 1: Write the failing test**

```js
// backend/tests/jasper/userController.test.js
// Controller unit tests: models, bcrypt, and the shared token signer are all mocked,
// so these run without a live database - same pattern as contractController.test.js.
const { Op } = require('sequelize')

jest.mock('../../src/models', () => ({
  User: { findOne: jest.fn(), findByPk: jest.fn() },
}))
jest.mock('../../src/utils/token', () => ({
  signToken: jest.fn(() => 'signed.jwt.token'),
}))
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))

const bcrypt = require('bcryptjs')
const { User } = require('../../src/models')
const { signToken } = require('../../src/utils/token')
const { updateProfile, updatePassword } = require('../../src/controllers/userController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => {
  jest.clearAllMocks()
})

let consoleErrorSpy
beforeAll(() => { consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}) })
afterAll(() => { consoleErrorSpy.mockRestore() })

describe('updateProfile (PATCH /api/users/me)', () => {
  test('updates name/email and returns a re-signed token', async () => {
    User.findOne.mockResolvedValue(null)
    const userInstance = { id: 7, name: 'Old Name', email: 'old@efar.com', role: 'ar_specialist', save: jest.fn().mockResolvedValue() }
    User.findByPk.mockResolvedValue(userInstance)

    const req = { user: { sub: 7 }, body: { name: 'New Name', email: 'new@efar.com' } }
    const res = mockRes()

    await updateProfile(req, res)

    expect(userInstance.name).toBe('New Name')
    expect(userInstance.email).toBe('new@efar.com')
    expect(userInstance.save).toHaveBeenCalled()
    expect(signToken).toHaveBeenCalledWith(userInstance)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(jsonBody(res)).toMatchObject({
      success: true,
      data: { token: 'signed.jwt.token', user: { id: 7, name: 'New Name', email: 'new@efar.com', role: 'ar_specialist' } },
    })
  })

  test('rejects with 409 when another user already has the requested email', async () => {
    User.findOne.mockResolvedValue({ id: 99, email: 'taken@efar.com' })

    const req = { user: { sub: 7 }, body: { name: 'New Name', email: 'taken@efar.com' } }
    const res = mockRes()

    await updateProfile(req, res)

    expect(User.findByPk).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(409)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'EMAIL_IN_USE' })
  })

  test('excludes the current user from the email conflict check', async () => {
    User.findOne.mockResolvedValue(null)
    const userInstance = { id: 7, name: 'Old Name', email: 'old@efar.com', role: 'ar_specialist', save: jest.fn().mockResolvedValue() }
    User.findByPk.mockResolvedValue(userInstance)

    const req = { user: { sub: 7 }, body: { name: 'Old Name', email: 'old@efar.com' } }
    await updateProfile(req, mockRes())

    expect(User.findOne).toHaveBeenCalledWith({
      where: { email: 'old@efar.com', id: { [Op.ne]: 7 } },
    })
  })
})

describe('updatePassword (PATCH /api/users/me/password)', () => {
  test('updates the password when the current password is correct', async () => {
    const userInstance = { id: 7, password: 'hashed-old-password', save: jest.fn().mockResolvedValue() }
    User.findByPk.mockResolvedValue(userInstance)
    bcrypt.compare.mockResolvedValue(true)
    bcrypt.hash.mockResolvedValue('hashed-new-password')

    const req = { user: { sub: 7 }, body: { currentPassword: 'oldpass1', newPassword: 'newpass1' } }
    const res = mockRes()

    await updatePassword(req, res)

    expect(bcrypt.compare).toHaveBeenCalledWith('oldpass1', 'hashed-old-password')
    expect(bcrypt.hash).toHaveBeenCalledWith('newpass1', 12)
    expect(userInstance.password).toBe('hashed-new-password')
    expect(userInstance.save).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(jsonBody(res)).toMatchObject({ success: true })
  })

  test('rejects with 401 when the current password is wrong', async () => {
    const userInstance = { id: 7, password: 'hashed-old-password', save: jest.fn() }
    User.findByPk.mockResolvedValue(userInstance)
    bcrypt.compare.mockResolvedValue(false)

    const req = { user: { sub: 7 }, body: { currentPassword: 'wrongpass', newPassword: 'newpass1' } }
    const res = mockRes()

    await updatePassword(req, res)

    expect(userInstance.save).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'INVALID_CREDENTIALS' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest tests/jasper/userController.test.js`
Expected: FAIL with `Cannot find module '../../src/utils/token'` (or `'../../src/controllers/userController'`)

- [ ] **Step 3: Write minimal implementation**

```js
// backend/src/utils/token.js
const jwt = require('jsonwebtoken')

// Shared by authController (register/login) and userController (profile update) -
// every JWT this app issues carries the same claim shape, so a caller only needs to
// know signToken(user), not the individual claim names.
function signToken(user) {
  const secret = process.env.NODE_ENV === 'production'
    ? process.env.JWT_SECRET
    : process.env.DEV_JWT_SECRET
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email, role: user.role },
    secret,
    { expiresIn: '8h' }
  )
}

module.exports = { signToken }
```

Modify `backend/src/controllers/authController.js`: remove lines 1-16 (the `jwt` require and the private `signToken` function) and replace with:

```js
const bcrypt = require('bcryptjs')
const { User } = require('../models')
const { success, created, error } = require('../utils')
const { loginSchema } = require('../validators')
const { signToken } = require('../utils/token')
```

(The rest of `authController.js` - `register`, `login`, `module.exports` - is unchanged; both functions already call `signToken(user)`, which now resolves to the shared import.)

```js
// backend/src/controllers/userController.js
const bcrypt = require('bcryptjs')
const { Op } = require('sequelize')
const { User } = require('../models')
const { success, error, internalError } = require('../utils')
const { signToken } = require('../utils/token')

async function updateProfile(req, res) {
  try {
    const { name, email } = req.body
    const existing = await User.findOne({ where: { email, id: { [Op.ne]: req.user.sub } } })
    if (existing) return error(res, 'An account with this email already exists.', 'EMAIL_IN_USE', 409)

    const user = await User.findByPk(req.user.sub)
    user.name = name
    user.email = email
    await user.save()

    const token = signToken(user)
    return success(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    return internalError(res, err)
  }
}

async function updatePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body
    const user = await User.findByPk(req.user.sub)
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) return error(res, 'Current password is incorrect.', 'INVALID_CREDENTIALS', 401)

    user.password = await bcrypt.hash(newPassword, 12)
    await user.save()

    return success(res, { message: 'Password updated successfully.' })
  } catch (err) {
    return internalError(res, err)
  }
}

module.exports = { updateProfile, updatePassword }
```

```js
// backend/src/routes/userRoutes.js
const router = require('express').Router()
const { authenticate, validate } = require('../middleware')
const { updateProfileSchema, updatePasswordSchema } = require('../validators/userValidators')
const { updateProfile, updatePassword } = require('../controllers/userController')

router.patch('/me', authenticate, validate(updateProfileSchema), updateProfile)
router.patch('/me/password', authenticate, validate(updatePasswordSchema), updatePassword)

module.exports = router
```

Modify `backend/src/routes/index.js:7-8` - replace:

```js
// const userRoutes = require('./userRoutes')           // GET  /users?role=field_crew (crew list)
// router.use('/users', userRoutes)
```

with:

```js
const userRoutes = require('./userRoutes')              // PATCH /users/me, PATCH /users/me/password (self-service account settings)
router.use('/users', userRoutes)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx jest tests/jasper/userController.test.js`
Expected: PASS (5 tests)

Then run the full backend suite to confirm the `authController.js` refactor didn't break anything:

Run: `cd backend && npm test`
Expected: PASS (all existing suites still green)

- [ ] **Step 5: Commit**

```bash
git add backend/src/utils/token.js backend/src/controllers/userController.js backend/src/controllers/authController.js backend/src/routes/userRoutes.js backend/src/routes/index.js backend/tests/jasper/userController.test.js
git commit -m "Add PATCH /api/users/me and /api/users/me/password endpoints"
```

---

### Task 3: Frontend support layer (AuthContext, api client, validation)

**Files:**
- Modify: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/api/users.js`
- Create: `frontend/src/validation/userValidation.js`
- Test: `frontend/tests/jasper/AuthContext.test.jsx`

**Interfaces:**
- Consumes: nothing from earlier tasks (frontend and backend are independently developed against the API contract in the spec).
- Produces: `useAuth()` now also returns `updateUser(newToken)`; `updateProfile({name, email})` and `updatePassword({currentPassword, newPassword})` from `@/api/users`; `updateProfileSchema` and `changePasswordSchema` from `@/validation/userValidation` - all three consumed by Task 4's `SettingsPage`.

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/tests/jasper/AuthContext.test.jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '@/context/AuthContext'

function base64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
}
function makeToken(payload) {
  return `${base64url({ alg: 'HS256', typ: 'JWT' })}.${base64url(payload)}.fakesignature`
}

const ORIGINAL_TOKEN = makeToken({ sub: 7, name: 'Old Name', email: 'old@efar.com', role: 'ar_specialist', exp: Math.floor(Date.now() / 1000) + 3600 })
const NEW_TOKEN = makeToken({ sub: 7, name: 'New Name', email: 'new@efar.com', role: 'ar_specialist', exp: Math.floor(Date.now() / 1000) + 3600 })

function Probe() {
  const { user, updateUser } = useAuth()
  return (
    <div>
      <span data-testid="name">{user?.name}</span>
      <span data-testid="email">{user?.email}</span>
      <button onClick={() => updateUser(NEW_TOKEN)}>update</button>
    </div>
  )
}

beforeEach(() => {
  localStorage.setItem('efar_token', ORIGINAL_TOKEN)
})
afterEach(() => {
  localStorage.clear()
})

test('updateUser stores the new token and re-decodes the user from it', async () => {
  const user = userEvent.setup()
  render(<AuthProvider><Probe /></AuthProvider>)

  expect(screen.getByTestId('name')).toHaveTextContent('Old Name')

  await user.click(screen.getByText('update'))

  expect(screen.getByTestId('name')).toHaveTextContent('New Name')
  expect(screen.getByTestId('email')).toHaveTextContent('new@efar.com')
  expect(localStorage.getItem('efar_token')).toBe(NEW_TOKEN)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest tests/jasper/AuthContext.test.jsx`
Expected: FAIL - `updateUser is not a function` (destructured as `undefined` from `useAuth()`)

- [ ] **Step 3: Write minimal implementation**

Modify `frontend/src/context/AuthContext.jsx` - add this function after `logout()` (after line 46) and add `updateUser` to the context value on line 49:

```js
  // Used after a profile edit: the backend re-signs a JWT with the new name/email
  // claims (see backend/src/controllers/userController.js), so the client must swap
  // its stored token the same way login() does, or a page refresh would show stale data.
  function updateUser(newToken) {
    localStorage.setItem('efar_token', newToken)
    const decoded = getUserFromToken(newToken)
    setToken(newToken)
    setUser(decoded)
  }
```

```js
  return (
    <AuthContext.Provider value={{ token, user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest tests/jasper/AuthContext.test.jsx`
Expected: PASS (1 test)

- [ ] **Step 5: Add the api client and validation schemas (no dedicated tests - exercised via Task 4's SettingsPage tests, matching how `api/xero.js` and `validation/contractValidation.js` are only tested through their consuming pages)**

```js
// frontend/src/api/users.js
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
```

```js
// frontend/src/validation/userValidation.js
import * as Yup from 'yup'

// Mirrors backend/src/validators/userValidators.js field-for-field.
export const updateProfileSchema = Yup.object({
  name: Yup.string().min(2).max(100).required('Name is required'),
  email: Yup.string().email('Must be a valid email').required('Email is required'),
})

// confirmPassword is a frontend-only check - it is never sent to the backend.
export const changePasswordSchema = Yup.object({
  currentPassword: Yup.string().required('Current password is required'),
  newPassword: Yup.string().min(8, 'Password must be at least 8 characters').required('New password is required'),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref('newPassword')], 'Passwords must match')
    .required('Please confirm your new password'),
})
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/context/AuthContext.jsx frontend/src/api/users.js frontend/src/validation/userValidation.js frontend/tests/jasper/AuthContext.test.jsx
git commit -m "Add updateUser, users API client, and validation schemas for settings"
```

---

### Task 4: `SettingsPage`, routing, and sidebar entry point

**Files:**
- Create: `frontend/src/pages/settings/SettingsPage.jsx`
- Modify: `frontend/src/App.jsx` (add the `/settings` route)
- Modify: `frontend/src/layouts/AppLayout.jsx` (wrap the user footer in a link to `/settings`)
- Test: `frontend/tests/jasper/SettingsPage.test.jsx`

**Interfaces:**
- Consumes: `useAuth()` -> `{ user, updateUser }` (Task 3), `updateProfile`/`updatePassword` from `@/api/users` (Task 3), `updateProfileSchema`/`changePasswordSchema` from `@/validation/userValidation` (Task 3).

- [ ] **Step 1: Write the failing test**

```jsx
// frontend/tests/jasper/SettingsPage.test.jsx
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

const CURRENT_USER = { sub: 7, name: 'Sarah Lim', email: 'sarah@efar.com', role: 'ar_specialist', exp: Math.floor(Date.now() / 1000) + 3600 }

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
    expect(screen.getByLabelText(/^Email/i)).toHaveValue('sarah@efar.com')
  })

  test('successful update shows a success toast and stores the new token', async () => {
    const user = userEvent.setup()
    const newToken = makeToken({ ...CURRENT_USER, name: 'Sarah Lim-Tan' })
    mock.onPatch('/users/me').reply(200, {
      success: true,
      data: { token: newToken, user: { id: 7, name: 'Sarah Lim-Tan', email: 'sarah@efar.com', role: 'ar_specialist' } },
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
    await user.type(screen.getByLabelText(/^Email/i), 'taken@efar.com')
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
    localStorage.setItem('efar_token', makeToken({ sub: 1, name: 'Doris Tan', email: 'doris@efar.com', role: 'managing_director', exp: Math.floor(Date.now() / 1000) + 3600 }))

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest tests/jasper/SettingsPage.test.jsx`
Expected: FAIL - `Cannot find module '@/pages/settings/SettingsPage'`

- [ ] **Step 3: Write minimal implementation**

```jsx
// frontend/src/pages/settings/SettingsPage.jsx
// Owner: Jasper - Account Settings (docs/superpowers/specs/2026-07-11-account-settings-page-design.md).
// Shared /settings page for every role: profile edit (name/email) + password change.
// The only entry point is the sidebar user footer in AppLayout.jsx - there is
// intentionally no NAV_ROUTES item for this page.
import { useFormik } from 'formik'
import { Settings, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RequiredLabel } from '@/components/RequiredLabel'
import { FieldError } from '@/components/FieldError'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/hooks'
import { updateProfile, updatePassword } from '@/api/users'
import { updateProfileSchema, changePasswordSchema } from '@/validation/userValidation'

const ROLE_LABELS = {
  managing_director: 'Managing Director',
  ar_specialist: 'AR Specialist',
  ap_specialist: 'AP Specialist',
  quotations_specialist: 'Quotations Specialist',
  field_crew: 'Field Crew',
}

export default function SettingsPage() {
  const toast = useToast()
  const { user, updateUser } = useAuth()

  const profileForm = useFormik({
    initialValues: { name: user?.name || '', email: user?.email || '' },
    validationSchema: updateProfileSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, setFieldError }) => {
      try {
        const { token } = await updateProfile(values)
        updateUser(token)
        toast.success('Profile updated successfully.')
      } catch (err) {
        if (err.response?.data?.code === 'EMAIL_IN_USE') {
          setFieldError('email', err.response.data.message)
        } else {
          toast.error(err.response?.data?.message || 'Failed to update profile. Please try again.')
        }
      } finally {
        setSubmitting(false)
      }
    },
  })

  const passwordForm = useFormik({
    initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    validationSchema: changePasswordSchema,
    onSubmit: async (values, { setSubmitting, setFieldError, resetForm }) => {
      try {
        await updatePassword(values)
        resetForm()
        toast.success('Password updated successfully.')
      } catch (err) {
        if (err.response?.data?.code === 'INVALID_CREDENTIALS') {
          setFieldError('currentPassword', 'Incorrect password.')
        } else {
          toast.error(err.response?.data?.message || 'Failed to update password. Please try again.')
        }
      } finally {
        setSubmitting(false)
      }
    },
  })

  return (
    <div className="p-6 space-y-4 font-sans">
      <div className="flex items-center gap-3">
        <Settings className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
      </div>

      <div className="max-w-2xl space-y-4">
        <form onSubmit={profileForm.handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your name and email address.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <RequiredLabel htmlFor="name">Name</RequiredLabel>
                <Input id="name" name="name" value={profileForm.values.name} onChange={profileForm.handleChange} onBlur={profileForm.handleBlur} />
                <FieldError formik={profileForm} name="name" />
              </div>
              <div>
                <RequiredLabel htmlFor="email">Email</RequiredLabel>
                <Input id="email" name="email" type="email" value={profileForm.values.email} onChange={profileForm.handleChange} onBlur={profileForm.handleBlur} />
                <FieldError formik={profileForm} name="email" />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input id="role" value={ROLE_LABELS[user?.role] || user?.role || ''} disabled />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={profileForm.isSubmitting}>
                  {profileForm.isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Profile'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>

        <form onSubmit={passwordForm.handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>Enter your current password and choose a new one.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <RequiredLabel htmlFor="currentPassword">Current Password</RequiredLabel>
                <Input id="currentPassword" name="currentPassword" type="password" value={passwordForm.values.currentPassword} onChange={passwordForm.handleChange} onBlur={passwordForm.handleBlur} />
                <FieldError formik={passwordForm} name="currentPassword" />
              </div>
              <div>
                <RequiredLabel htmlFor="newPassword">New Password</RequiredLabel>
                <Input id="newPassword" name="newPassword" type="password" value={passwordForm.values.newPassword} onChange={passwordForm.handleChange} onBlur={passwordForm.handleBlur} />
                <FieldError formik={passwordForm} name="newPassword" />
              </div>
              <div>
                <RequiredLabel htmlFor="confirmPassword">Confirm New Password</RequiredLabel>
                <Input id="confirmPassword" name="confirmPassword" type="password" value={passwordForm.values.confirmPassword} onChange={passwordForm.handleChange} onBlur={passwordForm.handleBlur} />
                <FieldError formik={passwordForm} name="confirmPassword" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={passwordForm.isSubmitting}>
                  {passwordForm.isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</> : 'Save Password'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  )
}
```

Modify `frontend/src/App.jsx` - add the import near the other page imports (after line 22's `ManagementPage` import):

```js
import SettingsPage from './pages/settings/SettingsPage'
```

and add the route right after `<Route index element={<RoleHomeRedirect />} />` (line 75), before the Managing Director role block:

```jsx
          {/* Account Settings: every authenticated role, no RoleRoute restriction. */}
          <Route path="/settings" element={<SettingsPage />} />
```

Modify `frontend/src/layouts/AppLayout.jsx` - replace the user footer block (lines 62-69):

```jsx
        {/* User footer */}
        <div className="px-3 py-3 border-t border-white/10 space-y-2">
          <div className="px-3 py-1">
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${roleMeta.badge}`}>
              {roleMeta.label}
            </span>
          </div>
```

with:

```jsx
        {/* User footer - the only entry point to /settings (no NAV_ROUTES item) */}
        <div className="px-3 py-3 border-t border-white/10 space-y-2">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `block px-3 py-1 rounded-md transition-colors ${isActive ? 'bg-[#0F172A]' : 'hover:bg-[#0F172A]'}`
            }
          >
            <p className="text-sm font-medium text-white truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            <span className={`inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${roleMeta.badge}`}>
              {roleMeta.label}
            </span>
          </NavLink>
```

(`NavLink` is already imported at the top of `AppLayout.jsx:1` - no new import needed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest tests/jasper/SettingsPage.test.jsx`
Expected: PASS (7 tests)

Then run the full frontend suite and the production build to confirm nothing else broke:

Run: `cd frontend && npm test`
Expected: PASS (all existing suites still green)

Run: `cd frontend && npm run build`
Expected: build succeeds with no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/settings/SettingsPage.jsx frontend/src/App.jsx frontend/src/layouts/AppLayout.jsx frontend/tests/jasper/SettingsPage.test.jsx
git commit -m "Add Settings page with profile edit and password change"
```
