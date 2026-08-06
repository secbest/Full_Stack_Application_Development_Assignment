# Live Handoff Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the customer -> Quotations -> Field Crew handoff feel live by giving every role a readable in-app notification (bell + badge), fixing the two handoffs that write no notification today, and correcting a stale status side effect and three latent notification-write bugs discovered while investigating.

**Architecture:** The `Notification` model, `notificationService.create()`, and seven write sites already exist across five controllers - nothing can read them today because there is no GET endpoint. This plan adds the read API first (Task 2), then the two missing writes (Tasks 3-4), then fixes the write sites that were already wrong (Task 5), then builds the bell UI on top of the now-working API (Tasks 6-7).

**Tech Stack:** Express + Sequelize (Postgres/Supabase) on the backend; React + Axios on the frontend. Jest for both test suites (backend: mocked models; frontend: `@testing-library/react` + `axios-mock-adapter` against the real shared `api` instance, matching this repo's existing convention).

## Global Constraints

- No email anywhere - all confirmations are in-app toasts or, here, in-app notifications. Never write "confirmation email sent" language.
- No WebSockets/SSE - polling only.
- Every notification write must be non-fatal: it must never cause the triggering request to fail or roll back.
- Every notification read/write route scopes ownership to `req.user.sub` only - never accept a user id from the client.
- Postgres does not let `sequelize.sync({ alter: true })` add values to an existing ENUM type - new enum values need an explicit `ALTER TYPE ... ADD VALUE IF NOT EXISTS` script, run against the real dev database (per project convention: sync + seed the real dev DB in-session after model/column changes, never rely on mocks alone for this).
- Do not add a top header bar, WebSocket infra, notification preferences screen, or a public customer status-lookup page - all explicitly out of scope per the design spec (`docs/superpowers/specs/2026-08-05-live-handoff-notifications-design.md`).
- Follow existing code style exactly: raw Tailwind classes with hex color literals (not a design-token layer), manual outside-click/Escape dropdowns (no Radix `DropdownMenu` - none exists in `components/ui/`), and direct-path imports (no barrel files).

---

### Task 1: Notification enum values + migration script

**Files:**
- Modify: `backend/src/models/Notification.js`
- Create: `backend/src/scripts/add-notification-enum-values.js`

**Interfaces:**
- Produces: `Notification.type` ENUM now accepts `'job_assigned'` and `'memo_returned'` in addition to the four existing values. No function signatures change.

- [ ] **Step 1: Add the two new enum values to the model**

Open `backend/src/models/Notification.js`. Change the `type` field's ENUM list from:

```js
  type: {
    type: DataTypes.ENUM(
      'new_intake_submission',
      'memo_submitted',
      'xero_sync_failed',
      'ocr_low_confidence'
    ),
    allowNull: false,
  },
```

to:

```js
  type: {
    type: DataTypes.ENUM(
      'new_intake_submission',
      'memo_submitted',
      'memo_returned',
      'job_assigned',
      'xero_sync_failed',
      'ocr_low_confidence'
    ),
    allowNull: false,
  },
```

- [ ] **Step 2: Write the migration script**

Create `backend/src/scripts/add-notification-enum-values.js`:

```js
// Adds 'job_assigned' and 'memo_returned' to the notifications.type ENUM.
//
// Background: the Notification model (src/models/Notification.js) now declares these
// two additional ENUM values, but `sequelize.sync({ alter: true })` does not add values
// to an existing Postgres ENUM type - see backend/src/scripts/fix-invoice-contract-nullable.js
// for the same class of limitation with NOT NULL constraints. Without this script,
// inserting a notification with either new type fails with an invalid-input-value error
// that notificationService.create() swallows silently (by design - see notificationService.js),
// so the failure would otherwise be invisible.
//
// ADD VALUE IF NOT EXISTS is idempotent - safe to run repeatedly, and safe even on an
// environment where db:sync already created the type with these values from scratch.
//
// Usage:  node src/scripts/add-notification-enum-values.js
require('dotenv').config()
const sequelize = require('../config')

async function main() {
  try {
    console.log('[add-notification-enum-values] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[add-notification-enum-values] Connected.')

    console.log('[add-notification-enum-values] Adding job_assigned...')
    await sequelize.query('ALTER TYPE "enum_notifications_type" ADD VALUE IF NOT EXISTS \'job_assigned\';')
    console.log('[add-notification-enum-values] Adding memo_returned...')
    await sequelize.query('ALTER TYPE "enum_notifications_type" ADD VALUE IF NOT EXISTS \'memo_returned\';')

    console.log('[add-notification-enum-values] Done. Both values are now valid.')
  } catch (err) {
    console.error('[add-notification-enum-values] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
```

- [ ] **Step 3: Add the npm script**

In `backend/package.json`, add a line inside `"scripts"` next to the existing `db:sync` entry:

```json
    "db:fix-notification-enum": "node src/scripts/add-notification-enum-values.js",
```

- [ ] **Step 4: Run it against the real dev database**

```bash
cd backend
npm run db:sync
npm run db:fix-notification-enum
```

Expected output ends with:
```
[add-notification-enum-values] Done. Both values are now valid.
```

If `db:sync` fails or `db:fix-notification-enum` errors with anything other than "already exists" for a value, stop and investigate before continuing - later tasks insert rows with these enum values, and if the database wasn't actually updated, `notificationService.create()` will swallow the failure silently.

- [ ] **Step 5: Commit**

```bash
git add backend/src/models/Notification.js backend/src/scripts/add-notification-enum-values.js backend/package.json
git commit -m "feat(notifications): add job_assigned and memo_returned enum values"
```

---

### Task 2: Notification read API

**Files:**
- Create: `backend/src/controllers/notificationController.js`
- Create: `backend/src/routes/notificationRoutes.js`
- Modify: `backend/src/routes/index.js`
- Test: `backend/tests/jasper/notificationController.test.js`

**Interfaces:**
- Consumes: `Notification` model (`backend/src/models/index.js`), `authenticate` middleware (`backend/src/middleware/index.js`), `success`/`error`/`notFound` helpers (`backend/src/utils/index.js`).
- Produces: `listNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead` - all exported from `notificationController.js`, mounted at `GET /api/notifications`, `GET /api/notifications/unread-count`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`. Every later task that writes a notification (Tasks 3-5) relies on rows becoming visible through this API; Task 6's frontend API client calls these four routes by path.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/jasper/notificationController.test.js`:

```js
// Owner: Jasper. Unit tests for the notification read API - the missing half of a
// feature that already writes rows (notificationService.create, called from five other
// controllers) but had no way to read them back. Ownership is always req.user.sub; no
// route accepts a user id, so one user can never read or mutate another's notifications.
jest.mock('../../src/models', () => ({
  Notification: {
    findAll: jest.fn(),
    count: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  },
}))

const { Notification } = require('../../src/models')
const {
  listNotifications, getUnreadCount, markAsRead, markAllAsRead,
} = require('../../src/controllers/notificationController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}
function mockReq({ sub = 5, query = {}, params = {} } = {}) {
  return { user: { sub }, query, params }
}

beforeEach(() => jest.clearAllMocks())

describe('listNotifications', () => {
  test('scopes to the caller only, newest first', async () => {
    Notification.findAll.mockResolvedValue([
      { id: 2, type: 'job_assigned', title: 'New job assigned', body: null, link: '/jobs', is_read: false, createdAt: new Date('2026-08-05T02:00:00Z') },
    ])

    const res = mockRes()
    await listNotifications(mockReq({ sub: 5 }), res)

    expect(Notification.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 5 },
      order: [['created_at', 'DESC']],
    }))
    expect(payload(res).data).toHaveLength(1)
    expect(payload(res).data[0]).toMatchObject({ id: 2, type: 'job_assigned', is_read: false })
  })

  test('unread_only=true adds is_read: false to the where clause', async () => {
    Notification.findAll.mockResolvedValue([])

    const res = mockRes()
    await listNotifications(mockReq({ sub: 5, query: { unread_only: 'true' } }), res)

    expect(Notification.findAll).toHaveBeenCalledWith(expect.objectContaining({
      where: { user_id: 5, is_read: false },
    }))
  })
})

describe('getUnreadCount', () => {
  test('returns the count scoped to the caller', async () => {
    Notification.count.mockResolvedValue(3)

    const res = mockRes()
    await getUnreadCount(mockReq({ sub: 5 }), res)

    expect(Notification.count).toHaveBeenCalledWith({ where: { user_id: 5, is_read: false } })
    expect(payload(res).data).toEqual({ count: 3 })
  })
})

describe('markAsRead', () => {
  test('404s when the notification is not owned by the caller (blurred with "does not exist")', async () => {
    Notification.findOne.mockResolvedValue(null)

    const res = mockRes()
    await markAsRead(mockReq({ sub: 5, params: { id: 99 } }), res)

    expect(Notification.findOne).toHaveBeenCalledWith({ where: { id: '99', user_id: 5 } })
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('marks the caller\'s own notification read', async () => {
    const notification = { id: 1, update: jest.fn().mockResolvedValue() }
    Notification.findOne.mockResolvedValue(notification)

    const res = mockRes()
    await markAsRead(mockReq({ sub: 5, params: { id: 1 } }), res)

    expect(notification.update).toHaveBeenCalledWith({ is_read: true })
    expect(payload(res).data).toEqual({ id: 1, is_read: true })
  })
})

describe('markAllAsRead', () => {
  test('updates only the caller\'s unread rows', async () => {
    Notification.update.mockResolvedValue([2])

    const res = mockRes()
    await markAllAsRead(mockReq({ sub: 5 }), res)

    expect(Notification.update).toHaveBeenCalledWith(
      { is_read: true },
      { where: { user_id: 5, is_read: false } }
    )
    expect(payload(res).data).toEqual({ marked_read: true })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
npx jest tests/jasper/notificationController.test.js
```

Expected: FAIL - `Cannot find module '../../src/controllers/notificationController'`.

- [ ] **Step 3: Write the controller**

Create `backend/src/controllers/notificationController.js`:

```js
// Owner: Jasper. Read API for the Notification model - notificationService.create()
// and its seven write sites across five controllers already exist; this is what makes
// those writes readable. Every route is authenticated and every query is scoped to
// req.user.sub - no route accepts a user id, so one user can never read or mutate
// another's notifications.
const { Notification } = require('../models')
const { success, error, notFound } = require('../utils')

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

function serialize(n) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    is_read: n.is_read,
    // Notification has underscored: true with no explicit created_at field, so
    // Sequelize exposes the timestamp as the camelCase createdAt property - reading
    // n.created_at here would silently serialize as undefined (see the identical bug
    // and fix in serviceMemoController.js's created_at handling).
    created_at: n.createdAt,
  }
}

async function listNotifications(req, res) {
  try {
    const { unread_only, limit } = req.query
    const where = { user_id: req.user.sub }
    if (unread_only === 'true') where.is_read = false

    const parsedLimit = Math.min(parseInt(limit, 10) || DEFAULT_LIMIT, MAX_LIMIT)
    const notifications = await Notification.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parsedLimit,
    })

    return success(res, notifications.map(serialize))
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

async function getUnreadCount(req, res) {
  try {
    const count = await Notification.count({ where: { user_id: req.user.sub, is_read: false } })
    return success(res, { count })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

async function markAsRead(req, res) {
  try {
    const notification = await Notification.findOne({ where: { id: req.params.id, user_id: req.user.sub } })
    if (!notification) return notFound(res, 'Notification not found.')
    await notification.update({ is_read: true })
    return success(res, { id: notification.id, is_read: true })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

async function markAllAsRead(req, res) {
  try {
    await Notification.update({ is_read: true }, { where: { user_id: req.user.sub, is_read: false } })
    return success(res, { marked_read: true })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

module.exports = { listNotifications, getUnreadCount, markAsRead, markAllAsRead }
```

- [ ] **Step 4: Write the routes**

Create `backend/src/routes/notificationRoutes.js`:

```js
const router = require('express').Router()
const { authenticate } = require('../middleware')
const {
  listNotifications, getUnreadCount, markAsRead, markAllAsRead,
} = require('../controllers/notificationController')

// No authorise() - every authenticated role reads/marks only its own notifications,
// the same self-service pattern as PATCH /users/me (userRoutes.js).
// Specific paths declared before /:id so a literal segment is never captured as an id.
router.get('/unread-count', authenticate, getUnreadCount)
router.get('/', authenticate, listNotifications)
router.patch('/read-all', authenticate, markAllAsRead)
router.patch('/:id/read', authenticate, markAsRead)

module.exports = router
```

- [ ] **Step 5: Mount the routes**

In `backend/src/routes/index.js`, add near the top, right after the shared `userRoutes` mount (since notifications are shared by every role, not owned by one feature area):

```js
const userRoutes = require('./userRoutes')               // GET /users?role= (crew list); PATCH /users/me, PATCH /users/me/password (self-service); DELETE /users/:id (managing_director only)
router.use('/users', userRoutes)

// ─── Shared: Notifications ─────────────────────────────────────────────────────
// Every role reads and marks only its own notifications. Writes happen from inside
// other controllers via notificationService.create() - this route file only reads.
const notificationRoutes = require('./notificationRoutes')
router.use('/notifications', notificationRoutes)

// ─── Zheng Bao: Customer Intake & Booking Management ──────────────────────────
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd backend
npx jest tests/jasper/notificationController.test.js
```

Expected: PASS, 6 tests.

- [ ] **Step 7: Append to the test log**

Add a row to `backend/tests/jasper/test-cases.md`:

```
| 9 | notificationController.test.js | `listNotifications`/`getUnreadCount`/`markAsRead`/`markAllAsRead` - the notification read API, with `Notification` mocked | Every query is scoped to `req.user.sub`; `unread_only=true` adds `is_read: false` to the filter; `markAsRead` on a row not owned by the caller gives a blurred 404 (indistinguishable from "does not exist"); `markAllAsRead` updates only the caller's unread rows |
```

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/notificationController.js backend/src/routes/notificationRoutes.js backend/src/routes/index.js backend/tests/jasper/notificationController.test.js backend/tests/jasper/test-cases.md
git commit -m "feat(notifications): add the notification read API"
```

---

### Task 3: `createIntake` notifies Quotations Specialists

**Files:**
- Modify: `backend/src/controllers/intakeController.js`
- Test: `backend/tests/jasper/intakeNotificationFanout.test.js`

**Interfaces:**
- Consumes: `notificationService.create()` (`backend/src/services/notificationService.js`), `User.findAll` (`backend/src/models/index.js`), the `job_assigned`/`memo_returned`-widened enum from Task 1 (not used directly here, but this write depends on the enum migration from Task 1 having been run, since it inserts a `new_intake_submission` row into the same table).
- Produces: every successful `POST /api/intake` now writes one `new_intake_submission` notification per `quotations_specialist` user. Task 8's browser walkthrough depends on this.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/jasper/intakeNotificationFanout.test.js`:

```js
// Owner: Jasper. createIntake (backend/src/controllers/intakeController.js, owned by
// Zheng Bao) writes an IntakeSubmission but never notified anyone - the enum already
// declared 'new_intake_submission' but nothing ever created one. This covers the new
// fan-out to every quotations_specialist, and that a lookup failure there can never
// turn an already-successful, unauthenticated public submission into a 500.
jest.mock('../../src/models', () => ({
  IntakeSubmission: { findOne: jest.fn(), create: jest.fn() },
  Booking: {},
  Client: {},
  User: { findAll: jest.fn() },
}))
jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))

const { IntakeSubmission, User } = require('../../src/models')
const notificationService = require('../../src/services/notificationService')
const { createIntake } = require('../../src/controllers/intakeController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}
function validBody(overrides = {}) {
  return {
    customer_name: 'John Tan',
    contact_email: 'john.tan@cgh.com.sg',
    contact_phone: '91234567',
    service_type: 'eas',
    service_tier: 'basic',
    preferred_date: '2026-09-01',
    preferred_time: '10:00',
    pickup_location: 'Changi General Hospital',
    destination: 'Singapore General Hospital',
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  IntakeSubmission.findOne
    .mockResolvedValueOnce(null) // dedupe check: no recent duplicate
    .mockResolvedValueOnce(null) // nextReferenceNumber: no prior rows, starts at 1
  IntakeSubmission.create.mockResolvedValue({
    id: 1,
    reference_number: 'EFAR-2026-00001',
    status: 'pending',
    customer_name: 'John Tan',
    createdAt: new Date('2026-08-05T00:00:00Z'),
  })
})

describe('createIntake - notification fan-out', () => {
  test('notifies every quotations_specialist with the intake queue link', async () => {
    User.findAll.mockResolvedValue([{ id: 5 }, { id: 8 }])

    const res = mockRes()
    await createIntake({ body: validBody() }, res)

    expect(User.findAll).toHaveBeenCalledWith({ where: { role: 'quotations_specialist' } })
    expect(notificationService.create).toHaveBeenCalledTimes(2)
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 5, type: 'new_intake_submission', link: '/intake-queue',
    }))
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 8, type: 'new_intake_submission', link: '/intake-queue',
    }))
    expect(res.status).toHaveBeenCalledWith(201)
  })

  test('still returns 201 when the specialist lookup itself throws', async () => {
    // The intake row is already committed by this point - a public, unauthenticated
    // customer must never see a failure caused by the notification fan-out.
    User.findAll.mockRejectedValue(new Error('connection reset'))

    const res = mockRes()
    await createIntake({ body: validBody() }, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(payload(res).data.reference_number).toBe('EFAR-2026-00001')
  })

  test('does nothing and still succeeds when there are no quotations specialists', async () => {
    User.findAll.mockResolvedValue([])

    const res = mockRes()
    await createIntake({ body: validBody() }, res)

    expect(notificationService.create).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(201)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
npx jest tests/jasper/intakeNotificationFanout.test.js
```

Expected: FAIL - `User.findAll` never called (0 times, expected 1) on the first test.

- [ ] **Step 3: Implement the fan-out**

In `backend/src/controllers/intakeController.js`, add the import at the top:

```js
const { Op } = require('sequelize')
const { IntakeSubmission, Booking, Client, User } = require('../models')
const { success, created, error, notFound } = require('../utils')
const { intakeCreateSchema, intakeConfirmSchema, intakeRejectSchema } = require('../validators')
const notificationService = require('../services/notificationService')
```

Then, in `createIntake`, insert the fan-out between the `IntakeSubmission.create(...)` call and the `return created(...)`:

```js
    const intake = await IntakeSubmission.create({
      reference_number: buildReference('EFAR-2026', nextNumber),
      status: 'pending',
      customer_name: body.customer_name,
      organisation: body.organisation || null,
      contact_email: body.contact_email,
      contact_phone: body.contact_phone,
      service_type: body.service_type,
      service_tier: body.service_tier,
      preferred_date: body.preferred_date,
      preferred_time: body.preferred_time,
      pickup_location: body.pickup_location,
      destination: body.destination,
      additional_notes: body.additional_notes || null,
    })

    // Non-fatal and isolated from the outer catch on purpose: the intake above is
    // already committed, and this is a public, unauthenticated form - a failure here
    // (e.g. the specialist lookup itself throwing) must never turn a successful
    // submission into a 500 for the customer. The Intake Queue is the reliable fallback.
    try {
      const quotationsSpecialists = await User.findAll({ where: { role: 'quotations_specialist' } })
      await Promise.all(quotationsSpecialists.map((specialist) =>
        notificationService.create({
          user_id: specialist.id,
          type: 'new_intake_submission',
          title: 'New service request received',
          body: `${intake.customer_name} submitted a new request (${intake.reference_number}).`,
          link: '/intake-queue',
        })
      ))
    } catch (notifyErr) {
      console.error('[createIntake] Failed to notify Quotations Specialists:', notifyErr.message)
    }

    return created(res, {
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend
npx jest tests/jasper/intakeNotificationFanout.test.js
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Append to the test log**

Add a row to `backend/tests/jasper/test-cases.md`:

```
| 10 | intakeNotificationFanout.test.js | `createIntake`'s new notification fan-out to every `quotations_specialist` | One `new_intake_submission` notification is created per specialist, linking to `/intake-queue`; a failure in the specialist lookup itself is caught locally and never turns the already-committed 201 into a 500; zero specialists means zero notification calls, not an error |
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/intakeController.js backend/tests/jasper/intakeNotificationFanout.test.js backend/tests/jasper/test-cases.md
git commit -m "feat(notifications): notify Quotations Specialists on new intake submissions"
```

---

### Task 4: `updateBookingCrew` notifies the assigned crew and stops lying about status

**Files:**
- Modify: `backend/src/controllers/bookingController.js`
- Test: `backend/tests/jasper/bookingCrewNotification.test.js`

**Interfaces:**
- Consumes: `notificationService.create()`.
- Produces: `PATCH /bookings/:id/crew` now writes one `job_assigned` notification when a booking gains a new (different) crew member, and no longer sets `status: 'in_progress'` as a side effect - `recordMilestone`'s `activated` tap (`backend/src/controllers/jobMilestoneController.js`, unchanged) becomes the sole trigger for that transition. Task 8's browser walkthrough depends on this.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/jasper/bookingCrewNotification.test.js`:

```js
// Owner: Jasper. updateBookingCrew (backend/src/controllers/bookingController.js,
// owned by Zheng Bao) had two problems: it wrote no notification when assigning crew,
// and it moved a booking straight to 'in_progress' as a side effect of assignment - a
// second, stale trigger for the same transition jobMilestoneController's 'activated'
// tap already owns (see that file's own comment: "previously this only happened as a
// side effect of crew assignment", written when the milestone trigger was added but the
// assignment side effect was never removed). This covers both fixes: the job_assigned
// notification only fires on a real change, and status is left alone entirely here.
jest.mock('../../src/models', () => ({
  Booking: { findByPk: jest.fn() },
  User: { findOne: jest.fn() },
}))
jest.mock('../../src/validators', () => ({
  bookingCrewSchema: { validate: jest.fn((body) => Promise.resolve(body)) },
}))
jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))

const { Booking, User } = require('../../src/models')
const notificationService = require('../../src/services/notificationService')
const { updateBookingCrew } = require('../../src/controllers/bookingController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}
function mockBooking(overrides = {}) {
  const booking = {
    id: 1,
    reference_number: 'BKG-2026-00001',
    status: 'confirmed',
    assigned_crew_id: null,
    assignedCrew: null,
    ...overrides,
  }
  booking.update = jest.fn(async (fields) => { Object.assign(booking, fields); return booking })
  booking.reload = jest.fn(async () => booking)
  return booking
}
function mockReq(bookingId, assigned_crew_id) {
  return { params: { id: bookingId }, body: { assigned_crew_id } }
}

beforeEach(() => jest.clearAllMocks())

describe('updateBookingCrew - notification', () => {
  test('assigning a new crew member notifies them and leaves status untouched', async () => {
    const booking = mockBooking({ status: 'confirmed', assigned_crew_id: null })
    Booking.findByPk.mockResolvedValue(booking)
    User.findOne.mockResolvedValue({ id: 42, role: 'field_crew' })
    booking.reload = jest.fn(async () => { booking.assignedCrew = { id: 42, name: 'Ravi Kumar' }; return booking })

    const res = mockRes()
    await updateBookingCrew(mockReq(1, 42), res)

    expect(booking.update).toHaveBeenCalledWith({ assigned_crew_id: 42 })
    expect(booking.status).toBe('confirmed')
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42, type: 'job_assigned', link: '/jobs',
    }))
    expect(payload(res).data.status).toBe('confirmed')
  })

  test('re-saving the same crew member does not notify again', async () => {
    const booking = mockBooking({ status: 'in_progress', assigned_crew_id: 42 })
    Booking.findByPk.mockResolvedValue(booking)
    User.findOne.mockResolvedValue({ id: 42, role: 'field_crew' })

    const res = mockRes()
    await updateBookingCrew(mockReq(1, 42), res)

    expect(notificationService.create).not.toHaveBeenCalled()
  })

  test('unassigning does not notify', async () => {
    const booking = mockBooking({ status: 'in_progress', assigned_crew_id: 42 })
    Booking.findByPk.mockResolvedValue(booking)

    const res = mockRes()
    await updateBookingCrew(mockReq(1, null), res)

    expect(booking.update).toHaveBeenCalledWith({ assigned_crew_id: null })
    expect(notificationService.create).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
npx jest tests/jasper/bookingCrewNotification.test.js
```

Expected: FAIL - first test's `booking.status` is `'in_progress'`, not `'confirmed'` (the stale side effect still runs), and `notificationService.create` was never called.

- [ ] **Step 3: Implement the fix**

In `backend/src/controllers/bookingController.js`, add the import at the top:

```js
const { Op } = require('sequelize')
const { Booking, Client, User, IntakeSubmission, ServiceMemo, Invoice, JobMilestone } = require('../models')
const { success, error, notFound, forbidden, internalError } = require('../utils')
const { bookingCrewSchema } = require('../validators')
const { serializeMilestones } = require('./jobMilestoneController')
const notificationService = require('../services/notificationService')
```

Then replace the entire `updateBookingCrew` function:

```js
async function updateBookingCrew(req, res) {
  try {
    const body = await bookingCrewSchema.validate(req.body, { abortEarly: false, stripUnknown: true })
    const booking = await Booking.findByPk(req.params.id, {
      include: [{ model: User, as: 'assignedCrew', attributes: ['id', 'name'] }],
    })
    if (!booking) return notFound(res, 'Booking not found.')
    if (['completed', 'invoiced'].includes(booking.status)) {
      return error(res, 'Crew reassignment is not allowed for completed or invoiced bookings.', 'BOOKING_COMPLETED', 409)
    }

    const previousCrewId = booking.assigned_crew_id

    let assignedCrewId = null
    if (body.assigned_crew_id !== null) {
      const crew = await User.findOne({ where: { id: body.assigned_crew_id, role: 'field_crew' } })
      if (!crew) return error(res, 'Crew member not found.', 'CREW_NOT_FOUND', 404)
      assignedCrewId = crew.id
    }

    // Status is deliberately untouched here. jobMilestoneController's 'activated' tap
    // is the sole confirmed -> in_progress trigger (see Booking.js's status comment) -
    // assigning crew no longer starts the job on its own, so a job never reads as
    // "in progress" before the crew has actually started it.
    await booking.update({ assigned_crew_id: assignedCrewId })
    await booking.reload({ include: [{ model: User, as: 'assignedCrew', attributes: ['id', 'name'] }] })

    // Notify only on a real change - re-saving the same crew member, or unassigning,
    // is not a new assignment worth interrupting anyone for.
    if (assignedCrewId && assignedCrewId !== previousCrewId) {
      await notificationService.create({
        user_id: assignedCrewId,
        type: 'job_assigned',
        title: 'New job assigned',
        body: `You have been assigned to booking ${booking.reference_number}.`,
        link: '/jobs',
      })
    }

    return success(res, {
      id: booking.id,
      reference_number: booking.reference_number,
      assigned_crew_id: booking.assigned_crew_id,
      assigned_crew_name: booking.assignedCrew?.name || null,
      status: booking.status,
    })
  } catch (err) {
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 400)
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd backend
npx jest tests/jasper/bookingCrewNotification.test.js
```

Expected: PASS, 3 tests.

- [ ] **Step 5: Run the full backend suite to confirm no regression**

```bash
cd backend
npx jest
```

Expected: PASS, all suites - no existing test asserted the old `in_progress` side effect (verified during planning: `jobMilestoneController.test.js` and `bookingMilestonesInclude.test.js` test the milestone controller, not `updateBookingCrew`, and no test file references `updateBookingCrew` at all before this task).

- [ ] **Step 6: Append to the test log**

Add a row to `backend/tests/jasper/test-cases.md`:

```
| 11 | bookingCrewNotification.test.js | `updateBookingCrew`'s new `job_assigned` notification and the removal of its stale `confirmed -> in_progress` side effect | Assigning a new crew member notifies them and leaves `status` untouched (`activated` on the milestone endpoint is now the sole trigger); re-assigning the same crew member or unassigning writes no notification |
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/bookingController.js backend/tests/jasper/bookingCrewNotification.test.js backend/tests/jasper/test-cases.md
git commit -m "fix(bookings): notify assigned crew and stop assignment from starting the job"
```

---

### Task 5: Fix the three latent write-site bugs

**Files:**
- Modify: `backend/src/controllers/serviceMemoController.js`
- Modify: `backend/src/controllers/memoReviewController.js`
- Modify: `backend/src/controllers/invoiceController.js`
- Test: `backend/tests/jasper/notificationWriteSiteFixes.test.js`

**Interfaces:**
- Consumes: `notificationService.create()`, `User.findOne` (`invoiceController.js` only).
- Produces: corrected `link`/`type`/`user_id` values on three existing notification writes. No function signatures change.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/jasper/notificationWriteSiteFixes.test.js`:

```js
// Owner: Jasper. Three notification write sites were already wrong before the read API
// existed to expose it:
//   1. serviceMemoController and memoReviewController both linked to /memos/:id, which
//      is not a route in App.jsx - every click would 404.
//   2. memoReviewController's "memo returned for correction" notification used type
//      'memo_submitted' instead of the new 'memo_returned'.
//   3. invoiceController's Xero sync-failure notification passed
//      `user_id: invoice.approved_by || null`, but Notification.user_id is NOT NULL -
//      when approved_by was null the insert threw and notificationService swallowed it,
//      so the alert vanished with no trace. Fixed by falling back to the AR Specialist.
jest.mock('../../src/models', () => ({
  ServiceMemo: { findByPk: jest.fn(), findOne: jest.fn() },
  MemoSignature: { create: jest.fn() },
  Booking: { findByPk: jest.fn(), update: jest.fn() },
  Client: { findByPk: jest.fn() },
  Invoice: { findOne: jest.fn(), findByPk: jest.fn() },
  InvoiceLineItem: { findAll: jest.fn() },
  User: { findOne: jest.fn() },
  PricingContract: {},
  XeroSyncLog: { create: jest.fn() },
}))
jest.mock('../../src/config', () => ({ transaction: jest.fn((cb) => cb({})) }))
jest.mock('../../src/services/cloudinaryService', () => ({ uploadBuffer: jest.fn() }))
jest.mock('../../src/services/notificationService', () => ({ create: jest.fn() }))
jest.mock('../../src/services', () => ({ pricingService: {}, xeroService: { pushArInvoice: jest.fn() } }))
jest.mock('../../src/controllers/xeroController', () => ({ getFreshConnection: jest.fn() }))

const { ServiceMemo, Booking, Invoice, InvoiceLineItem, Client, User, XeroSyncLog } = require('../../src/models')
const { xeroService } = require('../../src/services')
const xeroController = require('../../src/controllers/xeroController')
const notificationService = require('../../src/services/notificationService')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

beforeEach(() => jest.clearAllMocks())

describe('serviceMemoController - memo_submitted link fix', () => {
  const { createServiceMemo } = require('../../src/controllers/serviceMemoController')

  test('links to /service-memos (the real AR review route), not /memos/:id', async () => {
    Booking.findByPk.mockResolvedValue({ id: 10, reference_number: 'BKG-2026-00010', status: 'in_progress', update: jest.fn().mockResolvedValue() })
    ServiceMemo.findOne.mockResolvedValue(null) // no memo already exists for this booking
    ServiceMemo.create = jest.fn().mockResolvedValue({ id: 7, patient_name: 'Test Patient' })
    require('../../src/models').MemoSignature.create.mockResolvedValue({ id: 1 })
    User.findOne.mockResolvedValue({ id: 3 })

    const res = mockRes()
    await createServiceMemo({
      body: { booking_id: 10, signature: {} },
      user: { sub: 99 },
    }, res)

    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({ link: '/service-memos' }))
  })
})

