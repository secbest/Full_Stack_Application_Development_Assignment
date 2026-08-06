# Managing Director Dashboard - Real Data & Analytics Design

- **Date:** 2026-08-06
- **Owner (design + tests):** Jasper (`design/jasper/`, `frontend/tests/jasper/`, `backend/tests/jasper/`)
- **Status:** Approved for planning

## Problem

The Managing Director area (Executive Dashboard, Reports, Accounts Management) has two separate problems:

1. **Thin on information.** The Fleet/Expense dashboard tabs are live against real data but only show a handful of KPI cards - no trend, no Xero-derived signal, no client ranking.
2. **Not deployable as-is.** Several MD screens look complete but are backed entirely by hardcoded mock data or unimplemented placeholders, which cannot go live:
   - Reports -> Billing Cycle tab: 100% hardcoded rows and a static "1.8 days" figure
   - Reports -> Leakage History tab: 100% hardcoded rows and a static sentence
   - Reports -> Vendor Expenditure tab: literal "not yet implemented" placeholder
   - Reports -> Revenue tab: real except one hardcoded "Revenue by Service Type" donut
   - Accounts Management: entire user directory is a hardcoded array; Edit/Force Logout/Unlock perform no backend call at all

## Goals

- Add operationally-relevant KPIs the MD dashboard is uniquely positioned to show (billing pipeline health, Xero sync health) rather than duplicating Xero's own financial reports, since Xero remains the master ledger and the app is pre-accounting.
- Replace every remaining mock/placeholder data source on MD-facing screens with real backend-derived data, since the app is going to a live deployment.
- Make Accounts Management's session-related actions (Force Logout, Unlock, Currently Online) genuinely functional, which requires new session-tracking fields since the current auth is stateless JWT with no session table, no `last_login`, and no revocation mechanism.

## Non-goals

- Duplicating Xero's own financial statements (P&L, aged receivables, etc.) on the dashboard.
- A full multi-device session table with per-device audit trail (see "Session realism" decision below - lightweight tracking was chosen over a full sessions table).
- Any change to the AR/AP core flows (intake, memo, pricing match, Xero sync) - this design only adds read-side analytics and the Accounts Management write actions listed above.

## Decisions

- **Xero-metrics strategy:** surface pipeline/operational metrics Xero cannot show (cycle time, sync health, leakage) rather than mirroring Xero's own reports.
- **Session realism:** lightweight fields on `User` (`token_version`, `last_login_at`, `last_active_at`, `failed_login_count`, `is_locked`) rather than a full sessions table. Sufficient for a single-org, assignment-scope app; avoids new schema + join overhead a dedicated sessions table would add.
- **Reports scope:** fix all four Reports tabs, not just the ones that overlap with new dashboard KPIs, since none of them can carry mock data into a live deployment.

## 1. Data model & auth changes

`backend/src/models/User.js` - add columns:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `token_version` | INTEGER | 0 | Embedded in every issued JWT. Bumping it invalidates all previously-issued tokens for that user - this *is* Force Logout. |
| `last_login_at` | DATE | null | Stamped on successful login. |
| `last_active_at` | DATE | null | Stamped by auth middleware (throttled) on authenticated requests. "Currently Online" = active within the last 5 minutes. |
| `failed_login_count` | INTEGER | 0 | Incremented on each failed login attempt; reset on success. |
| `is_locked` | BOOLEAN | false | Set true automatically at 5 consecutive failed attempts. Cleared by the Unlock action. |

No schema change needed on `Invoice` or `Booking`:
- The service-type revenue breakdown is derived via the existing `Invoice.belongsTo(Booking, { foreignKey: 'booking_id' })` join to `Booking.service_type` - no denormalization needed.
- Billing-cycle timestamps come from the existing `JobMilestone` (`job_completed`) -> `ServiceMemo` (`createdAt`) -> `Invoice` (`approved_by`/`createdAt`) -> `XeroSyncLog` (`entity_type: 'ar_invoice'`, `createdAt`) chain.

Auth changes (`backend/src/utils/token.js`, `backend/src/middleware/index.js`, `backend/src/controllers/authController.js`):

- `signToken(user)` adds `token_version: user.token_version` to the JWT claims.
- `authenticate` middleware: after verifying the JWT signature, loads the user's current `token_version` from DB and rejects with `401 TOKEN_REVOKED` if it doesn't match the token's claim. Also stamps `last_active_at = now()` if the existing value is older than 60 seconds (avoids a write on every single request).
- `login` controller:
  - On invalid credentials for an existing (non-locked) user: increment `failed_login_count`; if it reaches 5, set `is_locked = true`.
  - If the account is already `is_locked`, reject immediately with `403 ACCOUNT_LOCKED` regardless of password correctness.
  - On success: reset `failed_login_count = 0`, stamp `last_login_at` and `last_active_at` to now.

## 2. Backend endpoints

All routes below stay behind the existing `authorise('managing_director')` gate used by `dashboardRoutes.js`.

**Accounts Management** (new `backend/src/routes/userRoutes.js` additions, `backend/src/controllers/userController.js`):

