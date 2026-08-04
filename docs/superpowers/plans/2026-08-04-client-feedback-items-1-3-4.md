# Client Feedback Items 1, 3, 4 + Fixture Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver interim-review items 1 (live job milestones), 3 (current-job hero on My Jobs), 4 (manpower-only memos - model + wizard half), and repair the broken ContractDetailPage test fixture.

**Architecture:** New `job_milestones` child table + `POST /api/bookings/:id/milestone` endpoint feed a tap-to-timestamp stepper rendered on a new hero card in MyJobsPage; the memo wizard pre-fills job times from recorded milestones. `ServiceMemo.patient_name`/`hospital_destination` become conditionally required on `service_type`. Design spec: `docs/superpowers/specs/2026-08-04-client-feedback-items-1-3-4-design.md`.

**Tech Stack:** Express + Sequelize + Yup (backend), React + Formik + Yup + Jest/RTL + axios-mock-adapter (frontend).

## Global Constraints

- Use `-` not em dash in all written docs/comments (CLAUDE.md).
- Code and tests committed under Jasper's ownership: `backend/tests/jasper/`, `frontend/tests/jasper/`.
- Do NOT modify `backend/src/services/pricingService.js` or AR review controllers (Kwan Hua's scope).
- Response envelope: `success(res, data)` / `created(res, data)` / `error(res, message, code, status)` from `backend/src/utils`.
- Milestone sequence (fixed): `activated`, `arrived_at_location`, `en_route`, `arrived_at_destination`, `job_completed`.
- Commit after every task with a meaningful message.

---

### Task 1: Repair ContractDetailPage test fixture

**Files:**
- Modify: `frontend/tests/jasper/ContractDetailPage.test.jsx:325`

The surcharge editor renders `NumberStepper` (text input, `aria-label` = `"<label> amount"`, e.g. `"Oxygen Base amount"`), not a native number input, so `getAllByRole('spinbutton')` finds nothing.

- [x] **Step 1: Run the failing test** - `npx jest tests/jasper/ContractDetailPage.test.jsx -t "partial failure"` - expected FAIL (`Unable to find ... role "spinbutton"`).
- [x] **Step 2: Fix the query**

```js
// replace:
const oxygenInput = screen.getAllByRole('spinbutton')[0]
// with:
const oxygenInput = screen.getByRole('textbox', { name: 'Oxygen Base amount' })
```

- [x] **Step 3: Re-run** - expected PASS (all 15).
- [x] **Step 4: Commit** - `fix(tests): query surcharge editor by NumberStepper aria-label, not spinbutton`

### Task 2: JobMilestone model + record endpoint (backend)

**Files:**
- Create: `backend/src/models/JobMilestone.js`
- Create: `backend/src/controllers/jobMilestoneController.js`
- Create: `backend/src/validators/milestoneValidators.js`
- Modify: `backend/src/models/index.js` (register + associations + export)
- Modify: `backend/src/validators/index.js` (export)
- Modify: `backend/src/routes/bookingRoutes.js` (route)
- Test: `backend/tests/jasper/jobMilestoneController.test.js`

**Interfaces:**
- Produces: `JobMilestone` model; `recordMilestone(req, res)`; `MILESTONE_SEQUENCE` array exported from the controller; route `POST /api/bookings/:id/milestone` (field_crew, managing_director); `milestoneBodySchema`.
- Response: `201 { success, data: { booking_id, status, milestones: [{ milestone_type, recorded_at }] } }`.

- [x] **Step 1: Write failing controller tests** (mock `../../src/models`, `../../src/config` like `serviceMemoController.test.js`): happy path creates row + returns 201 with ordered milestones; `activated` on `confirmed` booking updates status to `in_progress`; duplicate -> 409 `MILESTONE_ALREADY_RECORDED`; out-of-order -> 409 `MILESTONE_OUT_OF_ORDER`; completed booking -> 409 `BOOKING_ALREADY_COMPLETED`; field crew on someone else's booking -> 404 `BOOKING_NOT_FOUND`.
- [x] **Step 2: Run tests, verify fail** (module not found).
- [x] **Step 3: Implement model:**

```js
const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// Owner: Jasper (Wave 2 field ops - client feedback item 1).
// One row per live milestone tap. recorded_at is always server time.
const JobMilestone = sequelize.define('JobMilestone', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  booking_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'bookings', key: 'id' } },
  milestone_type: {
    type: DataTypes.ENUM('activated', 'arrived_at_location', 'en_route', 'arrived_at_destination', 'job_completed'),
    allowNull: false,
  },
  recorded_at: { type: DataTypes.DATE, allowNull: false },
  recorded_by: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
}, {
  tableName: 'job_milestones',
  underscored: true,
  indexes: [{ unique: true, fields: ['booking_id', 'milestone_type'] }],
})

module.exports = JobMilestone
```

Associations in `models/index.js`: `Booking.hasMany(JobMilestone, { foreignKey: 'booking_id', onDelete: 'CASCADE' })`, `JobMilestone.belongsTo(Booking, { foreignKey: 'booking_id' })`, `JobMilestone.belongsTo(User, { foreignKey: 'recorded_by', as: 'recordedBy' })`; export `JobMilestone` under the Jasper section.

- [x] **Step 4: Implement validator** (`milestoneValidators.js`): `MILESTONE_TYPES` array + `milestoneBodySchema = Yup.object({ milestone_type: Yup.string().oneOf(MILESTONE_TYPES).required() })`; re-export from `validators/index.js`.
- [x] **Step 5: Implement controller** per design: blurred 404 for not-own booking, status guard, duplicate guard, sequence guard, transaction (create + optional `confirmed -> in_progress`), reply with milestones sorted by `MILESTONE_SEQUENCE` order.
- [x] **Step 6: Register route** in `bookingRoutes.js`: `router.post('/:id/milestone', authenticate, authorise('field_crew', 'managing_director'), validate(milestoneBodySchema), recordMilestone)`.
- [x] **Step 7: Run backend jasper tests + full backend suite** - all green.
- [x] **Step 8: Commit** - `feat(field-ops): job milestone model and tap-to-timestamp endpoint (client feedback #1)`

### Task 3: Surface milestones in my-jobs and booking detail

**Files:**
- Modify: `backend/src/controllers/bookingController.js` (`listMyJobs`, `getBookingById`)
- Test: `backend/tests/jasper/bookingMilestonesInclude.test.js`

**Interfaces:**
- Produces: both endpoints gain `milestones: [{ milestone_type, recorded_at }]` sorted by sequence order; helper `serializeMilestones(jobMilestones)` local to the controller.

- [x] **Step 1: Failing tests** - mock `Booking.findAll`/`findByPk` returning `JobMilestones` arrays out of order; assert serialized `milestones` present and sequence-sorted.
- [x] **Step 2: Implement** - add `{ model: JobMilestone }` to both includes and map through the sequence-sort helper.
- [x] **Step 3: Full backend suite green.**
- [x] **Step 4: Commit** - `feat(field-ops): include recorded milestones in my-jobs and booking detail`

### Task 4: Manpower-only memos - backend half (item 4)

**Files:**
- Modify: `backend/src/models/ServiceMemo.js:21-22` (`allowNull: true` on both patient fields + comment)
- Modify: `backend/src/validators/serviceMemoValidators.js` (conditional requirement)
- Modify: `backend/src/controllers/serviceMemoController.js` (notification body fallback)
- Test: `backend/tests/jasper/serviceMemoManpowerOnly.test.js`

**Interfaces:**
- `createServiceMemoSchema`: `patient_name`/`hospital_destination` required for `eas`/`mts`; for `event_standby`/`workplace_standby` empty string coerces to null.

Validator shape:

```js
const AMBULANCE_SERVICE_TYPES = ['eas', 'mts']
const requiredForAmbulance = (label) =>
  Yup.string().trim()
    .when('service_type', {
      is: (v) => AMBULANCE_SERVICE_TYPES.includes(v),
      then: (s) => s.required(`${label} is required`),
      otherwise: (s) => s.nullable().transform((v) => (v === '' ? null : v)).default(null),
    })
```

- [x] **Step 1: Failing validator tests**: event_standby memo with null patient fields passes; eas without patient_name fails with `patient_name is required`; event_standby with a patient name keeps it (event with casualty).
- [x] **Step 2: Implement** model + validator + notification fallback (`memo.patient_name || booking.reference_number`).
- [x] **Step 3: Full backend suite green.**
- [x] **Step 4: Commit** - `feat(memos): allow manpower-only standby memos with no patient (client feedback #4, model+validator half)`

### Task 5: Frontend milestone API + stepper component

**Files:**
- Modify: `frontend/src/api/fieldOps.js` (add `recordMilestone`)
- Create: `frontend/src/components/MilestoneStepper.jsx`

**Interfaces:**
- `recordMilestone(bookingId, milestoneType)` -> `POST /bookings/:id/milestone` with `{ milestone_type }`.
- `<MilestoneStepper milestones={[{milestone_type, recorded_at}]} onRecord={fn} busy={bool} />` - renders 5 steps; recorded steps show local time; the next step is one large tappable button; later steps disabled. Labels: Activated / Arrived at Location / En Route / Arrived at Destination / Job Complete.

- [x] **Step 1: Implement both** (component tested through MyJobsPage tests in Task 6 - it has no logic beyond render/callback).
- [x] **Step 2: Commit with Task 6.**

### Task 6: My Jobs hero card + collapsed queue (item 3)

**Files:**
- Modify: `frontend/src/pages/jobs/MyJobsPage.jsx` (hero + collapsed upcoming section, client-side tab filtering, single unfiltered fetch)
- Test: rewrite `frontend/tests/jasper/MyJobsPage.test.jsx`

**Interfaces:**
- Consumes: `listMyJobs()` (no filter), `recordMilestone`, `MilestoneStepper`.
- Hero selection: earliest `in_progress`; else earliest `confirmed` scheduled today with start <= now+60min; else none (empty-state hint + auto-expanded list).
- Tapping a milestone calls `recordMilestone` and updates the hero's milestones + booking status from the response; `job_completed` recorded -> "Create Memo" emphasized. Hero card shows "Create Memo" for `in_progress`.
- Upcoming section keeps Today/Tomorrow/This Week/All tabs, filtering client-side; non-hero confirmed cards show scheduled time (no dead disabled button).

- [x] **Step 1: Failing tests**: in_progress job renders as "Current Job" hero with milestone stepper; confirmed-within-window renders as hero; no candidates -> "No active job right now" and visible list; milestone tap POSTs `/bookings/1/milestone` and renders returned timestamp; completed/invoiced never hero, show "Memo Submitted"; hero Create Memo navigates to wizard.
- [x] **Step 2: Implement page.**
- [x] **Step 3: Frontend jasper tests green.**
- [x] **Step 4: Commit** - `feat(field-ops): current-job hero with live milestone stepper on My Jobs (client feedback #1+#3)`

### Task 7: Memo wizard - milestone pre-fill + manpower-only fields (items 1+4 frontend)

**Files:**
- Modify: `frontend/src/validation/serviceMemoValidation.js` (`buildStep1Schema(bookingServiceType)`; keep `step1Schema` export = ambulance behaviour)
- Modify: `frontend/src/pages/jobs/memo-wizard/Step1JobDetails.jsx` (pre-fill from `booking.milestones`; optional patient fields for standby bookings)
- Modify: `frontend/src/pages/jobs/memo-wizard/Step2ServiceCharges.jsx` (default `service_type` from booking - new `booking` prop)
- Modify: `frontend/src/pages/jobs/memo-wizard/MemoWizardPage.jsx` (pass booking to Step2; final-submit guard; patient fields -> null when blank)
- Modify: `frontend/src/pages/memos/MemoDetailGrid.jsx` + `frontend/src/pages/jobs/memo-wizard/Step4StampSubmit.jsx` + `MemoSubmittedView.jsx` (dash fallback for null patient fields, checked during implementation)
- Test: `frontend/tests/jasper/serviceMemoValidation.test.js` (extend), `frontend/tests/jasper/MemoWizardStandby.test.jsx` (new)

**Interfaces:**
- `buildStep1Schema('event_standby')` -> patient fields optional; `buildStep1Schema('eas')` -> required (message text unchanged).
- Pre-fill: `job_start_time` <- `activated`, `job_end_time` <- `job_completed`, via `toDatetimeLocal(iso)` helper (local-time `YYYY-MM-DDTHH:MM`), only when the wizard has no earlier value.
- Final guard in `handleFinalSubmit`: if payload `service_type` is eas/mts and `patient_name`/`hospital_destination` blank -> error toast + `setStep(1)`, no POST.

- [x] **Step 1: Failing tests** (schema builder behaviour; standby wizard renders optional labels; prefill from milestones).
- [x] **Step 2: Implement.**
- [x] **Step 3: Frontend suite green.**
- [x] **Step 4: Commit** - `feat(memo-wizard): milestone time pre-fill and manpower-only standby support (client feedback #1+#4)`

### Task 8: Seeds + reset script

**Files:**
- Modify: `backend/src/scripts/seed-bookings.js` (BKG-TEST-00005 event_standby today for Ravi; idempotent `activated`+`arrived_at_location` milestones for BKG-TEST-00001)
- Modify: `backend/src/scripts/reset-demo-memo-booking.js` (destroy the booking's milestone rows too, log hint to re-run seed-bookings)

- [x] **Step 1: Implement both** (findOrCreate everywhere; recorded_by = ravi).
- [x] **Step 2: Syntax check** - `node --check` both scripts.
- [x] **Step 3: Commit** - `chore(seeds): manpower-only demo booking and live milestone seed rows`

### Task 9: Docs + full verification

**Files:**
- Modify: `README.md` (action-items table: #1, #3 Delivered; #4 Jasper half delivered; #2 unblocked note; database setup section unchanged)
- Modify: `backend/tests/jasper/test-cases.md`, `frontend/tests/jasper/test-cases.md`

- [x] **Step 1: Update docs.**
- [x] **Step 2: Full verification** - `cd backend && npx jest` all green; `cd frontend && npx jest` all green; `cd frontend && npm run build` succeeds.
- [x] **Step 3: Commit** - `docs: record delivery of client feedback items 1, 3, 4 (Jasper scope)`

## Self-Review Notes

- Spec coverage: item 1 -> Tasks 2/3/5/6/7; item 3 -> Task 6; item 4 -> Tasks 4/7; fixture -> Task 1; seeds -> Task 8; docs -> Task 9. No gaps.
- Type consistency: `milestone_type` string enum everywhere; `milestones: [{ milestone_type, recorded_at }]` shape shared by Tasks 2/3/5/6/7.
- `db:sync` creates `job_milestones` from the model registry - verify `sync-db.js` uses `alter` for the ServiceMemo NOT NULL drops during Task 4; if it does not, add a one-off note/command to the README section or use the existing fix-script pattern (`fix-invoice-contract-nullable.js`).