describe('memoReviewController - returnMemo link + type fix', () => {
  const { returnMemo } = require('../../src/controllers/memoReviewController')

  test('uses type memo_returned and links to /memos/history, not /memos/:id', async () => {
    const memo = { id: 5, submitted_by: 99, update: jest.fn().mockResolvedValue() }
    ServiceMemo.findByPk.mockResolvedValue(memo)
    Invoice.findOne.mockResolvedValue(null)

    const res = mockRes()
    await returnMemo({ params: { id: 5 }, body: { note: 'Missing signature' }, user: { sub: 2 } }, res)

    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'memo_returned',
      link: '/memos/history',
    }))
  })
})

describe('invoiceController - Xero sync-failure fallback', () => {
  const { retryXero } = require('../../src/controllers/invoiceController')

  function makeInvoice(overrides = {}) {
    const obj = { id: 1, status: 'failed', tax_amount: 0, subtotal: 850, total_amount: 850, ...overrides }
    obj.update = jest.fn(async (fields) => { Object.assign(obj, fields); return obj })
    return obj
  }

  test('falls back to the AR Specialist when approved_by is null', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ approved_by: null }))
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: false, error: 'Xero rejected the invoice' })
    XeroSyncLog.create.mockResolvedValue({})
    User.findOne.mockResolvedValue({ id: 11, role: 'ar_specialist' })

    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)

    expect(User.findOne).toHaveBeenCalledWith({ where: { role: 'ar_specialist' } })
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 11 }))
  })

  test('keeps returning 502 XERO_SYNC_ERROR even if the AR Specialist lookup itself throws', async () => {
    // Regression guard: this must never let a lookup failure turn a routine Xero
    // rejection into an unrelated 500 for the AR Specialist retrying the sync.
    Invoice.findByPk.mockResolvedValue(makeInvoice({ approved_by: null }))
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: false, error: 'Xero rejected the invoice' })
    XeroSyncLog.create.mockResolvedValue({})
    User.findOne.mockRejectedValue(new Error('connection reset'))

    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(502)
    expect(notificationService.create).not.toHaveBeenCalled()
  })

  test('still uses approved_by directly when present, without querying User at all', async () => {
    Invoice.findByPk.mockResolvedValue(makeInvoice({ approved_by: 7 }))
    xeroController.getFreshConnection.mockResolvedValue({ xero_tenant_id: 'demo', access_token: 'demo' })
    Client.findByPk.mockResolvedValue({ name: 'TTSH' })
    InvoiceLineItem.findAll.mockResolvedValue([])
    xeroService.pushArInvoice.mockResolvedValue({ ok: false, error: 'Xero rejected the invoice' })
    XeroSyncLog.create.mockResolvedValue({})

    const res = mockRes()
    await retryXero({ params: { id: 1 } }, res)

    expect(User.findOne).not.toHaveBeenCalled()
    expect(notificationService.create).toHaveBeenCalledWith(expect.objectContaining({ user_id: 7 }))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd backend
npx jest tests/jasper/notificationWriteSiteFixes.test.js
```

Expected: FAIL on all three describe blocks - the links are still `/memos/7` and `/memos/5`, the type is still `memo_submitted`, and `User.findOne` is never called from `invoiceController`.

- [ ] **Step 3: Fix `serviceMemoController.js`**

Change (currently around line 148):

```js
      body: `Memo for booking #${booking.id} (${memo.patient_name || booking.reference_number}) is awaiting review.`,
      link: `/memos/${memo.id}`,
```

to:

```js
      body: `Memo for booking #${booking.id} (${memo.patient_name || booking.reference_number}) is awaiting review.`,
      link: '/service-memos',
```

- [ ] **Step 4: Fix `memoReviewController.js`**

Change (currently around lines 200-204):

```js
      notificationService.create({
        user_id: memo.submitted_by,
        type: 'memo_submitted',
        title: 'A service memo was returned for correction',
        body: note,
        link: `/memos/${memo.id}`,
      })
```

to:

```js
      notificationService.create({
        user_id: memo.submitted_by,
        type: 'memo_returned',
        title: 'A service memo was returned for correction',
        body: note,
        link: '/memos/history',
      })
```

- [ ] **Step 5: Fix `invoiceController.js`**

Add a small local helper right after the existing `round2`/`VALID_STATUSES`/`LOCKED_STATUSES` constants near the top of the file:

```js
// Falls back to the AR Specialist when an invoice has no approved_by (e.g. retried
// after a status reset). Wrapped in its own try/catch, matching notificationService's
// own "never throw" contract - a failure resolving the fallback recipient must never
// turn a routine Xero-push failure into an unrelated 500 for whoever is retrying it.
async function resolveArSpecialistId() {
  try {
    const arSpecialist = await User.findOne({ where: { role: 'ar_specialist' } })
    return arSpecialist ? arSpecialist.id : null
  } catch (err) {
    console.error('[invoiceController] Failed to resolve the AR Specialist fallback for a Xero sync-failure notification:', err.message)
    return null
  }
}
```

Then change the failure branch of `syncInvoiceToXero` (currently around lines 283-290):

```js
  notificationService.create({
    user_id: invoice.approved_by || null,
    type: 'xero_sync_failed',
    title: `Xero sync failed for invoice #${invoice.id}`,
    body: result.error,
    link: '/xero/sync-status',
  })
```

to:

```js
  const recipientId = invoice.approved_by || (await resolveArSpecialistId())
  if (recipientId) {
    notificationService.create({
      user_id: recipientId,
      type: 'xero_sync_failed',
      title: `Xero sync failed for invoice #${invoice.id}`,
      body: result.error,
      link: '/xero/sync-status',
    })
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd backend
npx jest tests/jasper/notificationWriteSiteFixes.test.js
```

Expected: PASS, 5 tests.

- [ ] **Step 7: Run the full backend suite, including Kwan Hua's existing tests**

This step matters specifically: `backend/tests/kwan-hua/invoices.test.js` mocks `User` as an empty object (`User: {}`, no `findOne`), and one of its existing tests (`'502s when Xero rejects the retried push'`) exercises the exact failure branch just changed, with `approved_by` left `undefined`. Confirm `resolveArSpecialistId`'s own try/catch (Step 5) prevents `User.findOne is not a function` from propagating out and turning that test's expected 502 into a 500.

```bash
cd backend
npx jest
```

Expected: PASS, all suites, including `backend/tests/kwan-hua/invoices.test.js` and `backend/tests/kwan-hua/memo-review.test.js` unchanged.

- [ ] **Step 8: Append to the test log**

Add a row to `backend/tests/jasper/test-cases.md`:

```
| 12 | notificationWriteSiteFixes.test.js | Three pre-existing notification write bugs: `serviceMemoController`/`memoReviewController` linking to the non-existent `/memos/:id`, `memoReviewController` mistyping a returned-memo notification as `memo_submitted`, and `invoiceController` dropping the Xero sync-failure alert when `approved_by` is null | Links now point to `/service-memos` and `/memos/history`; the returned-memo notification uses `memo_returned`; the sync-failure notification falls back to the AR Specialist when `approved_by` is null, and a failure in that fallback lookup itself never turns the sync outcome into an unrelated 500 |
```

- [ ] **Step 9: Commit**

```bash
git add backend/src/controllers/serviceMemoController.js backend/src/controllers/memoReviewController.js backend/src/controllers/invoiceController.js backend/tests/jasper/notificationWriteSiteFixes.test.js backend/tests/jasper/test-cases.md
git commit -m "fix(notifications): correct dead links, a mistyped notification, and a silently-dropped Xero alert"
```

---

### Task 6: Frontend notifications API client + `NotificationBell` component

**Files:**
- Create: `frontend/src/api/notifications.js`
- Create: `frontend/src/components/NotificationBell.jsx`
- Test: `frontend/tests/jasper/NotificationBell.test.jsx`

**Interfaces:**
- Consumes: the shared `api` Axios instance (`frontend/src/api/index.js`), the four endpoints from Task 2.
- Produces: `NotificationBell` - a React component with no required props, exported by name (`export function NotificationBell()`), imported by direct path (`@/components/NotificationBell`). Task 7 mounts it in `AppLayout.jsx`.

- [ ] **Step 1: Write the API client**

Create `frontend/src/api/notifications.js`:

```js
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
```

- [ ] **Step 2: Write the failing tests**

Create `frontend/tests/jasper/NotificationBell.test.jsx`:

```js
// Owner: Jasper. NotificationBell is the frontend half of a feature whose backend
// (Notification model, notificationService, seven write sites) already existed with no
// way to read it. Uses axios-mock-adapter against the real shared `api` instance -
// the same convention as MyJobsPage.test.jsx - rather than jest.mock on the wrapper
// module, so a real request that isn't stubbed fails loudly instead of resolving undefined.
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { NotificationBell } from '@/components/NotificationBell'

let mock

beforeEach(() => {
  mock = new MockAdapter(api)
})

afterEach(() => {
  mock.reset()
  jest.useRealTimers()
})

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>
  )
}

function notification(overrides = {}) {
  return {
    id: 1, type: 'job_assigned', title: 'New job assigned', body: 'BKG-2026-00001',
    link: '/jobs', is_read: false, created_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('NotificationBell - badge', () => {
  test('hides the badge when unread count is zero', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { count: 0 } })
    renderBell()

    await waitFor(() => expect(mock.history.get).toHaveLength(1))
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  test('shows the unread count', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { count: 3 } })
    renderBell()

    expect(await screen.findByText('3')).toBeInTheDocument()
  })

  test('shows 9+ above nine', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { count: 12 } })
    renderBell()

    expect(await screen.findByText('9+')).toBeInTheDocument()
  })
})