| Endpoint | Behavior |
|---|---|
| `GET /api/users` | Returns all users with `id, name, email, role, last_login_at, last_active_at, is_locked` plus a computed `is_online` (`last_active_at` within 5 min). Replaces `INITIAL_ACCOUNTS`. |
| `PATCH /api/users/:id` | Updates name/role/email. Wires the currently local-only Edit modal. |
| `POST /api/users/:id/force-logout` | Increments `token_version`. |
| `POST /api/users/:id/unlock` | Sets `is_locked = false`, `failed_login_count = 0`. |
| `DELETE /api/users/:id` | Already exists - no backend change; frontend stops special-casing seeded rows. |

Computed KPIs for the Accounts Management screen: Total Users = `User.count()`; Currently Online = count where `is_online`; Security Alerts = count where `is_locked`.

**Executive Dashboard** (extend `backend/src/controllers/dashboardController.js`):

| Endpoint | Behavior |
|---|---|
| `GET /dashboard/xero-health` | Synced/pending/failed invoice counts, most recent `XeroSyncLog` timestamp, `xeroService.describeMode()` (simulation vs live). |
| `GET /dashboard/cycle-time` | Average duration per stage: job completed -> memo submitted -> invoice approved -> synced to Xero, plus an overall average. Shared by the new dashboard KPI and the Reports Billing Cycle tab. |
| `GET /dashboard/revenue-trend` | Invoiced revenue grouped by month over the trailing 12 months by default; optional `granularity=week` query param switches to weekly grouping over the trailing 12 weeks. |
| `GET /dashboard/top-clients` | Top 5 clients ranked by invoiced revenue, with booking volume shown alongside each. |

**Reports page** (reuses the endpoints above wherever possible instead of duplicating queries):

| Tab | Data source |
|---|---|
| Revenue | Existing query extended to group by `Booking.service_type` via join - no new endpoint. |
| Billing Cycle | `GET /dashboard/cycle-time` (table view of the same data used for the dashboard KPI). |
| Leakage History | New `GET /dashboard/leakage-history` - monthly-grouped variant of `leakageService.buildLeakageReport()`. |
| Vendor Expenditure | Existing `GET /dashboard/vendor-expenses` (already live on the Expense Summary tab), rendered in the Reports context with the existing period selector. |

## 3. Frontend changes

**Fleet Overview tab** (`frontend/src/pages/dashboard/FleetOverviewTab.jsx`):
- Add a 5th KPI card: average billing-cycle time (from `cycle-time`).
- Add a "Xero Sync Health" card: synced/pending/failed counts, last sync time, simulation-vs-live badge.
- Add a new row below the existing donut/leakage-alert: revenue trend line chart + top-clients table, side by side.

**Expense Summary tab**: unchanged - already fully live, and none of the newly-added metrics are expense-side.

**Reports page** (`frontend/src/pages/dashboard/ReportPage.jsx`):
- Revenue tab: remove `SERVICE_DONUT`, render the real grouped-by-service-type result.
- Billing Cycle tab: remove `BILLING_ROWS` and the static "1.8 days" string; render real per-stage averages and overall average.
- Leakage History tab: remove `LEAKAGE_ROWS` and the static summary sentence; render the real monthly-grouped leakage data.
- Vendor Expenditure tab: remove the "not yet implemented" placeholder; render the same vendor-expenses data already used on the Expense Summary tab.

**Accounts Management** (`frontend/src/pages/dashboard/Management.jsx`):
- Replace `INITIAL_ACCOUNTS` with a `GET /api/users` fetch on mount, refetched after every mutating action.
- Edit modal calls real `PATCH /api/users/:id`.
- Force Logout calls real `POST .../force-logout`, toast + refetch.
- Unlock calls real `POST .../unlock`; only shown/enabled when `is_locked`.
- Remove calls the already-real `DELETE`; drop the special-casing that currently blocks it for seeded rows.
- Status dot: green when `is_online`, gray otherwise. Locked accounts get the existing risk-row styling (`#FEF2F2`).
- KPI cards computed from the real listing instead of the mock array.
- Add New User modal: unchanged (already calls real `POST /auth/register`); switch from pushing to a local array to refetching the list.

## 4. Testing plan

- **Backend** (`backend/tests/jasper/`): unit tests for the lockout/token-version logic (failed-login increments, auto-lock at 5, locked-account login rejection, force-logout invalidation via mismatched `token_version`), and for each new/extended aggregation query (`cycle-time`, `revenue-trend`, `top-clients`, `xero-health`, `leakage-history`) against seeded fixture data.
- **Frontend** (`frontend/tests/jasper/`): component tests for `Management.jsx` against a mocked `GET /api/users` covering loading/empty/populated states and the Force Logout/Unlock/Edit wiring; tests for the Reports tabs rendering real API responses in place of the removed mock arrays.
- **Manual**: log in as `doris`, walk both dashboard tabs, all four Reports tabs, and Accounts Management end-to-end against the real dev database. Run `db:sync` (and reseed) after the `User` model changes, per existing team practice, before manual testing.
