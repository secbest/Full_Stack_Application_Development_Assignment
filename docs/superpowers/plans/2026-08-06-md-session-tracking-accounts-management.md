# Session Tracking, Login Lockout & Real Accounts Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Accounts Management's hardcoded user directory and no-op session actions with real backend-driven data: a `User.token_version` bump invalidates sessions (Force Logout), a failed-login counter with auto-lock backs Unlock/Security Alerts, and `last_login_at`/`last_active_at` back Currently Online and Last Login.

**Architecture:** Five new/changed columns on the existing `User` model (no new tables). `authenticate` middleware gains a DB round-trip to check `token_version` and stamp `last_active_at` (throttled). `login` gains lockout bookkeeping. Three new `managing_director`-only endpoints (`PATCH /users/:id`, `POST /users/:id/force-logout`, `POST /users/:id/unlock`) plus an extended `GET /users` response for that role. `Management.jsx` switches from a hardcoded array to fetching this endpoint and refetching after every action.

**Tech Stack:** Express, Sequelize, Yup, Jest (backend); React, axios, Jest + Testing Library + axios-mock-adapter (frontend).

## Global Constraints

- Schema changes are applied by editing the Sequelize model and running `npm run db:sync` (which runs `sequelize.sync({ alter: true })`) — this project has no migration-per-column-change convention; only `users`' original creation has a formal migration.
- Every DB call inside a request handler must be wrapped in try/catch — see `project_uncaught_async_handler_crashes_server` precedent: an unhandled rejection in Express middleware/controllers takes down the whole process, not just the request.
- No email confirmations anywhere; all feedback is in-app toast (CLAUDE.md).
- Design tokens (CLAUDE.md): Online/success `#22C55E`, Locked/error `#EF4444`, Offline/neutral `#64748B`.
- `frontend/tests/liang-yi/Management.test.jsx` is owned by Liang Yi but will be edited directly in this plan (confirmed with the user) since several of its assertions describe the mock behavior being removed. New behavior not covered by her existing tests gets new test files under `frontend/tests/jasper/` and `backend/tests/jasper/`.

---

## Task 1: Add session/lockout columns to the User model

**Files:**
- Modify: `backend/src/models/User.js:21-35`

**Interfaces:**
- Produces: `User.token_version` (INTEGER, default 0), `User.last_login_at` (DATE, nullable), `User.last_active_at` (DATE, nullable), `User.failed_login_count` (INTEGER, default 0), `User.is_locked` (BOOLEAN, default false) — consumed by Tasks 2-5.

- [ ] **Step 1: Add the five columns to the model definition**

In `backend/src/models/User.js`, replace:

```js
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  name:     { type: DataTypes.STRING(100), allowNull: false },
  email:    { type: DataTypes.STRING(255), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role:     { type: DataTypes.ENUM(...ROLES), allowNull: false },
}, {
  tableName: 'users',
  underscored: true,
})
```

with:

```js
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  name:     { type: DataTypes.STRING(100), allowNull: false },
  email:    { type: DataTypes.STRING(255), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role:     { type: DataTypes.ENUM(...ROLES), allowNull: false },
  // Bumped by POST /users/:id/force-logout. Embedded in every JWT (see utils/token.js);
  // authenticate() rejects a token whose token_version doesn't match the current value,
  // so bumping this invalidates every session already issued for this user.
  token_version:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  last_login_at:      { type: DataTypes.DATE, allowNull: true },
  // Stamped by authenticate() (throttled - see middleware/index.js). "Currently Online"
  // on the Accounts Management screen means this is within the last 5 minutes.
  last_active_at:     { type: DataTypes.DATE, allowNull: true },
  failed_login_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  is_locked:           { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'users',
  underscored: true,
})
```

- [ ] **Step 2: Sync the schema against the real dev database**

Run: `cd backend && npm run db:sync`
Expected: `[sync-db] All tables are up to date.` with no errors. This is a schema-only change (no new unit test applies), so this sync run is the verification step.

- [ ] **Step 3: Commit**

```bash
git add backend/src/models/User.js
git commit -m "feat(backend): add session/lockout columns to User model"
```

---

## Task 2: Embed token_version in JWTs and enforce it in authenticate()

**Files:**
- Modify: `backend/src/utils/token.js`
- Modify: `backend/src/middleware/index.js:1-30`
- Test: `backend/tests/jasper/tokenAndAuthMiddleware.test.js` (create)

**Interfaces:**
- Consumes: `User.token_version`, `User.last_active_at` (Task 1)
- Produces: `signToken(user)` now embeds `token_version` in the JWT payload. `authenticate(req, res, next)` is now `async`; on a token whose `token_version` claim doesn't match the DB value, responds `401 { code: 'TOKEN_REVOKED' }` before calling `next()`. Consumed by Task 3 (login re-signs tokens) and by every existing route unchanged (same middleware signature, still called as `authenticate` in route files).

- [ ] **Step 1: Write the failing test for signToken embedding token_version**

Create `backend/tests/jasper/tokenAndAuthMiddleware.test.js`:

```js
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed.jwt.token'),
  verify: jest.fn(),
}))

const jwt = require('jsonwebtoken')
const { signToken } = require('../../src/utils/token')

describe('signToken', () => {
  beforeEach(() => { jest.clearAllMocks() })

  test('embeds token_version in the JWT payload', () => {
    const user = { id: 7, name: 'Sarah Lim', email: 'sarah@efar.com.sg', role: 'ar_specialist', token_version: 3 }
    signToken(user)

    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: 7, name: 'Sarah Lim', email: 'sarah@efar.com.sg', role: 'ar_specialist', token_version: 3 },
      expect.any(String),
      { expiresIn: '8h' }
    )
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest tests/jasper/tokenAndAuthMiddleware.test.js -t "embeds token_version"`
Expected: FAIL - `jwt.sign` was called without `token_version` in the payload.

- [ ] **Step 3: Update signToken to embed token_version**

In `backend/src/utils/token.js`, replace:

```js
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
```

with:

```js
function signToken(user) {
  const secret = process.env.NODE_ENV === 'production'
    ? process.env.JWT_SECRET
    : process.env.DEV_JWT_SECRET
  return jwt.sign(
    { sub: user.id, name: user.name, email: user.email, role: user.role, token_version: user.token_version },
    secret,
    { expiresIn: '8h' }
  )
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest tests/jasper/tokenAndAuthMiddleware.test.js -t "embeds token_version"`
Expected: PASS

- [ ] **Step 5: Write the failing tests for authenticate()'s token_version check**

Append to `backend/tests/jasper/tokenAndAuthMiddleware.test.js`:

```js
jest.mock('../../src/models', () => ({
  User: { findByPk: jest.fn() },
}))

const { User } = require('../../src/models')
const { authenticate } = require('../../src/middleware')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}

describe('authenticate', () => {
  beforeEach(() => { jest.clearAllMocks() })

  test('rejects with 401 TOKEN_REVOKED when the token_version claim does not match the DB value', async () => {
    jwt.verify.mockReturnValue({ sub: 7, role: 'ar_specialist', token_version: 1 })
    User.findByPk.mockResolvedValue({ id: 7, token_version: 2, last_active_at: new Date(), update: jest.fn() })

    const req = { headers: { authorization: 'Bearer sometoken' } }
    const res = mockRes()
    const next = jest.fn()

    await authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_REVOKED' }))
    expect(next).not.toHaveBeenCalled()
  })

  test('calls next() and stamps last_active_at when token_version matches and the stamp is stale', async () => {
    jwt.verify.mockReturnValue({ sub: 7, role: 'ar_specialist', token_version: 2 })
    const update = jest.fn().mockResolvedValue()
    User.findByPk.mockResolvedValue({ id: 7, token_version: 2, last_active_at: new Date(Date.now() - 120_000), update })

    const req = { headers: { authorization: 'Bearer sometoken' } }
    const res = mockRes()
    const next = jest.fn()

    await authenticate(req, res, next)

    expect(update).toHaveBeenCalledWith({ last_active_at: expect.any(Date) })
    expect(req.user).toEqual({ sub: 7, role: 'ar_specialist', token_version: 2 })
    expect(next).toHaveBeenCalled()
  })

  test('skips the last_active_at write when the existing stamp is fresh', async () => {
    jwt.verify.mockReturnValue({ sub: 7, role: 'ar_specialist', token_version: 2 })
    const update = jest.fn()
    User.findByPk.mockResolvedValue({ id: 7, token_version: 2, last_active_at: new Date(), update })

    const req = { headers: { authorization: 'Bearer sometoken' } }
    const next = jest.fn()

    await authenticate(req, mockRes(), next)

    expect(update).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })
})
```