describe('NotificationBell - dropdown', () => {
  test('clicking an unread notification marks it read and navigates to its link', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { count: 1 } })
    mock.onGet('/notifications').reply(200, { success: true, data: [notification()] })
    mock.onPatch('/notifications/1/read').reply(200, { success: true, data: { id: 1, is_read: true } })
    const user = userEvent.setup()
    renderBell()
    await screen.findByText('1')

    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await screen.findByText('New job assigned')
    await user.click(screen.getByText('New job assigned'))

    await waitFor(() => expect(mock.history.patch).toHaveLength(1))
    expect(mock.history.patch[0].url).toBe('/notifications/1/read')
  })

  test('"Mark all as read" calls the read-all endpoint and clears the badge', async () => {
    mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { count: 2 } })
    mock.onGet('/notifications').reply(200, { success: true, data: [notification(), notification({ id: 2 })] })
    mock.onPatch('/notifications/read-all').reply(200, { success: true, data: { marked_read: true } })
    const user = userEvent.setup()
    renderBell()
    await screen.findByText('2')

    await user.click(screen.getByRole('button', { name: /notifications/i }))
    await screen.findByText('Mark all as read')
    await user.click(screen.getByText('Mark all as read'))

    await waitFor(() => expect(mock.history.patch).toHaveLength(1))
    expect(mock.history.patch[0].url).toBe('/notifications/read-all')
    expect(screen.queryByText('2')).not.toBeInTheDocument()
  })
})

