# Live Handoff Notifications - Design

Date: 2026-08-05
Owner: Jasper
Branch: `feature/live-data-customer-quotations-field-crew`

---

## Problem

The customer -> Quotations -> Field Crew workflow does not feel live. The reported
symptom was "the data is static and samples", but investigation showed the data is
already live end to end:

| Step | Current state |
|---|---|
| Public intake form at `/intake` (no login, real POST, success screen with reference) | Live |
| Intake Queue - fetches `GET /api/intake` | Live |
| Confirm intake - creates real `Client` + `Booking` | Live |
| Assign crew - `PATCH /bookings/:id/crew` | Live |
| My Jobs - `GET /bookings/my-jobs` scoped by `assigned_crew_id` | Live |
| Memo wizard + submission | Live |

The real defect is that **every handoff between roles is silent**, and one status
transition lies.

### Defect 1 - notifications are written but unreadable

`Notification`, `notificationService`, and seven write sites across five controllers
already exist. There is no `notificationRoutes.js`, no GET endpoint, and no UI. Every
notification ever written by this application has been invisible.

### Defect 2 - the two handoffs in question write nothing at all

- `createIntake` writes no notification. The enum already declares
  `new_intake_submission`, but nothing ever creates it, so the Quotations Specialist
  learns of a customer submission only by manually refreshing the queue.
- `updateBookingCrew` writes no notification, and the enum has no `job_assigned`
  value, so field crew never learn they have been assigned a job.

### Defect 3 - two competing "start job" triggers

Both of these move a booking from `confirmed` to `in_progress`:

- `bookingController.updateBookingCrew` - as a side effect of assigning crew
- `jobMilestoneController.recordMilestone` - on the crew's `activated` tap