- [ ] **Step 6: Run it to verify it fails**

Run: `cd backend && npx jest tests/jasper/tokenAndAuthMiddleware.test.js -t "authenticate"`
Expected: FAIL - `authenticate` does not yet look up the user or check `token_version`.

- [ ] **Step 7: Implement the token_version check and last_active_at stamping**

In `backend/src/middleware/index.js`, replace:

```js
const jwt = require('jsonwebtoken')

// Verifies the JWT in the Authorization header.
// Attaches decoded payload to req.user on success.
function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing or invalid token.' })
  }
  const token = header.slice(7)
  try {
    const secret = process.env.NODE_ENV === 'production' ? process.env.JWT_SECRET : process.env.DEV_JWT_SECRET
    req.user = jwt.verify(token, secret)
    next()
  } catch {
    res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Token is invalid or expired.' })
  }
}
```

with:

```js
const jwt = require('jsonwebtoken')
const { User } = require('../models')

// How stale last_active_at must be before authenticate() bothers writing a fresh
// value. Without this, every authenticated request (there are many per page load)
// would issue an UPDATE - this keeps it to at most one write per user per minute.
const LAST_ACTIVE_STALE_MS = 60 * 1000

// Verifies the JWT in the Authorization header, then checks it against the user's
// current token_version - a mismatch means a Managing Director has force-logged-out
// this account since the token was issued (see userController.forceLogout). Also
// stamps last_active_at (throttled) so Accounts Management's "Currently Online"
// status has real data to read.
// Attaches decoded payload to req.user on success.
async function authenticate(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, code: 'UNAUTHORIZED', message: 'Missing or invalid token.' })
  }
  const token = header.slice(7)

  let payload
  try {
    const secret = process.env.NODE_ENV === 'production' ? process.env.JWT_SECRET : process.env.DEV_JWT_SECRET
    payload = jwt.verify(token, secret)
  } catch {
    return res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Token is invalid or expired.' })
  }

  try {
    const user = await User.findByPk(payload.sub, { attributes: ['id', 'token_version', 'last_active_at'] })
    if (!user || user.token_version !== payload.token_version) {
      return res.status(401).json({ success: false, code: 'TOKEN_REVOKED', message: 'This session has been logged out. Please sign in again.' })
    }

    const lastActive = user.last_active_at ? new Date(user.last_active_at).getTime() : 0
    if (Date.now() - lastActive > LAST_ACTIVE_STALE_MS) {
      await user.update({ last_active_at: new Date() })
    }

    req.user = payload
    next()
  } catch (err) {
    res.status(500).json({ success: false, code: 'INTERNAL_ERROR', message: 'Something went wrong while authenticating this request.' })
  }
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `cd backend && npx jest tests/jasper/tokenAndAuthMiddleware.test.js`
Expected: PASS (all 4 tests)

- [ ] **Step 9: Commit**

```bash
git add backend/src/utils/token.js backend/src/middleware/index.js backend/tests/jasper/tokenAndAuthMiddleware.test.js
git commit -m "feat(backend): enforce token_version in authenticate(), stamp last_active_at"
```

---

## Task 3: Login lockout after repeated failures

**Files:**
- Modify: `backend/src/controllers/authController.js`
- Test: `backend/tests/jasper/authControllerLockout.test.js` (create)

**Interfaces:**
- Consumes: `User.failed_login_count`, `User.is_locked`, `User.last_login_at`, `User.last_active_at` (Task 1); `signToken(user)` (Task 2, now expects `user.token_version` to exist on the instance passed in - already true for any `User.findOne`/`User.create` result post-Task-1).
- Produces: `login(req, res)` rejects a locked account with `403 { code: 'ACCOUNT_LOCKED' }` regardless of password correctness; increments `failed_login_count` on a wrong password and sets `is_locked = true` at 5 consecutive failures; resets the counter and stamps `last_login_at`/`last_active_at` on success. Consumed by Task 4's `unlockUser` (clears what this task sets).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/jasper/authControllerLockout.test.js`:

```js
jest.mock('../../src/models', () => ({
  User: { findOne: jest.fn() },
}))
jest.mock('../../src/utils/token', () => ({
  signToken: jest.fn(() => 'signed.jwt.token'),
}))
jest.mock('bcryptjs', () => ({ compare: jest.fn() }))

const bcrypt = require('bcryptjs')
const { User } = require('../../src/models')
const { login } = require('../../src/controllers/authController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => { jest.clearAllMocks() })

describe('login lockout', () => {
  test('rejects a locked account with 403 ACCOUNT_LOCKED even with the correct password', async () => {
    User.findOne.mockResolvedValue({ id: 7, email: 'sarah@efar.com.sg', password: 'hash', is_locked: true, failed_login_count: 5 })

    const req = { body: { email: 'sarah@efar.com.sg', password: 'correct-password' } }
    const res = mockRes()
    await login(req, res)

    expect(bcrypt.compare).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'ACCOUNT_LOCKED' })
  })

  test('increments failed_login_count on a wrong password without locking below the threshold', async () => {
    const update = jest.fn().mockResolvedValue()
    User.findOne.mockResolvedValue({ id: 7, email: 'sarah@efar.com.sg', password: 'hash', is_locked: false, failed_login_count: 2, update })
    bcrypt.compare.mockResolvedValue(false)

    const req = { body: { email: 'sarah@efar.com.sg', password: 'wrong' } }
    await login(req, mockRes())

    expect(update).toHaveBeenCalledWith({ failed_login_count: 3, is_locked: false })
  })

  test('locks the account on the 5th consecutive failed attempt', async () => {
    const update = jest.fn().mockResolvedValue()
    User.findOne.mockResolvedValue({ id: 7, email: 'sarah@efar.com.sg', password: 'hash', is_locked: false, failed_login_count: 4, update })
    bcrypt.compare.mockResolvedValue(false)

    const req = { body: { email: 'sarah@efar.com.sg', password: 'wrong' } }
    await login(req, mockRes())

    expect(update).toHaveBeenCalledWith({ failed_login_count: 5, is_locked: true })
  })

  test('resets failed_login_count and stamps last_login_at/last_active_at on success', async () => {
    const update = jest.fn().mockResolvedValue()
    const user = { id: 7, name: 'Sarah Lim', email: 'sarah@efar.com.sg', role: 'ar_specialist', password: 'hash', is_locked: false, failed_login_count: 2, token_version: 0, update }
    User.findOne.mockResolvedValue(user)
    bcrypt.compare.mockResolvedValue(true)

    const req = { body: { email: 'sarah@efar.com.sg', password: 'correct-password' } }
    const res = mockRes()
    await login(req, res)

    expect(update).toHaveBeenCalledWith({ failed_login_count: 0, last_login_at: expect.any(Date), last_active_at: expect.any(Date) })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(jsonBody(res)).toMatchObject({ success: true, data: { token: 'signed.jwt.token' } })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest tests/jasper/authControllerLockout.test.js`