describe('NotificationBell - polling', () => {
  test('pauses while the document is hidden and resumes when visible again', async () => {
    jest.useFakeTimers({ legacyFakeTimers: false })
    let requestCount = 0
    mock.onGet('/notifications/unread-count').reply(() => { requestCount += 1; return [200, { success: true, data: { count: 0 } }] })
    renderBell()
    await waitFor(() => expect(requestCount).toBe(1))

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    await jest.advanceTimersByTimeAsync(30000)
    expect(requestCount).toBe(1)

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await waitFor(() => expect(requestCount).toBe(2))
  })

  test('clears its interval on unmount', async () => {
    jest.useFakeTimers({ legacyFakeTimers: false })
    let requestCount = 0
    mock.onGet('/notifications/unread-count').reply(() => { requestCount += 1; return [200, { success: true, data: { count: 0 } }] })
    const { unmount } = renderBell()
    await waitFor(() => expect(requestCount).toBe(1))

    unmount()
    await jest.advanceTimersByTimeAsync(60000)

    expect(requestCount).toBe(1)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
cd frontend
npx jest tests/jasper/NotificationBell.test.jsx
```

Expected: FAIL - `Cannot find module '@/components/NotificationBell'`.

- [ ] **Step 4: Write the component**

Create `frontend/src/components/NotificationBell.jsx`:

```jsx
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

  const refreshUnreadCount = useCallback(async () => {
    try {
      const { data } = await getUnreadCount()
      setUnreadCount(data.data.count)
    } catch {
      // Degrade quietly - keep the last known count, the next poll will recover it.
    }
  }, [])

  // Fetch at mount (this is what satisfies "notified when she logs in"), then re-poll
  // every 30s so a notification created while already logged in still surfaces.
  // Paused while the tab is hidden so a backgrounded session doesn't hold a Supabase
  // connection open all day, and refetched immediately on becoming visible again.
  useEffect(() => {
    refreshUnreadCount()
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') refreshUnreadCount()
    }, POLL_MS)
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') refreshUnreadCount()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
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
      setNotifications(data.data)
    } catch {
      setNotifications([])
    } finally {
      setLoadingList(false)
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
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
cd frontend
npx jest tests/jasper/NotificationBell.test.jsx
```

Expected: PASS, 7 tests.

- [ ] **Step 6: Append to the test log**

Add a row to `frontend/tests/jasper/test-cases.md`:

```
| 7 | NotificationBell.test.jsx | The notification bell shared by every role's chrome, against the real `api` instance via `axios-mock-adapter` | Badge is hidden at zero, shows the count, and shows `9+` above nine; clicking an unread item PATCHes it read and navigates to its `link`; "Mark all as read" PATCHes the read-all endpoint and clears the badge; the 30s poll pauses while `document.visibilityState` is `hidden` and resumes on `visibilitychange`; the interval is cleared on unmount |
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/api/notifications.js frontend/src/components/NotificationBell.jsx frontend/tests/jasper/NotificationBell.test.jsx frontend/tests/jasper/test-cases.md
git commit -m "feat(notifications): add the notification bell component"
```

---

### Task 7: Wire the bell into `AppLayout`

**Files:**
- Modify: `frontend/src/layouts/AppLayout.jsx`
- Modify: `frontend/tests/jasper/AppLayout.mobile.test.jsx`

**Interfaces:**
- Consumes: `NotificationBell` (Task 6).
- Produces: the bell renders in the mobile top bar and in the desktop sidebar header (both expanded and rail-collapsed states) for every authenticated role.

- [ ] **Step 1: Update the existing `AppLayout` test to stub the new endpoint**

`AppLayout.mobile.test.jsx` does not currently set up `axios-mock-adapter`. Once `AppLayout` renders `NotificationBell`, every test in that file will trigger a real, unmocked `GET /notifications/unread-count` on mount. Add a mock before that happens.

In `frontend/tests/jasper/AppLayout.mobile.test.jsx`, add the import and setup:

```js
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MockAdapter from 'axios-mock-adapter'
import api from '@/api/index'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import AppLayout from '@/layouts/AppLayout'
```

and, right after the existing `const DESKTOP = 1280` / `const PHONE = 375` constants:

```js
let mock

beforeEach(() => {
  mock = new MockAdapter(api)
  mock.onGet('/notifications/unread-count').reply(200, { success: true, data: { count: 0 } })
})
```

Then merge this into the existing `afterEach`, so it reads:

```js
afterEach(() => {
  mock.reset()
  localStorage.clear()
  setTestViewportWidth(DESKTOP)
})
```

- [ ] **Step 2: Run the existing suite to confirm it still passes with the mock in place but no bell yet**

```bash
cd frontend
npx jest tests/jasper/AppLayout.mobile.test.jsx
```

Expected: PASS, unchanged - this step only proves the new mock setup didn't break anything before touching `AppLayout.jsx` itself.

- [ ] **Step 3: Add a failing test for the bell's presence**

Append two new tests to `frontend/tests/jasper/AppLayout.mobile.test.jsx`, inside a new `describe` block:

```js
describe('AppLayout - notification bell', () => {
  test('renders in the mobile top bar', async () => {
    setTestViewportWidth(PHONE)
    renderShell()

    expect(await screen.findByRole('button', { name: /notifications/i })).toBeInTheDocument()
  })

  test('renders in the desktop sidebar header', async () => {
    setTestViewportWidth(DESKTOP)
    renderShell()

    expect(await screen.findByRole('button', { name: /notifications/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run the tests to verify the new ones fail**

```bash
cd frontend
npx jest tests/jasper/AppLayout.mobile.test.jsx
```

Expected: FAIL on both new tests - `Unable to find role="button" with name /notifications/i`.

- [ ] **Step 5: Add the bell to the mobile top bar**

In `frontend/src/layouts/AppLayout.jsx`, add the import:

```js
import { useAuth, useIsMobile } from '@/hooks'
import { NAV_ROUTES } from '@/router/routes'
import { Button } from '@/components/ui/button'
import { NotificationBell } from '@/components/NotificationBell'
```

Then change the mobile header from:

```jsx
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
        </header>
      )}
```

to:

```jsx
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
```

- [ ] **Step 6: Add the bell to the desktop sidebar header**

Change the brand header block from:

```jsx
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
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar"
                  className="ml-auto p-1 rounded-md text-slate-400 hover:bg-[#0F172A] hover:text-white transition-colors"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Expand control - only shown while the desktop rail is collapsed. */}
        {showRail && (
          <div className="flex justify-center pt-2">
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
```

to:

```jsx
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

        {/* Expand control - only shown while the desktop rail is collapsed. showRail is
            desktop-only by construction (showRail = collapsed && !isMobile), so the bell
            here never doubles up with the one already shown in the mobile top bar. */}
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
```

Note the bell inside the aside's own header is intentionally gated to the `!isMobile` branch only - on mobile, the persistent top bar (Step 5) already carries a bell, and this header only reappears when the drawer itself is open, so showing a second bell there would just duplicate it.

- [ ] **Step 7: Run the tests to verify they pass**

```bash
cd frontend
npx jest tests/jasper/AppLayout.mobile.test.jsx
```

Expected: PASS, all tests (the two new ones plus every pre-existing test in the file).

- [ ] **Step 8: Run the full frontend suite to confirm no regression**

```bash
cd frontend
npx jest
```

Expected: PASS, all suites. (No other test file renders `AppLayout`, so this confirms nothing else needs the new mock.)

- [ ] **Step 9: Append to the test log**

Update the existing `AppLayout.mobile.test.jsx` row in `frontend/tests/jasper/test-cases.md` to mention the addition, and add a note - find the row for `AppLayout.mobile.test.jsx`... it is not currently listed by name in the sampled rows; if it already has a row, append `; renders the notification bell in both the mobile top bar and the desktop sidebar header` to its "What is Tested" cell. If it has no row yet, add one:

```
| 8 | AppLayout.mobile.test.jsx | Responsive app shell (sidebar vs. off-canvas drawer) and, from this task, the notification bell mounted in both the mobile top bar and the desktop sidebar header | Existing drawer/breakpoint behavior is unchanged; the bell (`button[aria-label*="Notifications"]`) is present on both the mobile top bar and the desktop sidebar header |
```

- [ ] **Step 10: Commit**

```bash
git add frontend/src/layouts/AppLayout.jsx frontend/tests/jasper/AppLayout.mobile.test.jsx frontend/tests/jasper/test-cases.md
git commit -m "feat(notifications): mount the notification bell in AppLayout"
```

---

### Task 8: Cleanup and full integration verification

**Files:**
- Delete: `frontend/src/pages/bookings/intakeSeedData.js`

**Interfaces:**
- None - this task removes dead code and verifies the whole feature end-to-end against the real dev database, which no unit test in Tasks 1-7 exercises.

- [ ] **Step 1: Confirm the seed file is truly unreferenced**

```bash
cd ..
grep -rn "intakeSeedData" frontend/src/
```

Expected: no output (already confirmed during design - nothing imports it since `IntakeQueuePage` was wired to the real API).

- [ ] **Step 2: Delete it**

```bash
git rm frontend/src/pages/bookings/intakeSeedData.js
```

- [ ] **Step 3: Confirm the frontend still builds**

```bash
cd frontend
npm run build
```

Expected: build succeeds with no import errors.

- [ ] **Step 4: Commit the cleanup**

```bash
git add -A
git commit -m "chore: remove unreferenced intake seed data file"
```

- [ ] **Step 5: Run both full test suites one more time**

```bash
cd backend && npx jest
cd ../frontend && npx jest
```

Expected: PASS, both suites, in full.

- [ ] **Step 6: Re-sync and re-seed the real dev database**

Per project convention, model/enum changes must be verified against the real dev DB, not just mocks - Tasks 1-5 changed the `Notification` model and its ENUM.

```bash
cd backend
npm run db:sync
npm run db:fix-notification-enum
```

Expected: both complete with their "Done" log lines (already run once in Task 1, but re-run here as a final check after all subsequent changes).

- [ ] **Step 7: Start both dev servers**

```bash
cd backend && npm run dev
```
```bash
cd frontend && npm run dev
```

- [ ] **Step 8: Walk the full customer -> Camilla -> Ravi path in the browser**

1. Open the public intake form (e.g. `http://localhost:5173/intake`) in one browser tab/profile. Submit a request. Confirm the success screen shows a reference number - no "confirmation email sent" language anywhere (per CLAUDE.md, there is no email service).
2. In a second tab, log in as `camilla@efar.com.sg`. Confirm the sidebar bell shows an unread badge within 30 seconds without a manual refresh.
3. Click the bell, click the new-submission notification, confirm it navigates to `/intake-queue` and the badge decrements.
4. Confirm the submission from Step 1. Go to `/bookings` and assign a field crew member (e.g. `ravi@efar.com.sg`).
5. Confirm the booking's status reads **Confirmed** immediately after assignment, not **In Progress**.
6. In a third tab, log in as `ravi@efar.com.sg`. Confirm his bell shows an unread badge within 30 seconds, click it, confirm it navigates to `/jobs` and the job card is visible.
7. On `/jobs`, tap **Activated**. Confirm the booking now reads **In Progress** (visible back in Camilla's `/bookings` tab after a refresh).
8. Resize the browser below the `md` breakpoint (or use device emulation) and confirm the bell also renders and works correctly in the mobile top bar.

- [ ] **Step 9: Stop both dev servers**

Free port 5173 (and the backend port) rather than leaving them bound - stopping the terminal task alone can leave Vite still listening.

```bash
cd backend
node src/scripts/check-port-free.js
```

If anything is still bound, stop the process holding it before ending the session.