The milestone trigger was added later explicitly to supersede the assignment side
effect (see its inline comment: "previously this only happened as a side effect of
crew assignment"), but the side effect was never removed. Consequence: assigning a
crew member marks the job In Progress before the crew has seen it. The Quotations
board misreports reality and the crew's milestone stepper opens on an already-started
job.

### Defect 4 - three latent bugs in the existing write sites

1. `serviceMemoController.js:148` and `memoReviewController.js:204` both link to
   `/memos/:id`, which is not a route in `App.jsx`. Every such notification would be
   a dead click once the bell exists.
2. `memoReviewController.js:202` sends a *memo returned for correction* notification
   using type `memo_submitted`.
3. `invoiceController.js:284` passes `user_id: invoice.approved_by || null`, but
   `Notification.user_id` is `allowNull: false`. When `approved_by` is null the insert
   throws, `notificationService` swallows the error by design, and the Xero
   sync-failure alert disappears with no trace. This is precisely the silent revenue
   leakage the project exists to prevent.

---

## Goals

1. Make each role handoff visible in-app, at login and while already logged in.
2. Make booking status truthful.
3. Fix the notification write sites so the new reader surfaces correct links and types.

## Non-goals

- Email. CLAUDE.md forbids it - there is no email service in the stack, and no
  "confirmation email sent" language anywhere.
- WebSockets or SSE. Long-lived connections idle out on the intended free-tier host
  and add a deployment risk disproportionate to a POC.
- A notification preferences screen.
- A top header bar. CLAUDE.md declares a 64px header token, but the implemented
  `AppLayout` is sidebar + content with no desktop header. Retrofitting one touches
  every page and is out of scope here.
- A public customer status-lookup page. Considered and deferred - it needs a
  non-guessable lookup token, which is its own design decision.

---

## Architecture

Three layers, built in dependency order.

### Layer A - Notification read API (backend)

**Enum additions** to `backend/src/models/Notification.js`:

```
job_assigned
memo_returned
```

Postgres does not allow Sequelize `sync({ alter: true })` to add values to an existing
ENUM type. This requires an explicit `ALTER TYPE ... ADD VALUE` script following the
precedent of `backend/src/scripts/fix-invoice-contract-nullable.js`. Running `db:sync`
alone leaves the new values rejected at insert time, and because `notificationService`
never throws, the failure is silent.

**New `backend/src/controllers/notificationController.js` and
`backend/src/routes/notificationRoutes.js`**, mounted at `/api/notifications` in
`routes/index.js`. Every route is `authenticate`d. No route accepts a user id -
ownership is always `req.user.sub`, so one user can never read or mutate another's
notifications.

| Method | Path | Behaviour |
|---|---|---|
| GET | `/api/notifications?unread_only=&limit=` | Own notifications, newest first. `limit` defaults to 20, capped at 50. |
| GET | `/api/notifications/unread-count` | `{ count }`. The polled endpoint - a cheap indexed COUNT. |
| PATCH | `/api/notifications/:id/read` | Marks one read. 404 if the row is not owned by the caller - deliberately indistinguishable from "does not exist", matching the blurred-404 pattern already used in `recordMilestone` and `createServiceMemo`. |
| PATCH | `/api/notifications/read-all` | Marks all the caller's unread notifications read. |

Route ordering matters: `/unread-count` and `/read-all` must be declared before any
`/:id` pattern so they are not captured as an id.

### Layer B - The two missing writes (backend)

| Trigger | Recipient | Type | Link |
|---|---|---|---|
| `intakeController.createIntake` | every `quotations_specialist` user | `new_intake_submission` | `/intake-queue` |
| `bookingController.updateBookingCrew` | the newly assigned crew member | `job_assigned` | `/jobs` |

Both fire after the primary record is committed and both remain non-fatal, matching
the existing `notificationService` contract. A public, unauthenticated customer
submission must never return 500 because a notification insert failed.

`createIntake` fans out with `findAll`, not `findOne`. The existing
`serviceMemoController` pattern of `User.findOne({ where: { role } })` happens to work
only because the seed data contains exactly one user per office role; it silently
drops notifications the moment EFAR has two Quotations Specialists.

`updateBookingCrew` notifies only on a real change - assigning a different crew
member, or assigning where there was none. Re-saving the same crew member, or
unassigning (`assigned_crew_id: null`), writes nothing.

### Layer C - Bell UI (frontend)

**`frontend/src/api/notifications.js`** - thin Axios wrappers for the four endpoints,
matching the existing `api/` module style.

**`frontend/src/components/NotificationBell.jsx`**:

- Bell icon with an unread-count badge; badge hidden at zero, renders `9+` above nine.
- Dropdown listing recent notifications: title, body, relative timestamp, unread dot.
- Clicking an item marks it read, closes the dropdown, and navigates to its `link`.
- "Mark all as read" footer action.
- Empty state when there is nothing to show.
- Closes on outside click and on `Escape`; the trigger carries `aria-expanded` and an
  `aria-label` including the unread count.

**Placement** in `AppLayout.jsx`, using the two chrome surfaces that already exist:

- Desktop: the sidebar brand header row, icon-only when the rail is collapsed to 68px.
- Mobile: the fixed top bar at `AppLayout.jsx:90`, right-aligned.

**Polling:**

- Fetch `unread-count` on mount. This is what satisfies "notified when she logs in".
- Re-poll every 30s. The list itself is fetched lazily when the dropdown opens, so the
  steady-state cost is one COUNT per 30s per session.
- Pause polling while `document.visibilityState === 'hidden'` and refetch immediately
  on becoming visible, so a backgrounded tab does not hold Supabase connections open.
- Clear the interval and any visibility listener on unmount.

### Layer D - Status truth fix (backend)

Remove the `updates.status = 'in_progress'` branch from
`bookingController.updateBookingCrew` (currently lines 191-193), leaving `activated`
as the sole `confirmed -> in_progress` trigger.

Safe because:

- `GET /bookings/my-jobs` filters only on `assigned_crew_id` with no status
  constraint, so `confirmed` bookings already appear in My Jobs.
- `recordMilestone` already accepts both `confirmed` and `in_progress` as valid states
  for recording a milestone.
- `BookingListPage.handleSaveAssignment` reads `status` back from the response rather
  than assuming a value, so it needs no change - it will simply render "Confirmed".

Resulting semantics on the Quotations board: `Confirmed` + a crew name means waiting
on the crew; `In Progress` means the crew has actually activated.

### Layer E - Write-site corrections (backend)

| File | Change |
|---|---|
| `serviceMemoController.js:148` | link `/memos/:id` -> `/service-memos` (recipient is the AR Specialist) |
| `memoReviewController.js:204` | link `/memos/:id` -> `/memos/history` (recipient is the field crew) |
| `memoReviewController.js:202` | type `memo_submitted` -> `memo_returned` |
| `invoiceController.js:284` | `user_id: invoice.approved_by \|\| null` -> fall back to the AR Specialist when `approved_by` is null, so the sync-failure alert cannot vanish |

The fallback intentionally reuses the same `User.findOne({ where: { role: 'ar_specialist' } })` lookup already used in `serviceMemoController`, not `findAll`. Unlike the intake fan-out in Layer B - where multiple Quotations Specialists is a realistic near-term scenario worth fixing now - a second AR Specialist is not something this change introduces or needs to solve; it stays consistent with the codebase's existing single-AR-specialist assumption rather than fixing it opportunistically here.

### Layer F - Cleanup

Delete `frontend/src/pages/bookings/intakeSeedData.js`. Nothing imports it; it is a
leftover from before `IntakeQueuePage` was wired to the API, and its presence is the
main reason this workflow was believed to be running on sample data.

---

## Data flow after this change

```
Customer fills /intake  (public, no auth)
  -> POST /api/intake
     -> IntakeSubmission created (status: pending)
     -> notification 'new_intake_submission' -> every quotations_specialist
  -> customer sees reference number on the success screen

Camilla logs in (or is already logged in; <=30s later)
  -> bell badge increments
  -> clicks notification -> /intake-queue
  -> confirms intake
     -> Client (findOrCreate) + Booking created (status: confirmed)
  -> /bookings -> assigns Ravi
     -> booking.assigned_crew_id = Ravi;  status stays 'confirmed'
     -> notification 'job_assigned' -> Ravi

Ravi logs in (or is already logged in; <=30s later)
  -> bell badge increments
  -> clicks notification -> /jobs
  -> job card visible (confirmed + assigned)
  -> taps Activated -> booking.status = 'in_progress'
  -> works milestones -> memo wizard -> submits memo
     -> booking.status = 'completed'
     -> notification 'memo_submitted' -> Sarah, linking to /service-memos
```

---

## Error handling

- Notification writes stay non-fatal everywhere. A failed notification must never roll
  back or fail the feature that triggered it (the UC-05 edge case the existing service
  comment cites).
- Because failures are silent by design, `notificationService` must keep logging to
  `console.error`, and the enum migration must be verified against the real dev
  database rather than assumed - a rejected enum value looks identical to success from
  the caller's side.
- Bell fetch failures degrade quietly: the badge keeps its last known value and no
  toast fires. A transient count failure is not worth interrupting the user, and the
  30s poll will recover it.
- A notification whose `link` is null renders as non-clickable text rather than
  navigating to `/`.

---

## Testing

Backend, `backend/tests/jasper/`:

- `GET /api/notifications` returns only the caller's rows.
- `PATCH /api/notifications/:id/read` 404s for a row owned by another user, and does
  not mutate it.
- `/unread-count` and `/read-all` resolve to their own handlers, not to `/:id`.
- `createIntake` writes one `new_intake_submission` per quotations specialist.
- `createIntake` still returns 201 when the notification insert throws.
- `updateBookingCrew` writes one `job_assigned` to the assigned crew member.
- `updateBookingCrew` writes nothing when re-assigning the same crew or unassigning.
- `updateBookingCrew` leaves a `confirmed` booking `confirmed`.
- `recordMilestone('activated')` still moves `confirmed -> in_progress`.

Frontend, `frontend/tests/jasper/`:

- Badge hidden at zero, shows a count, shows `9+` above nine.
- Clicking an item marks read and navigates to its `link`.
- Polling pauses when the document is hidden.
- Interval is cleared on unmount.

Integration verification, against the real dev database, not mocks:

- Run the enum `ALTER TYPE` script, then `db:sync`, then re-seed.
- Insert one notification of each new type to confirm the enum accepts them.
- Walk the full customer -> Camilla -> Ravi path in the browser and confirm both bells
  increment and both links land on the right screen.

---

## Files touched

New:

```
backend/src/controllers/notificationController.js
backend/src/routes/notificationRoutes.js
backend/src/scripts/add-notification-enum-values.js
frontend/src/api/notifications.js
frontend/src/components/NotificationBell.jsx
backend/tests/jasper/notifications.test.js
frontend/tests/jasper/NotificationBell.test.jsx
```

Modified:

```
backend/src/models/Notification.js          enum values
backend/src/routes/index.js                 mount /notifications
backend/src/controllers/intakeController.js  fan-out write
backend/src/controllers/bookingController.js job_assigned write; drop status side effect
backend/src/controllers/serviceMemoController.js  link fix
backend/src/controllers/memoReviewController.js   link + type fix
backend/src/controllers/invoiceController.js      user_id fallback
frontend/src/layouts/AppLayout.jsx           mount the bell in both chrome surfaces
```

`frontend/src/api/index.js` and `frontend/src/components/index.js` are deliberately
left alone. The former is the Axios instance, not a barrel; the latter is an empty
comment-only file. This codebase imports both API modules and components by direct
path (`@/api/intake`, `@/components/RequiredLabel`), so `api/notifications.js` and
`NotificationBell.jsx` follow that convention.

Deleted:

```
frontend/src/pages/bookings/intakeSeedData.js
```