Expected: FAIL - `login` doesn't check `is_locked` or update `failed_login_count` yet.

- [ ] **Step 3: Implement lockout logic**

In `backend/src/controllers/authController.js`, replace:

```js
async function login(req, res) {
  try {
    const body = await loginSchema.validate(req.body, { abortEarly: false, stripUnknown: true })
    const user = await User.findOne({ where: { email: body.email } })
    // Constant-time comparison: always run bcrypt even when user not found to prevent timing attacks
    const hash = user ? user.password : '$2b$12$invalidhashfortimingreasons00000000000'
    const valid = await bcrypt.compare(body.password, hash)
    if (!user || !valid) return error(res, 'Invalid email or password.', 'INVALID_CREDENTIALS', 401)
    const token = signToken(user)
    return success(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 422)
    return error(res, 'Invalid email or password.', 'INVALID_CREDENTIALS', 401)
  }
}
```

with:

```js
// Consecutive failed attempts before an account auto-locks. Cleared by
// userController.unlockUser (managing_director only).
const MAX_FAILED_LOGIN_ATTEMPTS = 5

async function login(req, res) {
  try {
    const body = await loginSchema.validate(req.body, { abortEarly: false, stripUnknown: true })
    const user = await User.findOne({ where: { email: body.email } })

    if (user && user.is_locked) {
      return error(
        res,
        'This account has been locked after too many failed login attempts. Ask a Managing Director to unlock it.',
        'ACCOUNT_LOCKED',
        403
      )
    }

    // Constant-time comparison: always run bcrypt even when user not found to prevent timing attacks
    const hash = user ? user.password : '$2b$12$invalidhashfortimingreasons00000000000'
    const valid = await bcrypt.compare(body.password, hash)

    if (!user || !valid) {
      if (user) {
        const failedCount = user.failed_login_count + 1
        await user.update({ failed_login_count: failedCount, is_locked: failedCount >= MAX_FAILED_LOGIN_ATTEMPTS })
      }
      return error(res, 'Invalid email or password.', 'INVALID_CREDENTIALS', 401)
    }

    await user.update({ failed_login_count: 0, last_login_at: new Date(), last_active_at: new Date() })

    const token = signToken(user)
    return success(res, {
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    })
  } catch (err) {
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 422)
    return error(res, 'Invalid email or password.', 'INVALID_CREDENTIALS', 401)
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd backend && npx jest tests/jasper/authControllerLockout.test.js`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Run the full backend suite to check for regressions**

Run: `cd backend && npx jest`
Expected: PASS - no existing test asserted the old unconditional-login behavior in a way this breaks (the existing `authValidators.test.js` only tests the Yup schema, not the controller).

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/authController.js backend/tests/jasper/authControllerLockout.test.js
git commit -m "feat(backend): lock account after 5 consecutive failed logins"
```

---

## Task 4: New Accounts Management endpoints (list, update, force-logout, unlock)

**Files:**
- Modify: `backend/src/controllers/userController.js`
- Modify: `backend/src/validators/userValidators.js`
- Modify: `backend/src/routes/userRoutes.js`
- Modify: `backend/tests/jasper/userController.test.js`

**Interfaces:**
- Consumes: `User.token_version`, `last_login_at`, `last_active_at`, `failed_login_count`, `is_locked` (Task 1)
- Produces: `listUsers(req, res)` returns extra fields + computed `is_online` when `req.user.role === 'managing_director'`. `updateUser(req, res)`, `forceLogout(req, res)`, `unlockUser(req, res)` - new controller exports. Routes: `PATCH /api/users/:id`, `POST /api/users/:id/force-logout`, `POST /api/users/:id/unlock`, all `managing_director`-only. Consumed by Task 6 (frontend `api/users.js`).

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/jasper/userController.test.js` (after the existing `describe('updatePassword ...)` block, before the final closing of the file):

```js
describe('listUsers (GET /api/users)', () => {
  test('returns the minimal shape for a non-managing_director caller', async () => {
    User.findAll.mockResolvedValue([{ id: 3, name: 'Ravi Kumar', role: 'field_crew' }])

    const req = { user: { sub: 1, role: 'quotations_specialist' }, query: {} }
    const res = mockRes()
    await listUsers(req, res)

    expect(User.findAll).toHaveBeenCalledWith({
      where: {},
      attributes: ['id', 'name', 'role'],
      order: [['name', 'ASC']],
    })
    expect(jsonBody(res)).toMatchObject({ success: true, data: [{ id: 3, name: 'Ravi Kumar', role: 'field_crew' }] })
  })

  test('returns session/security fields plus a computed is_online for a managing_director caller', async () => {
    const fiveMinutesAgo = new Date(Date.now() - 4 * 60 * 1000)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    User.findAll.mockResolvedValue([
      { id: 3, name: 'Ravi Kumar', email: 'ravi@efar.com.sg', role: 'field_crew', last_login_at: fiveMinutesAgo, last_active_at: fiveMinutesAgo, is_locked: false },
      { id: 4, name: 'Chloe Tan', email: 'chloe@efar.com.sg', role: 'ap_specialist', last_login_at: twoHoursAgo, last_active_at: twoHoursAgo, is_locked: true },
    ])

    const req = { user: { sub: 1, role: 'managing_director' }, query: {} }
    const res = mockRes()
    await listUsers(req, res)

    expect(User.findAll).toHaveBeenCalledWith({
      where: {},
      attributes: ['id', 'name', 'email', 'role', 'last_login_at', 'last_active_at', 'is_locked'],
      order: [['name', 'ASC']],
    })
    expect(jsonBody(res).data).toEqual([
      { id: 3, name: 'Ravi Kumar', email: 'ravi@efar.com.sg', role: 'field_crew', last_login_at: fiveMinutesAgo, last_active_at: fiveMinutesAgo, is_online: true, is_locked: false },
      { id: 4, name: 'Chloe Tan', email: 'chloe@efar.com.sg', role: 'ap_specialist', last_login_at: twoHoursAgo, last_active_at: twoHoursAgo, is_online: false, is_locked: true },
    ])
  })
})

describe('updateUser (PATCH /api/users/:id)', () => {
  test('updates name/email/role and returns the updated user', async () => {
    User.findOne.mockResolvedValue(null)
    const userInstance = { id: 5, name: 'Old Name', email: 'old@efar.com.sg', role: 'quotations_specialist', save: jest.fn().mockResolvedValue() }
    User.findByPk.mockResolvedValue(userInstance)

    const req = { params: { id: 5 }, body: { name: 'New Name', email: 'new@efar.com.sg', role: 'ar_specialist' } }
    const res = mockRes()
    await updateUser(req, res)

    expect(userInstance.name).toBe('New Name')
    expect(userInstance.role).toBe('ar_specialist')
    expect(userInstance.save).toHaveBeenCalled()
    expect(jsonBody(res)).toMatchObject({ success: true, data: { id: 5, name: 'New Name', email: 'new@efar.com.sg', role: 'ar_specialist' } })
  })

  test('rejects with 409 when another user already has the requested email', async () => {
    User.findByPk.mockResolvedValue({ id: 5 })
    User.findOne.mockResolvedValue({ id: 9, email: 'taken@efar.com.sg' })

    const req = { params: { id: 5 }, body: { name: 'New Name', email: 'taken@efar.com.sg', role: 'ar_specialist' } }
    const res = mockRes()
    await updateUser(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'EMAIL_IN_USE' })
  })

  test('returns 404 for an unknown user id', async () => {
    User.findByPk.mockResolvedValue(null)

    const req = { params: { id: 999 }, body: { name: 'X', email: 'x@efar.com.sg', role: 'ar_specialist' } }
    const res = mockRes()
    await updateUser(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'USER_NOT_FOUND' })
  })
})

describe('forceLogout (POST /api/users/:id/force-logout)', () => {
  test('increments token_version', async () => {
    const update = jest.fn().mockResolvedValue()
    User.findByPk.mockResolvedValue({ id: 5, token_version: 2, update })

    const req = { params: { id: 5 } }
    const res = mockRes()
    await forceLogout(req, res)

    expect(update).toHaveBeenCalledWith({ token_version: 3 })
    expect(jsonBody(res)).toMatchObject({ success: true })
  })

  test('returns 404 for an unknown user id', async () => {
    User.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await forceLogout({ params: { id: 999 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})

describe('unlockUser (POST /api/users/:id/unlock)', () => {
  test('clears is_locked and resets failed_login_count', async () => {
    const update = jest.fn().mockResolvedValue()
    User.findByPk.mockResolvedValue({ id: 5, is_locked: true, failed_login_count: 5, update })

    const req = { params: { id: 5 } }
    const res = mockRes()
    await unlockUser(req, res)

    expect(update).toHaveBeenCalledWith({ is_locked: false, failed_login_count: 0 })
    expect(jsonBody(res)).toMatchObject({ success: true })
  })

  test('returns 404 for an unknown user id', async () => {
    User.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await unlockUser({ params: { id: 999 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
```

