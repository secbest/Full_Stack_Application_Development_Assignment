# Client Feedback Items 1, 3, 4 + Test Fixture Repair - Design

Date: 2026-08-04
Owner: Jasper (Wave 2 field ops scope)
Source of requirements: README.md "Client Feedback - Interim Review (17 Jul 2026)", items 1, 3, 4.

## Scope

Four deliverables, all inside Jasper's implementation ownership:

1. **Item 1 - Live job milestone timestamps.** Crew taps a button at each of the five
   stages EFAR already tracks (activated, arrived at location, en route, arrived at
   destination, job completed) instead of typing times at end of day.
2. **Item 3 - One job, not a queue.** My Jobs leads with a single "current job" hero
   card carrying the milestone buttons; everything else is demoted behind a collapsed
   "Upcoming jobs" section.
3. **Item 4 - Manpower-only jobs (Jasper's half).** `patient_name` and
   `hospital_destination` become conditionally required on `service_type` so event/
   workplace standby memos can submit. The pricing-engine null-tolerance half stays
   with Kwan Hua and is not touched here.
4. **Fixture repair.** `frontend/tests/jasper/ContractDetailPage.test.jsx` fails: it
   queries `getAllByRole('spinbutton')` but the surcharge editor now renders Kwan Hua's
   `NumberStepper` (a `type="text"` input with an `aria-label`, no spinbutton role).
   The test is updated to query the stepper by its accessible name. No product change.

Out of scope: item 2 (office-hours derivation - Kwan Hua, blocked on item 1), item 5
(AP ingestion - Kwan Hua), item 6 (presentation - group), any change to
`pricingService.js` or the AR review endpoints.

## Item 1 - Job milestones

### Approach chosen

A dedicated `job_milestones` table (one row per recorded milestone) over five nullable
columns on `bookings`. Reasons: `bookings` is Zheng Bao's model and already carries a
cross-team note about temporary field-ops routes - adding five columns there deepens
the entanglement; a child table records who tapped and when, is naturally idempotent
(unique constraint), and needs no `bookings` migration.

### Schema

New model `JobMilestone` -> table `job_milestones`:

| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK autoincrement | |
| booking_id | INTEGER FK bookings.id, not null | unique together with milestone_type |
| milestone_type | ENUM('activated', 'arrived_at_location', 'en_route', 'arrived_at_destination', 'job_completed') | fixed order below |
| recorded_at | DATE, not null | always server time - crews tap live, so "now" is the truth being captured |
| recorded_by | INTEGER FK users.id, not null | the crew member who tapped |

Milestone order: `activated` -> `arrived_at_location` -> `en_route` ->
`arrived_at_destination` -> `job_completed`.

Associations (models/index.js): `Booking.hasMany(JobMilestone)` (CASCADE on delete),
`JobMilestone.belongsTo(Booking)`, `JobMilestone.belongsTo(User, as: 'recordedBy')`.

### Endpoint

`POST /api/bookings/:id/milestone` - `authenticate` + `authorise('field_crew',
'managing_director')` + Yup body validation `{ milestone_type: oneOf(...) }`.

Rules, in order:
- Booking must exist and be assigned to the requesting crew member (same blurred 404
  as `createServiceMemo` so booking ids cannot be probed).
- Booking status must be `confirmed` or `in_progress`; `completed`/`invoiced` -> 409
  `BOOKING_ALREADY_COMPLETED`.
- The milestone must not already be recorded -> 409 `MILESTONE_ALREADY_RECORDED`.
- Milestones are strictly sequential: every earlier milestone must already exist ->
  409 `MILESTONE_OUT_OF_ORDER`. (Field reality is sequential; sequencing also keeps
  the derived start/end times trustworthy for pricing later.)
- Recording `activated` on a `confirmed` booking flips it to `in_progress` in the same
  transaction - this replaces the crew-assignment side effect as the real "start job"
  trigger and finally gives the My Jobs "Start Job" button a working action.
- `recorded_at` is server-set; the client sends only the milestone type.

Response: `{ booking_id, status, milestones: [{ milestone_type, recorded_at }, ...] }`
so the UI can re-render the stepper from one payload.

`GET /api/bookings/my-jobs` and `GET /api/bookings/:id` both gain a
`milestones: [{ milestone_type, recorded_at }]` array (ordered by sequence) so the job
card stepper and the memo wizard can read recorded times.

### Wizard pre-fill

Memo wizard Step 1 pre-fills `job_start_time` from the `activated` milestone and
`job_end_time` from `job_completed` (converted to local `datetime-local` strings) when
the wizard has no earlier draft values. Fields stay editable - the memo remains the
document of record; milestones are the convenience source.

## Item 3 - Current-job hero on My Jobs

### Selection rule (client-side)

From the crew's jobs (fetched once, unfiltered):
1. The earliest `in_progress` job is the current job, if any exists.
2. Otherwise the earliest `confirmed` job scheduled today whose scheduled time is
   within the next 60 minutes (the call centre posts a case about an hour before its
   start) or already past.
3. Otherwise there is no current job and the page says so.

### Layout

- **Hero card** (top, visually dominant): client, reference, service labels, route,
  scheduled time, plus the five-step milestone stepper. Each recorded milestone shows
  its timestamp; the next milestone renders as one large tap target; later ones are
  disabled. After `job_completed` is recorded (or any time while `in_progress`), the
  "Create Memo" action is available - emphasized once the job is complete.
- **"Upcoming jobs" section** below, collapsed by default when a hero exists,
  auto-expanded when there is none. Contains the existing date-filter tabs and card
  list. Filtering moves client-side (one fetch, no refetch per tab). Non-hero
  `confirmed` cards lose the dead disabled "Start Job" button - activation happens on
  the hero card when the job's window arrives; list cards show the scheduled time.

Existing `MyJobsPage` tests are rewritten to the new behaviour (they are Jasper's
tests asserting the old flat-list contract).

## Item 4 - Manpower-only jobs (model + wizard half)

- `ServiceMemo.patient_name` and `ServiceMemo.hospital_destination` become
  `allowNull: true`. (Postgres `ALTER COLUMN ... DROP NOT NULL` via `db:sync` alter.)
- Backend `createServiceMemoSchema`: both fields `.when('service_type')` - required
  for `eas`/`mts`, optional (empty -> null) for `event_standby`/`workplace_standby`.
  `transfer_type` stays required - rate rows are keyed on it and standby rate rows
  exist per contract; relaxing it is engine scope (Kwan Hua).
- Frontend mirrors: Step 1 renders both fields as optional (with a "not required for
  standby jobs" hint) when the **booking's** `service_type` is a standby type; the
  Step 1 schema becomes a builder parameterised on that. Step 2's `service_type` now
  defaults from the booking instead of empty.
- Final-submit guard in `MemoWizardPage`: if the submitted `service_type` ends up
  `eas`/`mts` (crew changed it on Step 2) but patient fields are blank, block with a
  toast and return to Step 1 instead of letting the backend 400 land after signature.
- Empty patient fields are sent as `null`, and crew-facing displays (memo history
  grid, submitted summary) render a dash for null. The AR review screens are Kwan
  Hua's and keep their current behaviour.
- Notification body for a memo with no patient falls back to the booking reference.

## Fixtures and seeds

- `seed-bookings.js` gains: (a) `BKG-TEST-00005`, an `event_standby` booking assigned
  to Ravi for today (manpower-only demo case for item 4); (b) idempotent milestone
  rows (`activated`, `arrived_at_location`) for the `in_progress` `BKG-TEST-00001` so
  the hero card demos mid-job on first load.
- `db:sync` picks up the new table automatically (it syncs the model registry).
- `reset-demo-memo-booking.js` is checked and, if it rewinds BKG-TEST bookings,
  taught to clear milestone rows for the booking it resets.

## Testing

- Backend (`backend/tests/jasper/`): controller tests for `recordMilestone` (happy
  path, out-of-order 409, duplicate 409, completed-booking 409, not-your-booking 404,
  activated->in_progress transition), validator tests for the conditional
  patient-field rules (standby submits with nulls; eas without patient_name fails).
- Frontend (`frontend/tests/jasper/`): MyJobsPage hero selection (in_progress wins,
  confirmed-within-window wins, none -> empty state + expanded list), milestone tap
  posts and re-renders, Step 1 optional-fields behaviour for a standby booking,
  ContractDetailPage fixture repair.
- Full suites plus `npm run build` (frontend) must pass.

## Documentation

- README action-items table: items 1 and 3 -> Delivered; item 4 -> Jasper's half
  delivered (engine half remains with Kwan Hua, unblocking item 2's owner note).
- `backend/tests/jasper/test-cases.md` and `frontend/tests/jasper/test-cases.md` gain
  rows for the new tests.