Also update the top-of-file imports in the same test file - replace:

```js
jest.mock('../../src/models', () => ({
  User: { findOne: jest.fn(), findByPk: jest.fn() },
}))
```

with:

```js
jest.mock('../../src/models', () => ({
  User: { findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
}))
```

and replace:

```js
const { updateProfile, updatePassword } = require('../../src/controllers/userController')
```

with:

```js
const { updateProfile, updatePassword, listUsers, updateUser, forceLogout, unlockUser } = require('../../src/controllers/userController')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest tests/jasper/userController.test.js`
Expected: FAIL - `listUsers`/`updateUser`/`forceLogout`/`unlockUser` don't exist or don't match the new shape yet.

- [ ] **Step 3: Implement the controller changes**

In `backend/src/controllers/userController.js`, replace the `listUsers` function and the final `module.exports` line:

```js
// GET /api/users?role=field_crew - minimal read-only user list, needed by the bookings
// crew-assignment picker so it can show real field_crew accounts instead of a hardcoded
// list that drifts from the users table.
async function listUsers(req, res) {
  try {
    const where = {}
    if (req.query.role) where.role = req.query.role

    const users = await User.findAll({
      where,
      attributes: ['id', 'name', 'role'],
      order: [['name', 'ASC']],
    })
    return success(res, users)
  } catch (err) {
    return internalError(res, err)
  }
}

module.exports = { deleteUser, updateProfile, updatePassword, listUsers }
```

with:

```js
// "Currently Online" on Accounts Management means active within this window.
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000

function isOnline(lastActiveAt) {
  if (!lastActiveAt) return false
  return Date.now() - new Date(lastActiveAt).getTime() <= ONLINE_THRESHOLD_MS
}

// GET /api/users?role=field_crew - read-only user list. The quotations_specialist crew
// picker only ever needs id/name/role, but the managing_director's Accounts Management
// screen needs the session/security fields too - gated on role rather than a query flag
// so a non-MD caller can never read another user's email or lock status.
async function listUsers(req, res) {
  try {
    const where = {}
    if (req.query.role) where.role = req.query.role

    const isManagingDirector = req.user.role === 'managing_director'
    const attributes = isManagingDirector
      ? ['id', 'name', 'email', 'role', 'last_login_at', 'last_active_at', 'is_locked']
      : ['id', 'name', 'role']

    const users = await User.findAll({ where, attributes, order: [['name', 'ASC']] })
    if (!isManagingDirector) return success(res, users)

    return success(res, users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      last_login_at: u.last_login_at,
      last_active_at: u.last_active_at,
      is_online: isOnline(u.last_active_at),
      is_locked: u.is_locked,
    })))
  } catch (err) {
    return internalError(res, err)
  }
}

// PATCH /api/users/:id - managing_director only. Edits another user's profile fields
// from the Accounts Management screen. (updateProfile above is the self-service /me
// route - this is the admin equivalent, and additionally accepts `role`.)
async function updateUser(req, res) {
  try {
    const user = await User.findByPk(req.params.id)
    if (!user) return notFound(res, 'No user with this id.', 'USER_NOT_FOUND')

    const { name, email, role } = req.body
    const existing = await User.findOne({ where: { email, id: { [Op.ne]: user.id } } })
    if (existing) return error(res, 'An account with this email already exists.', 'EMAIL_IN_USE', 409)

    user.name = name
    user.email = email
    user.role = role
    await user.save()

    return success(res, { id: user.id, name: user.name, email: user.email, role: user.role })
  } catch (err) {
    return internalError(res, err)
  }
}

// POST /api/users/:id/force-logout - managing_director only. Bumping token_version
// invalidates every JWT already issued to this user: their next request fails
// authenticate()'s token_version check with 401 TOKEN_REVOKED, and the frontend's
// response interceptor (src/api/index.js) redirects them to /login.
async function forceLogout(req, res) {
  try {
    const user = await User.findByPk(req.params.id)
    if (!user) return notFound(res, 'No user with this id.', 'USER_NOT_FOUND')

    await user.update({ token_version: user.token_version + 1 })
    return success(res, { message: 'User has been logged out of all sessions.' })
  } catch (err) {
    return internalError(res, err)
  }
}

// POST /api/users/:id/unlock - managing_director only. Clears the lockout that
// authController.login sets after MAX_FAILED_LOGIN_ATTEMPTS consecutive failures.
async function unlockUser(req, res) {
  try {
    const user = await User.findByPk(req.params.id)
    if (!user) return notFound(res, 'No user with this id.', 'USER_NOT_FOUND')

    await user.update({ is_locked: false, failed_login_count: 0 })
    return success(res, { message: 'User account has been unlocked.' })
  } catch (err) {
    return internalError(res, err)
  }
}

module.exports = { deleteUser, updateProfile, updatePassword, listUsers, updateUser, forceLogout, unlockUser }
```

- [ ] **Step 4: Add the updateUserSchema validator**

In `backend/src/validators/userValidators.js`, replace:

```js
module.exports = { userIdParamSchema, updateProfileSchema, updatePasswordSchema }
```

with:

```js
// Role list mirrors registerSchema's in backend/src/validators/index.js - each
// validators file keeps its own copy rather than sharing one, matching that file's
// existing convention.
const ROLES = ['managing_director', 'ar_specialist', 'ap_specialist', 'quotations_specialist', 'field_crew']

const updateUserSchema = Yup.object({
  name: Yup.string().min(2).max(100).required('Name is required'),
  email: Yup.string().email('Must be a valid email').matches(EFAR_EMAIL_DOMAIN, 'Email must be an @efar.com.sg address').required('Email is required'),
  role: Yup.string().oneOf(ROLES, `Role must be one of: ${ROLES.join(', ')}`).required('Role is required'),
})

module.exports = { userIdParamSchema, updateProfileSchema, updatePasswordSchema, updateUserSchema }
```

- [ ] **Step 5: Register the new routes**

In `backend/src/routes/userRoutes.js`, replace the entire file with:

```js
const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { ROLE } = require('../models')
const { userIdParamSchema, updateProfileSchema, updatePasswordSchema, updateUserSchema } = require('../validators/userValidators')
const { deleteUser, updateProfile, updatePassword, listUsers, updateUser, forceLogout, unlockUser } = require('../controllers/userController')

// Scoped to the roles that currently need it (bookings crew assignment, and Accounts
// Management). Widen this list if another feature needs a user/crew lookup later.
router.get('/', authenticate, authorise(ROLE.QUOTATIONS_SPECIALIST, ROLE.MANAGING_DIRECTOR), listUsers)

router.patch('/me', authenticate, validate(updateProfileSchema), updateProfile)
router.patch('/me/password', authenticate, validate(updatePasswordSchema), updatePassword)

// These three are registered AFTER /me and /me/password so a PATCH /me request
// matches the exact route above rather than being captured by the :id param below.
router.patch('/:id', authenticate, authorise(ROLE.MANAGING_DIRECTOR), validate(userIdParamSchema, 'params'), validate(updateUserSchema), updateUser)
router.post('/:id/force-logout', authenticate, authorise(ROLE.MANAGING_DIRECTOR), validate(userIdParamSchema, 'params'), forceLogout)
router.post('/:id/unlock', authenticate, authorise(ROLE.MANAGING_DIRECTOR), validate(userIdParamSchema, 'params'), unlockUser)

router.delete('/:id', authenticate, authorise(ROLE.MANAGING_DIRECTOR), validate(userIdParamSchema, 'params'), deleteUser)

module.exports = router
```

- [ ] **Step 6: Run it to verify it passes**

Run: `cd backend && npx jest tests/jasper/userController.test.js`
Expected: PASS (all tests, old and new)

- [ ] **Step 7: Run the full backend suite**

Run: `cd backend && npx jest`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/userController.js backend/src/validators/userValidators.js backend/src/routes/userRoutes.js backend/tests/jasper/userController.test.js
git commit -m "feat(backend): add PATCH/force-logout/unlock endpoints, extend GET /users for MD"
```

---

## Task 5: Manual verification against the real dev database

**Files:** none (verification only)

- [ ] **Step 1: Reseed and start the backend**

Run: `cd backend && npm run db:setup && npm run dev`

- [ ] **Step 2: Log in as `doris@efar.com.sg` (managing_director) and call the new endpoints**

Using the browser devtools console or a REST client with the token from `localStorage.efar_token`:
- `GET /api/users` should return `email`, `last_login_at`, `last_active_at`, `is_online`, `is_locked` for every user.
- `POST /api/users/<some-id>/force-logout` should return 200, then that user's next authenticated request should fail with `401 TOKEN_REVOKED`.
- Log in as that same user 5 times with a wrong password from a second browser/incognito window, then confirm the 6th attempt (even with the correct password) returns `403 ACCOUNT_LOCKED`.
- `POST /api/users/<that-id>/unlock` should return 200, after which the correct password logs in successfully again.

- [ ] **Step 3: No commit** - this task only verifies Tasks 1-4 against real data; there is nothing to check in.

---

## Task 6: Frontend API wrapper functions

**Files:**
- Modify: `frontend/src/api/users.js`

**Interfaces:**
- Consumes: `GET /api/users`, `PATCH /api/users/:id`, `POST /api/users/:id/force-logout`, `POST /api/users/:id/unlock` (Task 4)
- Produces: `listAccounts(): Promise<Array<{id, name, email, role, last_login_at, last_active_at, is_online, is_locked}>>`, `updateUser(id, {name, email, role}): Promise<{id, name, email, role}>`, `forceLogoutUser(id): Promise<{message}>`, `unlockUser(id): Promise<{message}>` - consumed by Task 7 (`Management.jsx`).

- [ ] **Step 1: Add the four functions**

In `frontend/src/api/users.js`, append after the existing `updatePassword` function:

```js
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/users.js
git commit -m "feat(frontend): add Accounts Management API wrapper functions"
```

(No standalone test for this task - it's four one-line axios wrappers with no branching logic; they're exercised through Task 7's component tests.)

---

## Task 7: Wire Management.jsx to real data

**Files:**
- Modify: `frontend/src/pages/dashboard/Management.jsx`

**Interfaces:**
- Consumes: `listAccounts`, `updateUser`, `forceLogoutUser`, `unlockUser` (Task 6)
- Produces: `AccountsManagement` now fetches the real user directory on mount and after every mutating action. No new exports (default export `ManagementPage` unchanged). Consumed by Task 8's rewritten tests.

- [ ] **Step 1: Replace the mock array with role-label mapping and a real fetch**

In `frontend/src/pages/dashboard/Management.jsx`, replace:

```jsx
import React, { useState } from 'react';
import { Search, Users, Eye, EyeOff } from 'lucide-react';
import api from '../../api';
import { useToast } from '../../context/ToastContext';

const ROLES = ["Quotations", "Field Crew", "Accounts Receivable", "Accounts Payable", "Managing Director"];

// Maps the display labels above to the role slugs the backend's registerSchema expects.
const ROLE_SLUGS = {
  "Quotations": "quotations_specialist",
  "Field Crew": "field_crew",
  "Accounts Receivable": "ar_specialist",
  "Accounts Payable": "ap_specialist",
  "Managing Director": "managing_director",
};

const INITIAL_ACCOUNTS = [
  { name: "Camilla Cruz", email: "camilla@efar.com.sg", role: "Quotations",        status: "Online",  lastLogin: "Active now"  },
  { name: "Ravi Kumar",   email: "ravi@efar.com.sg",    role: "Field Crew",        status: "Offline", lastLogin: "2 hours ago" },
  { name: "Sarah Lee",    email: "sarah@efar.com.sg",   role: "Accounts Receivable", status: "Online",  lastLogin: "15 mins ago" },
  { name: "Chloe Wong",   email: "chloe@efar.com.sg",   role: "Accounts Payable",  status: "Offline", lastLogin: "Yesterday"   },
  { name: "Doris Tan",    email: "doris@efar.com.sg",   role: "Managing Director", status: "Online",  lastLogin: "Active now"  },
];
```

with:

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Search, Users, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { listAccounts, updateUser as updateUserApi, forceLogoutUser, unlockUser as unlockUserApi } from '../../api/users';
import api from '../../api';

const ROLES = ["Quotations", "Field Crew", "Accounts Receivable", "Accounts Payable", "Managing Director"];

// Maps the display labels above to the role slugs the backend expects, and back.
const ROLE_SLUGS = {
  "Quotations": "quotations_specialist",
  "Field Crew": "field_crew",
  "Accounts Receivable": "ar_specialist",
  "Accounts Payable": "ap_specialist",
  "Managing Director": "managing_director",
};
const ROLE_LABELS = Object.fromEntries(Object.entries(ROLE_SLUGS).map(([label, slug]) => [slug, label]));

// Turns a GET /api/users row (real backend fields) into the shape this screen renders.
function toDisplayRow(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: ROLE_LABELS[u.role] || u.role,
    status: u.is_locked ? "Locked" : u.is_online ? "Online" : "Offline",
    lastLogin: formatLastLogin(u.last_login_at),
  };
}

function formatLastLogin(lastLoginAt) {
  if (!lastLoginAt) return "Never";
  const diffMs = Date.now() - new Date(lastLoginAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 5) return "Active now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return new Date(lastLoginAt).toLocaleDateString();
}
```

- [ ] **Step 2: Simplify AddUserModal to trigger a refetch instead of building a display row itself**

In the same file, replace:

```jsx
function AddUserModal({ onClose, onAdd }) {
```

with:

```jsx
function AddUserModal({ onClose, onAdded }) {
```

and replace:

```jsx
      const newUser = data.data.user;
      onAdd({ id: newUser.id, name: newUser.name, email: newUser.email, role, status: "Offline", lastLogin: "Just added" });
      toast.success(`Account created for ${newUser.name}.`);
      onClose();
```

with:

```jsx
      const newUser = data.data.user;
      onAdded();
      toast.success(`Account created for ${newUser.name}.`);
      onClose();
```

- [ ] **Step 3: Make EditUserModal call the real PATCH endpoint**

Replace:

```jsx
function EditUserModal({ user, onClose, onSave }) {
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleEditSubmit = async () => {
    const errors = {};
    if (!name.trim()) errors.name = "Full name is required.";

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      errors.email = "A valid email is required.";
    } else if (!trimmedEmail.toLowerCase().endsWith("@efar.com.sg")) {
      errors.email = "Invalid email. Only @efar.com.sg email addresses are allowed.";
    }

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setGeneralError("");
      if (errors.email) toast.error(errors.email);
      return;
    }

    setFieldErrors({});
    setGeneralError("");
    setSubmitting(true);
    // Placeholder: no backend call yet, just commits the edit to local state so the
    // UI reflects it immediately. Swap this for a real PATCH /api/users/:id call
    // (mirroring how Remove already calls DELETE /api/users/:id) once that route exists.
    onSave({ ...user, name: name.trim(), email: trimmedEmail, role });
    toast.success(`${name.trim()}'s account was updated.`);
    setSubmitting(false);
    onClose();
  };
```

with:

```jsx
function EditUserModal({ user, onClose, onSave }) {
  const toast = useToast();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleEditSubmit = async () => {
    const errors = {};
    if (!name.trim()) errors.name = "Full name is required.";

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      errors.email = "A valid email is required.";
    } else if (!trimmedEmail.toLowerCase().endsWith("@efar.com.sg")) {
      errors.email = "Invalid email. Only @efar.com.sg email addresses are allowed.";
    }

    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      setGeneralError("");
      if (errors.email) toast.error(errors.email);
      return;
    }

    setFieldErrors({});
    setGeneralError("");
    setSubmitting(true);
    try {
      await onSave({ id: user.id, name: name.trim(), email: trimmedEmail, role });
      toast.success(`${name.trim()}'s account was updated.`);
      onClose();
    } catch (err) {
      const backendErrors = err.response?.data?.errors;
      if (err.response?.status === 400 && Array.isArray(backendErrors)) {
        const mapped = {};
        backendErrors.forEach((e) => { if (e.field) mapped[e.field] = e.message; });
        setFieldErrors(mapped);
      } else {
        const message = err.response?.data?.message || "Something went wrong while updating this account. Please try again.";
        setGeneralError(message);
        toast.error(message);
      }
    } finally {
      setSubmitting(false);
    }
  };
```

- [ ] **Step 4: Rewrite AccountsManagement to fetch real data and wire actions to it**

Replace the entire `AccountsManagement` function body from its declaration through its closing `}` (the block starting `function AccountsManagement() {` and ending just before `const ACTION_BUTTON_VARIANTS`... no, `ACTION_BUTTON_VARIANTS` is defined BEFORE `AccountsManagement` - replace from `function AccountsManagement() {` through the `return (...)` block's closing `);\n}` that precedes `export default function ManagementPage()`) with:

```jsx
function AccountsManagement() {
  const cardBase = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
  const toast = useToast();

  const [accounts, setAccounts] = useState([]);
  const [loadStatus, setLoadStatus] = useState("loading"); // 'loading' | 'ready' | 'error'
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("All Statuses");
  const [showAddModal, setShowAddModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const refetch = useCallback(async () => {
    setLoadStatus("loading");
    try {
      const users = await listAccounts();
      setAccounts(users.map(toDisplayRow));
      setLoadStatus("ready");
    } catch (err) {
      setLoadStatus("error");
      toast.error(err.response?.data?.message || "Failed to load the user directory.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  async function confirmRemove() {
    const row = userToDelete;
    setDeleting(true);
    try {
      await api.delete(`/users/${row.id}`);
      toast.success(`${row.name}'s account was removed.`);
      setUserToDelete(null);
      await refetch();
    } catch (err) {
      const message = err.response?.data?.message || "Something went wrong while removing this account. Please try again.";
      toast.error(message);
      // Modal stays open on failure so the admin can retry or cancel.
    } finally {
      setDeleting(false);
    }
  }

  async function handleEditSave(updated) {
    await updateUserApi(updated.id, { name: updated.name, email: updated.email, role: ROLE_SLUGS[updated.role] });
    await refetch();
  }

  async function handleForceLogout(row) {
    try {
      await forceLogoutUser(row.id);
      toast.success(`${row.name} has been logged out of all sessions.`);
      await refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong while forcing logout. Please try again.");
    }
  }

  async function handleUnlock(row) {
    try {
      await unlockUserApi(row.id);
      toast.success(`${row.name}'s account has been unlocked.`);
      await refetch();
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong while unlocking this account. Please try again.");
    }
  }

  const filtered = accounts.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q);
    const matchRole = roleFilter === "All Roles" || r.role === roleFilter;
    const matchStatus = statusFilter === "All Statuses" || r.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const onlineCount = accounts.filter((r) => r.status === "Online").length;
  const lockedCount = accounts.filter((r) => r.status === "Locked").length;

  const selSty = { height: 32, padding: "0 28px 0 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", appearance: "none", cursor: "pointer" };

  if (loadStatus === "loading" && accounts.length === 0) {
    return <div style={{ ...cardBase, padding: "48px 24px", textAlign: "center", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Loading user directory…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onAdded={refetch}
        />
      )}

      {userToEdit && (
        <EditUserModal
          user={userToEdit}
          onClose={() => setUserToEdit(null)}
          onSave={handleEditSave}
        />
      )}

      {userToDelete && (
        <ConfirmDeleteModal
          user={userToDelete}
          deleting={deleting}
          onCancel={() => setUserToDelete(null)}
          onConfirm={confirmRemove}
        />
      )}

      {/* Action Bar Row */}
      <div style={{ background: "#FFFFFF", padding: "0 16px", height: 48, borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ position: "relative", width: 320 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94A3B8", pointerEvents: "none" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users by name or email..."
            style={{ width: "100%", height: 32, paddingLeft: 36, paddingRight: 12, borderRadius: 6, border: "1px solid #E2E8F0", background: "#FFFFFF", fontSize: 13, color: "#1E293B", outline: "none", fontFamily: "'Inter', sans-serif", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative" }}>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={selSty}>
              <option>All Roles</option>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </select>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <div style={{ position: "relative" }}>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selSty}>
              <option>All Statuses</option>
              <option>Online</option>
              <option>Offline</option>
              <option>Locked</option>
            </select>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          <button onClick={() => setShowAddModal(true)} style={{ height: 32, padding: "0 16px", borderRadius: 6, background: "#1E293B", color: "#FFFFFF", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>Add New User</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Users</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif", display: "block", marginBottom: 6 }}>{accounts.length}</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{accounts.filter((r) => r.role.includes("Admin") || r.role === "Managing Director").length} admin, {accounts.filter((r) => r.role === "Field Crew").length} crew.</p>
        </div>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Currently Online</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#22C55E", fontFamily: "'Inter', sans-serif", display: "block", marginBottom: 6 }}>{onlineCount}</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Across active sessions.</p>
        </div>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Security Alerts</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: lockedCount > 0 ? "#EF4444" : "#22C55E", fontFamily: "'Inter', sans-serif", display: "block", marginBottom: 6 }}>{lockedCount}</span>
          <p style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{lockedCount > 0 ? `${lockedCount} account${lockedCount > 1 ? "s" : ""} locked due to failed logins.` : "No locked accounts."}</p>
        </div>
      </div>

      {/* User Directory */}
      <div style={{ ...cardBase, overflow: "hidden" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>User Directory</h2>
          <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>{filtered.length} of {accounts.length} users</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
              {["User Info", "Role", "Current Status", "Last Login", "Actions"].map((col) => (
                <th key={col} style={{ padding: "11px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Inter', sans-serif", background: "#F8FAFC", whiteSpace: "nowrap" }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>
                  No users match your filters.
                </td>
              </tr>
            ) : filtered.map((row, i) => {
              const dotColor = row.status === "Online" ? "#22C55E" : row.status === "Locked" ? "#EF4444" : "#64748B";
              return (
                <tr key={row.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #F1F5F9" : "none", height: 52, background: row.status === "Locked" ? "#FEF2F2" : "#FFFFFF" }}>
                  <td style={{ padding: "0 16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.name}</span>
                      <span style={{ fontSize: 12, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{row.email}</span>
                    </div>
                  </td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.role}</td>
                  <td style={{ padding: "0 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ fontSize: 13, fontWeight: row.status !== "Offline" ? 600 : 400, color: row.status === "Locked" ? "#EF4444" : "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.status}</span>
                    </div>
                  </td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{row.lastLogin}</td>
                  <td style={{ padding: "0 16px" }}>
                    {/* marginLeft cancels ActionButton's own 12px left padding, so "Remove"'s
                        text lines up with the "Actions" header above rather than sitting
                        12px further right than it. */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: 16, marginLeft: -12 }}>
                      <ActionButton variant="info" onClick={() => setUserToEdit(row)}>Edit</ActionButton>
                      <ActionButton variant="neutral" onClick={() => setUserToDelete(row)}>Remove</ActionButton>
                      {row.status === "Online" && (
                        <ActionButton variant="destructive" onClick={() => handleForceLogout(row)}>Force Logout</ActionButton>
                      )}
                      {row.status === "Locked" && (
                        <ActionButton variant="info" onClick={() => handleUnlock(row)}>Unlock</ActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Start the dev servers and manually verify**

Run: `cd backend && npm run dev` (in one terminal) and `cd frontend && npm run dev` (in another)
Log in as `doris@efar.com.sg`, open Accounts Management, and confirm: the table loads real users, Add/Edit/Remove/Force Logout/Unlock all work end-to-end, and a locked account's row shows the `#FEF2F2` risk background.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/dashboard/Management.jsx
git commit -m "feat(frontend): wire Accounts Management to real backend data"
```

---

## Task 8: Update Liang Yi's tests and add new session-behavior tests

**Files:**
- Modify: `frontend/tests/liang-yi/Management.test.jsx`
- Create: `frontend/tests/jasper/ManagementSessionActions.test.jsx`

**Interfaces:**
- Consumes: the rewritten `Management.jsx` (Task 7)

- [ ] **Step 1: Add a default GET /users mock and update renderPage() in Liang Yi's test file**

In `frontend/tests/liang-yi/Management.test.jsx`, replace:

```js
let mock;

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
});

function renderPage() {
  return render(
    React.createElement(ToastProvider, null, React.createElement(ManagementPage))
  );
}
```

with:

```js
let mock;

const DEFAULT_USERS = [
  { id: 1, name: 'Camilla Cruz', email: 'camilla@efar.com.sg', role: 'quotations_specialist', last_login_at: new Date().toISOString(), last_active_at: new Date().toISOString(), is_online: true, is_locked: false },
];

beforeEach(() => {
  mock = new MockAdapter(api);
  mock.onGet('/users').reply(200, { success: true, data: DEFAULT_USERS });
});

afterEach(() => {
  mock.restore();
});

function renderPage() {
  return render(
    React.createElement(ToastProvider, null, React.createElement(ManagementPage))
  );
}

// Waits for the initial GET /users fetch to resolve and the directory to render.
async function waitForDirectory() {
  await screen.findByText('camilla@efar.com.sg');
}
```

- [ ] **Step 2: Await the directory load and mock the post-action refetch in every existing test**

For each `describe` block in the file, insert `await waitForDirectory();` immediately after `renderPage();` (or after `renderPage(); await addRealUser();` in the Remove-user tests - `addRealUser` already waits for its own row). Additionally, add a follow-up `mock.onGet('/users').reply(...)` before each action that now triggers a refetch:

Replace the `'successful account creation shows a success message and adds the row'` test body:

```js
  test('successful account creation shows a success message and adds the row', async () => {
    mock.onPost('/auth/register').reply(201, {
      success: true,
      data: {
        token: 'fake-jwt',
        user: { id: 99, name: 'Jane Doe', email: 'jane@efar.com.sg', role: 'quotations_specialist' },
      },
    });

    renderPage();
    await openAddUserModal();
    await fillForm({ name: 'Jane Doe', email: 'jane@efar.com.sg', password: 'Efar@2026' });
    await submit();

    // Success message: this app shows all confirmations via in-app toast (per CLAUDE.md),
    // never an inline "email sent" banner - see ToastContext.jsx.
    expect(await screen.findByText('Account created for Jane Doe.')).toBeInTheDocument();

    // Modal closes on success.
    expect(screen.queryByRole('heading', { name: 'Add New User' })).not.toBeInTheDocument();

    // New row appears in the User Directory table.
    expect(screen.getByText('jane@efar.com.sg')).toBeInTheDocument();

    // Sanity-check the actual request payload axios-mock-adapter captured.
    expect(mock.history.post).toHaveLength(1);
    const body = JSON.parse(mock.history.post[0].data);
    expect(body).toMatchObject({ name: 'Jane Doe', email: 'jane@efar.com.sg', role: 'quotations_specialist' });
  });
```

with:

```js
  test('successful account creation shows a success message and refetches the directory', async () => {
    mock.onPost('/auth/register').reply(201, {
      success: true,
      data: {
        token: 'fake-jwt',
        user: { id: 99, name: 'Jane Doe', email: 'jane@efar.com.sg', role: 'quotations_specialist' },
      },
    });

    renderPage();
    await waitForDirectory();

    // The post-creation refetch returns the new user alongside the existing one.
    mock.onGet('/users').reply(200, { success: true, data: [...DEFAULT_USERS, { id: 99, name: 'Jane Doe', email: 'jane@efar.com.sg', role: 'quotations_specialist', last_login_at: null, last_active_at: null, is_online: false, is_locked: false }] });

    await openAddUserModal();
    await fillForm({ name: 'Jane Doe', email: 'jane@efar.com.sg', password: 'Efar@2026' });
    await submit();

    // Success message: this app shows all confirmations via in-app toast (per CLAUDE.md),
    // never an inline "email sent" banner - see ToastContext.jsx.
    expect(await screen.findByText('Account created for Jane Doe.')).toBeInTheDocument();

    // Modal closes on success.
    expect(screen.queryByRole('heading', { name: 'Add New User' })).not.toBeInTheDocument();

    // New row appears in the User Directory table, from the refetch.
    expect(await screen.findByText('jane@efar.com.sg')).toBeInTheDocument();

    // Sanity-check the actual request payload axios-mock-adapter captured.
    const registerCalls = mock.history.post.filter((c) => c.url === '/auth/register');
    expect(registerCalls).toHaveLength(1);
    const body = JSON.parse(registerCalls[0].data);
    expect(body).toMatchObject({ name: 'Jane Doe', email: 'jane@efar.com.sg', role: 'quotations_specialist' });
  });
```

Apply the same pattern (add `await waitForDirectory();` after `renderPage();`, and stub a follow-up `mock.onGet('/users')` before whatever action triggers a refetch) to the remaining tests in the file:

- `'server error (500) shows an error message and keeps the form open'` and the two validation-rejection tests: add `await waitForDirectory();` right after `renderPage();`; no refetch stub needed since these paths never call `onAdded()`.
- `addRealUser()` helper: add `mock.onGet('/users').reply(200, { success: true, data: [...DEFAULT_USERS, { id: 99, name: 'Jane Doe', email: 'jane@efar.com.sg', role: 'quotations_specialist', last_login_at: null, last_active_at: null, is_online: false, is_locked: false }] });` immediately before `await openAddUserModal();` inside the helper, and add `await waitForDirectory();` as its first line.
- The three Remove-user tests: no change needed beyond `addRealUser()` now waiting for the directory itself; for the successful-removal test, add `mock.onGet('/users').reply(200, { success: true, data: DEFAULT_USERS });` (the post-delete refetch, back to just the original user) before clicking "Remove User".
- Edit-user tests: replace `'Camilla Cruz'` displayed-value assertions with the same value (already matches `DEFAULT_USERS[0]`), add `await waitForDirectory();` after `renderPage();`, and for the successful-save test replace the mock PATCH + expectation:

Replace:

```js
  test('Save Changes updates the row in the table and closes the modal', async () => {
    renderPage();

    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const nameInput = screen.getByDisplayValue('Camilla Cruz');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Camilla Wong');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText("Camilla Wong's account was updated.")).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Edit User' })).not.toBeInTheDocument();
    expect(screen.getByText('Camilla Wong')).toBeInTheDocument();
    expect(screen.queryByText('Camilla Cruz')).not.toBeInTheDocument();

    // This is a placeholder implementation - no backend call is made yet.
    expect(mock.history.patch).toHaveLength(0);
    expect(mock.history.put).toHaveLength(0);
  });
```

with:

```js
  test('Save Changes calls PATCH /api/users/:id, refetches, and closes the modal', async () => {
    renderPage();
    await waitForDirectory();

    mock.onPatch('/users/1').reply(200, { success: true, data: { id: 1, name: 'Camilla Wong', email: 'camilla@efar.com.sg', role: 'quotations_specialist' } });
    mock.onGet('/users').reply(200, { success: true, data: [{ ...DEFAULT_USERS[0], name: 'Camilla Wong' }] });

    await userEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const nameInput = screen.getByDisplayValue('Camilla Cruz');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Camilla Wong');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByText("Camilla Wong's account was updated.")).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Edit User' })).not.toBeInTheDocument();
    expect(await screen.findByText('Camilla Wong')).toBeInTheDocument();
    expect(screen.queryByText('Camilla Cruz')).not.toBeInTheDocument();

    expect(mock.history.patch).toHaveLength(1);
    expect(JSON.parse(mock.history.patch[0].data)).toMatchObject({ name: 'Camilla Wong', email: 'camilla@efar.com.sg', role: 'quotations_specialist' });
  });
```

and for the email-rejection and Cancel tests in that `describe` block, add `await waitForDirectory();` after `renderPage();` and leave the rest unchanged (they never reach the PATCH call, matching their existing "modal stays open / nothing changed" assertions).

- [ ] **Step 3: Run Liang Yi's suite to verify it passes against the real component**

Run: `cd frontend && npx jest tests/liang-yi/Management.test.jsx`
Expected: PASS (all tests)

- [ ] **Step 4: Write the new session-behavior tests**

Create `frontend/tests/jasper/ManagementSessionActions.test.jsx`:

```js
jest.mock('../../src/api', () => {
  const axios = require('axios');
  return { __esModule: true, default: axios.create() };
});

const axiosMockAdapter = require('axios-mock-adapter');
const MockAdapter = axiosMockAdapter.default || axiosMockAdapter;
const api = require('../../src/api').default;

const React = require('react');
const { render, screen } = require('@testing-library/react');
const userEvent = require('@testing-library/user-event').default;

const { ToastProvider } = require('../../src/context/ToastContext');
const ManagementPage = require('../../src/pages/dashboard/Management').default;

let mock;

const ONLINE_USER = { id: 10, name: 'Sarah Lim', email: 'sarah@efar.com.sg', role: 'ar_specialist', last_login_at: new Date().toISOString(), last_active_at: new Date().toISOString(), is_online: true, is_locked: false };
const LOCKED_USER = { id: 11, name: 'Chloe Tan', email: 'chloe@efar.com.sg', role: 'ap_specialist', last_login_at: new Date().toISOString(), last_active_at: null, is_online: false, is_locked: true };

beforeEach(() => {
  mock = new MockAdapter(api);
});

afterEach(() => {
  mock.restore();
});

function renderPage() {
  return render(React.createElement(ToastProvider, null, React.createElement(ManagementPage)));
}

describe('Accounts Management - Force Logout', () => {
  test('is only shown for an Online user, calls the force-logout endpoint, and refetches', async () => {
    mock.onGet('/users').reply(200, { success: true, data: [ONLINE_USER, LOCKED_USER] });
    renderPage();
    await screen.findByText('sarah@efar.com.sg');

    // Only the Online user gets a Force Logout button; the Locked user gets Unlock instead.
    expect(screen.getAllByRole('button', { name: 'Force Logout' })).toHaveLength(1);

    mock.onPost('/users/10/force-logout').reply(200, { success: true, data: { message: 'User has been logged out of all sessions.' } });
    mock.onGet('/users').reply(200, { success: true, data: [{ ...ONLINE_USER, is_online: false }, LOCKED_USER] });

    await userEvent.click(screen.getByRole('button', { name: 'Force Logout' }));

    expect(await screen.findByText('Sarah Lim has been logged out of all sessions.')).toBeInTheDocument();
    expect(mock.history.post.filter((c) => c.url === '/users/10/force-logout')).toHaveLength(1);
  });
});

describe('Accounts Management - Unlock', () => {
  test('is only shown for a Locked user, calls the unlock endpoint, refetches, and clears the risk row', async () => {
    mock.onGet('/users').reply(200, { success: true, data: [ONLINE_USER, LOCKED_USER] });
    renderPage();
    await screen.findByText('chloe@efar.com.sg');

    expect(screen.getAllByRole('button', { name: 'Unlock' })).toHaveLength(1);

    mock.onPost('/users/11/unlock').reply(200, { success: true, data: { message: 'User account has been unlocked.' } });
    mock.onGet('/users').reply(200, { success: true, data: [ONLINE_USER, { ...LOCKED_USER, is_locked: false }] });

    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));

    expect(await screen.findByText("Chloe Tan's account has been unlocked.")).toBeInTheDocument();
    expect(mock.history.post.filter((c) => c.url === '/users/11/unlock')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Unlock' })).not.toBeInTheDocument();
  });
});

describe('Accounts Management - KPI cards', () => {
  test('Security Alerts reflects the real count of locked accounts', async () => {
    mock.onGet('/users').reply(200, { success: true, data: [ONLINE_USER, LOCKED_USER] });
    renderPage();
    await screen.findByText('chloe@efar.com.sg');

    expect(screen.getByText('Security Alerts').closest('div').textContent).toContain('1');
  });
});
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd frontend && npx jest tests/jasper/ManagementSessionActions.test.jsx`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Run the full frontend suite to check for regressions**

Run: `cd frontend && npx jest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/tests/liang-yi/Management.test.jsx frontend/tests/jasper/ManagementSessionActions.test.jsx
git commit -m "test: update Management.test.jsx for real data, add session-action tests"
```
