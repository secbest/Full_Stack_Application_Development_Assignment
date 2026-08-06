# Executive Dashboard Analytics Endpoints Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four real-data endpoints (billing-cycle time, Xero sync health, revenue trend, top clients) to the Executive Dashboard's Fleet Overview tab, and surface them there - all derived from existing tables, no new schema.

**Architecture:** Four new `GET /api/dashboard/*` handlers in the existing `dashboardController.js`, following that file's established pattern (aggregate in JS from a few targeted queries rather than one large SQL join - see `fleetOverview`'s set-difference and `revenueLeakage`'s JSONB-emptiness comments for why). `FleetOverviewTab.jsx` grows a 5th KPI card, a Xero Sync Health card, and a new row with a revenue trend line chart and a top-clients table.

**Tech Stack:** Express, Sequelize, Yup, Jest (backend); React, MUI X Charts (already used for the booking-status donut), Jest + Testing Library (frontend).

## Global Constraints

- Every new controller function wraps its body in try/catch and returns `internalError(res, err)` on failure (see `project_uncaught_async_handler_crashes_server`: an unhandled rejection in an Express handler crashes the whole process, not just the request). The three *existing* functions in this file lack try/catch - leave them as-is; this plan only guards the new code it adds.
- `GET /dashboard/cycle-time` is the same data source for both the new dashboard KPI and the Reports Billing Cycle tab (see the separate Reports plan) - do not duplicate the query later.
- `GET /dashboard/revenue-trend` defaults to monthly buckets over the trailing 12 months; `?granularity=week` switches to weekly over the trailing 12 weeks.
- `GET /dashboard/top-clients` returns the top 5 clients by invoiced (`synced_to_xero`) revenue.
- All four routes stay behind `authorise('managing_director')`, matching the existing dashboard routes.

---

## Task 1: Query validators for the four new endpoints

**Files:**
- Modify: `backend/src/validators/dashboardValidators.js`
- Modify: `backend/src/validators/index.js`

**Interfaces:**
- Produces: `cycleTimeQuerySchema`, `revenueTrendQuerySchema` - consumed by Task 2 and Task 4's routes. (`xeroHealth` and `topClients` take no query params, so no schema is needed for them.)

- [ ] **Step 1: Add the two schemas**

In `backend/src/validators/dashboardValidators.js`, replace:

```js
module.exports = { fleetOverviewQuerySchema, vendorExpensesQuerySchema, revenueLeakageQuerySchema }
```

with:

```js
// GET /api/dashboard/cycle-time - same YYYY-MM-DD string validation as
// revenueLeakageQuerySchema above, for the same reason (the controller builds an
// explicit end-of-day bound from the string).
const cycleTimeQuerySchema = Yup.object({
  date_from: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'date_from must be in YYYY-MM-DD format'),
  date_to: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'date_to must be in YYYY-MM-DD format'),
}).test('date-range', 'date_from must be before or equal to date_to.', dateRangeTest())

const revenueTrendQuerySchema = Yup.object({
  granularity: Yup.string().oneOf(['month', 'week'], 'granularity must be one of: month, week').default('month'),
})

module.exports = {
  fleetOverviewQuerySchema,
  vendorExpensesQuerySchema,
  revenueLeakageQuerySchema,
  cycleTimeQuerySchema,
  revenueTrendQuerySchema,
}
```

- [ ] **Step 2: Export them from the shared validators barrel**

In `backend/src/validators/index.js`, replace:

```js
const { fleetOverviewQuerySchema, vendorExpensesQuerySchema, revenueLeakageQuerySchema } = require('./dashboardValidators')
```

with:

```js
const { fleetOverviewQuerySchema, vendorExpensesQuerySchema, revenueLeakageQuerySchema, cycleTimeQuerySchema, revenueTrendQuerySchema } = require('./dashboardValidators')
```

and replace:

```js
  fleetOverviewQuerySchema,
  vendorExpensesQuerySchema,
  revenueLeakageQuerySchema,
```

with:

```js
  fleetOverviewQuerySchema,
  vendorExpensesQuerySchema,
  revenueLeakageQuerySchema,
  cycleTimeQuerySchema,
  revenueTrendQuerySchema,
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/validators/dashboardValidators.js backend/src/validators/index.js
git commit -m "feat(backend): add query validators for cycle-time and revenue-trend endpoints"
```

(No standalone test - these are declarative Yup schemas exercised through Task 2/4's route-level tests and the existing `dashboardValidators` conventions have no dedicated unit test file of their own.)

---

## Task 2: GET /api/dashboard/cycle-time

**Files:**
- Modify: `backend/src/controllers/dashboardController.js`
- Modify: `backend/src/routes/dashboardRoutes.js`
- Test: `backend/tests/jasper/dashboardCycleTime.test.js` (create)

**Interfaces:**
- Consumes: `JobMilestone` (`milestone_type: 'job_completed'`), `ServiceMemo.createdAt`, `Invoice.approved_at`, `XeroSyncLog` (`entity_type: 'ar_invoice'`, `status: 'success'`, `synced_at`) - all existing.
- Produces: `cycleTime(req, res)` → `{ period, booking_count, stage_averages_days: { job_to_memo, memo_to_invoice, invoice_to_sync }, overall_average_days, rows: [{ booking_id, job_completed_at, memo_submitted_at, invoice_approved_at, synced_at, total_days }] }`. Consumed by Task 5 (frontend) and the separate Reports plan's Billing Cycle tab.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/jasper/dashboardCycleTime.test.js`:

```js
const { Op } = require('sequelize')

jest.mock('../../src/models', () => ({
  JobMilestone: { findAll: jest.fn() },
  ServiceMemo: { findAll: jest.fn() },
  Invoice: { findAll: jest.fn() },
  XeroSyncLog: { findAll: jest.fn() },
  Booking: {},
  VendorInvoice: {},
  PricingContract: {},
  SurchargeSchedule: {},
  Client: {},
}))

const { JobMilestone, ServiceMemo, Invoice, XeroSyncLog } = require('../../src/models')
const { cycleTime } = require('../../src/controllers/dashboardController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => { jest.clearAllMocks() })

describe('cycleTime', () => {
  test('returns null averages and an empty row set when nothing completed in the period', async () => {
    JobMilestone.findAll.mockResolvedValue([])

    const req = { query: { date_from: '2026-01-01', date_to: '2026-01-31' } }
    const res = mockRes()
    await cycleTime(req, res)

    expect(jsonBody(res).data).toMatchObject({
      booking_count: 0,
      overall_average_days: null,
      stage_averages_days: { job_to_memo: null, memo_to_invoice: null, invoice_to_sync: null },
      rows: [],
    })
  })

  test('computes per-stage and overall day averages for a fully-synced booking', async () => {
    const jobCompletedAt = new Date('2026-06-01T00:00:00.000Z')
    const memoSubmittedAt = new Date('2026-06-02T00:00:00.000Z')   // +1 day
    const invoiceApprovedAt = new Date('2026-06-04T00:00:00.000Z') // +2 days
    const syncedAt = new Date('2026-06-05T00:00:00.000Z')          // +1 day

    JobMilestone.findAll.mockResolvedValue([{ booking_id: 1, recorded_at: jobCompletedAt }])
    ServiceMemo.findAll.mockResolvedValue([{ booking_id: 1, createdAt: memoSubmittedAt }])
    Invoice.findAll.mockResolvedValue([{ id: 50, booking_id: 1, approved_at: invoiceApprovedAt }])
    XeroSyncLog.findAll.mockResolvedValue([{ entity_id: 50, synced_at: syncedAt }])

    const req = { query: {} }
    const res = mockRes()
    await cycleTime(req, res)

    const data = jsonBody(res).data
    expect(data.booking_count).toBe(1)
    expect(data.stage_averages_days).toEqual({ job_to_memo: 1, memo_to_invoice: 2, invoice_to_sync: 1 })
    expect(data.overall_average_days).toBe(4)
    expect(data.rows[0]).toMatchObject({ booking_id: 1, total_days: 4 })
  })

  test('a booking with no invoice yet contributes to job_to_memo but not to invoice_to_sync', async () => {
    const jobCompletedAt = new Date('2026-06-01T00:00:00.000Z')
    const memoSubmittedAt = new Date('2026-06-03T00:00:00.000Z') // +2 days

    JobMilestone.findAll.mockResolvedValue([{ booking_id: 2, recorded_at: jobCompletedAt }])
    ServiceMemo.findAll.mockResolvedValue([{ booking_id: 2, createdAt: memoSubmittedAt }])
    Invoice.findAll.mockResolvedValue([])
    XeroSyncLog.findAll.mockResolvedValue([])

    const req = { query: {} }
    const res = mockRes()
    await cycleTime(req, res)

    const data = jsonBody(res).data
    expect(data.stage_averages_days.job_to_memo).toBe(2)
    expect(data.stage_averages_days.memo_to_invoice).toBeNull()
    expect(data.stage_averages_days.invoice_to_sync).toBeNull()
    expect(data.overall_average_days).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest tests/jasper/dashboardCycleTime.test.js`
Expected: FAIL - `cycleTime` is not exported yet.

- [ ] **Step 3: Implement cycleTime**

In `backend/src/controllers/dashboardController.js`, replace the top import line:

```js
const { Op } = require('sequelize')
const { Booking, ServiceMemo, Invoice, VendorInvoice, PricingContract, SurchargeSchedule, Client } = require('../models')
const { leakageService } = require('../services')
const { success } = require('../utils')
```

with:

```js
const { Op } = require('sequelize')
const { Booking, ServiceMemo, Invoice, VendorInvoice, PricingContract, SurchargeSchedule, Client, JobMilestone, XeroSyncLog } = require('../models')
const { leakageService } = require('../services')
const xeroService = require('../services/xeroService')
const { success, internalError, round2 } = require('../utils')
```

Then, immediately before `module.exports = { fleetOverview, vendorExpenses, revenueLeakage }`, insert:

```js
// GET /api/dashboard/cycle-time - average duration, per stage, from job completion
// through Xero sync. Reused by this Fleet Overview KPI and by the Reports "Billing
// Cycle" tab, which renders the same `rows` as a table instead of just the averages.
//
// Stage durations are computed in JS from four already-related record sets, the same
// "aggregate in JS, not SQL" approach fleetOverview and revenueLeakage above use - at
// EFAR's data volume this stays simpler to read and test than a multi-table join.
async function cycleTime(req, res) {
  try {
    const { date_from, date_to } = req.query
    const from = date_from || `${new Date().getFullYear()}-01-01`
    const to = date_to || toDateOnly(new Date())

    const completedMilestones = await JobMilestone.findAll({
      where: {
        milestone_type: 'job_completed',
        recorded_at: { [Op.between]: [new Date(from), new Date(`${to}T23:59:59.999Z`)] },
      },
      attributes: ['booking_id', 'recorded_at'],
    })

    if (completedMilestones.length === 0) {
      return success(res, {
        period: { from, to },
        booking_count: 0,
        stage_averages_days: { job_to_memo: null, memo_to_invoice: null, invoice_to_sync: null },
        overall_average_days: null,
        rows: [],
      })
    }

    const bookingIds = completedMilestones.map((m) => m.booking_id)

    const [memos, invoices] = await Promise.all([
      ServiceMemo.findAll({ where: { booking_id: { [Op.in]: bookingIds } }, attributes: ['booking_id', 'createdAt'] }),
      Invoice.findAll({ where: { booking_id: { [Op.in]: bookingIds } }, attributes: ['id', 'booking_id', 'approved_at'] }),
    ])
    const memoByBooking = new Map(memos.map((m) => [m.booking_id, m]))
    const invoiceByBooking = new Map(invoices.map((i) => [i.booking_id, i]))

    const invoiceIds = invoices.map((i) => i.id)
    const syncLogs = invoiceIds.length
      ? await XeroSyncLog.findAll({
          where: { entity_type: 'ar_invoice', entity_id: { [Op.in]: invoiceIds }, status: 'success' },
          attributes: ['entity_id', 'synced_at'],
          order: [['synced_at', 'ASC']],
        })
      : []
    // First successful sync per invoice - a retried invoice can have more than one log row.
    const firstSyncByInvoice = new Map()
    for (const log of syncLogs) {
      if (!firstSyncByInvoice.has(log.entity_id)) firstSyncByInvoice.set(log.entity_id, log.synced_at)
    }

    const msPerDay = 1000 * 60 * 60 * 24
    const rows = completedMilestones.map((milestone) => {
      const memo = memoByBooking.get(milestone.booking_id)
      const invoice = invoiceByBooking.get(milestone.booking_id)
      const syncedAt = invoice ? firstSyncByInvoice.get(invoice.id) : null

      const jobToMemo = memo ? (new Date(memo.createdAt) - new Date(milestone.recorded_at)) / msPerDay : null
      const memoToInvoice = memo && invoice && invoice.approved_at
        ? (new Date(invoice.approved_at) - new Date(memo.createdAt)) / msPerDay
        : null
      const invoiceToSync = invoice && invoice.approved_at && syncedAt
        ? (new Date(syncedAt) - new Date(invoice.approved_at)) / msPerDay
        : null
      const totalDays = syncedAt ? (new Date(syncedAt) - new Date(milestone.recorded_at)) / msPerDay : null

      return {
        booking_id: milestone.booking_id,
        job_completed_at: milestone.recorded_at,
        memo_submitted_at: memo ? memo.createdAt : null,
        invoice_approved_at: invoice ? invoice.approved_at : null,
        synced_at: syncedAt || null,
        job_to_memo_days: jobToMemo,
        memo_to_invoice_days: memoToInvoice,
        invoice_to_sync_days: invoiceToSync,
        total_days: totalDays,
      }
    })

    const avg = (values) => {
      const known = values.filter((v) => v !== null && Number.isFinite(v))
      return known.length ? round2(known.reduce((s, v) => s + v, 0) / known.length) : null
    }

    return success(res, {
      period: { from, to },
      booking_count: rows.length,
      stage_averages_days: {
        job_to_memo: avg(rows.map((r) => r.job_to_memo_days)),
        memo_to_invoice: avg(rows.map((r) => r.memo_to_invoice_days)),
        invoice_to_sync: avg(rows.map((r) => r.invoice_to_sync_days)),
      },
      overall_average_days: avg(rows.map((r) => r.total_days)),
      rows: rows.map((r) => ({
        booking_id: r.booking_id,
        job_completed_at: r.job_completed_at,
        memo_submitted_at: r.memo_submitted_at,
        invoice_approved_at: r.invoice_approved_at,
        synced_at: r.synced_at,
        total_days: r.total_days !== null ? round2(r.total_days) : null,
      })),
    })
  } catch (err) {
    return internalError(res, err)
  }
}
```

Finally, replace:

```js
module.exports = { fleetOverview, vendorExpenses, revenueLeakage }
```

with:

```js
module.exports = { fleetOverview, vendorExpenses, revenueLeakage, cycleTime }
```

(`xeroService` and the other new functions this import line will eventually list are added by Tasks 3-4 below - this task only adds `cycleTime`.)

- [ ] **Step 4: Register the route**

In `backend/src/routes/dashboardRoutes.js`, replace:

```js
const { fleetOverviewQuerySchema, vendorExpensesQuerySchema, revenueLeakageQuerySchema } = require('../validators')
const { fleetOverview, vendorExpenses, revenueLeakage } = require('../controllers/dashboardController')
```

with:

```js
const { fleetOverviewQuerySchema, vendorExpensesQuerySchema, revenueLeakageQuerySchema, cycleTimeQuerySchema } = require('../validators')
const { fleetOverview, vendorExpenses, revenueLeakage, cycleTime } = require('../controllers/dashboardController')
```

and, immediately before `module.exports = router`, insert:

```js
router.get(
  '/cycle-time',
  authenticate,
  authorise('managing_director'),
  validate(cycleTimeQuerySchema, 'query'),
  cycleTime
)
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd backend && npx jest tests/jasper/dashboardCycleTime.test.js`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/dashboardController.js backend/src/routes/dashboardRoutes.js backend/tests/jasper/dashboardCycleTime.test.js
git commit -m "feat(backend): add GET /dashboard/cycle-time"
```

---

## Task 3: GET /api/dashboard/xero-health, /revenue-trend, /top-clients

**Files:**
- Modify: `backend/src/controllers/dashboardController.js`
- Modify: `backend/src/routes/dashboardRoutes.js`
- Test: `backend/tests/jasper/dashboardXeroHealthRevenueTopClients.test.js` (create)

**Interfaces:**
- Consumes: `Invoice.status`/`total_amount`/`client_id`/`createdAt`, `XeroSyncLog`, `Booking.client_id`, `Client.name`, `xeroService.describeMode()` - all existing.
- Produces: `xeroHealth(req, res)` → `{ counts: { synced, pending, failed }, last_synced_at, mode: { simulated, label, detail } }`. `revenueTrend(req, res)` → `{ granularity, from, to, trend: [{ bucket, total_revenue }] }`. `topClients(req, res)` → `{ top_clients: [{ client_id, client_name, total_revenue, invoice_count, booking_count }] }` (max 5, sorted descending by revenue). Consumed by Task 5 (frontend).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/jasper/dashboardXeroHealthRevenueTopClients.test.js`:

```js
jest.mock('../../src/models', () => ({
  Invoice: { count: jest.fn(), findAll: jest.fn() },
  XeroSyncLog: { findOne: jest.fn() },
  Booking: { findAll: jest.fn() },
  Client: {},
  ServiceMemo: {},
  VendorInvoice: {},
  PricingContract: {},
  SurchargeSchedule: {},
  JobMilestone: {},
}))
jest.mock('../../src/services/xeroService', () => ({
  describeMode: jest.fn(),
}))

const { Invoice, XeroSyncLog, Booking } = require('../../src/models')
const xeroService = require('../../src/services/xeroService')
const { xeroHealth, revenueTrend, topClients } = require('../../src/controllers/dashboardController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => { jest.clearAllMocks() })

describe('xeroHealth', () => {
  test('returns synced/pending/failed counts, last sync time, and the current mode', async () => {
    Invoice.count.mockImplementation(({ where }) => {
      if (where.status === 'synced_to_xero') return Promise.resolve(12)
      if (where.status === 'approved') return Promise.resolve(3)
      if (where.status === 'failed') return Promise.resolve(1)
      return Promise.resolve(0)
    })
    const lastSync = new Date('2026-08-01T00:00:00.000Z')
    XeroSyncLog.findOne.mockResolvedValue({ synced_at: lastSync })
    xeroService.describeMode.mockReturnValue({ simulated: true, label: 'SIMULATION', detail: 'Xero calls are simulated.' })

    const res = mockRes()
    await xeroHealth({ query: {} }, res)

    expect(jsonBody(res).data).toEqual({
      counts: { synced: 12, pending: 3, failed: 1 },
      last_synced_at: lastSync,
      mode: { simulated: true, label: 'SIMULATION', detail: 'Xero calls are simulated.' },
    })
  })
})

describe('revenueTrend', () => {
  test('buckets synced invoice revenue by month by default', async () => {
    Invoice.findAll.mockResolvedValue([
      { total_amount: '100.00', createdAt: new Date('2026-06-05T00:00:00.000Z') },
      { total_amount: '50.50',  createdAt: new Date('2026-06-20T00:00:00.000Z') },
      { total_amount: '75.00',  createdAt: new Date('2026-07-01T00:00:00.000Z') },
    ])

    const res = mockRes()
    await revenueTrend({ query: {} }, res)

    const data = jsonBody(res).data
    expect(data.granularity).toBe('month')
    expect(data.trend).toEqual(
      expect.arrayContaining([
        { bucket: '2026-06', total_revenue: '150.50' },
        { bucket: '2026-07', total_revenue: '75.00' },
      ])
    )
  })
})

describe('topClients', () => {
  test('ranks clients by total synced revenue, capped at 5, with booking_count attached', async () => {
    Invoice.findAll.mockResolvedValue([
      { client_id: 1, total_amount: '1000.00', Client: { id: 1, name: 'TTSH' } },
      { client_id: 1, total_amount: '500.00',  Client: { id: 1, name: 'TTSH' } },
      { client_id: 2, total_amount: '2000.00', Client: { id: 2, name: 'CGH' } },
    ])
    Booking.findAll.mockResolvedValue([
      { client_id: 1, id: 10 }, { client_id: 1, id: 11 }, { client_id: 2, id: 12 },
    ])

    const res = mockRes()
    await topClients({ query: {} }, res)

    const data = jsonBody(res).data
    expect(data.top_clients[0]).toMatchObject({ client_id: 2, client_name: 'CGH', total_revenue: '2000.00', invoice_count: 1, booking_count: 1 })
    expect(data.top_clients[1]).toMatchObject({ client_id: 1, client_name: 'TTSH', total_revenue: '1500.00', invoice_count: 2, booking_count: 2 })
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest tests/jasper/dashboardXeroHealthRevenueTopClients.test.js`
Expected: FAIL - none of the three functions exist yet.

- [ ] **Step 3: Implement all three**

In `backend/src/controllers/dashboardController.js`, insert immediately after the `cycleTime` function added in Task 2 (still before `module.exports`):

```js
// GET /api/dashboard/xero-health - synced/pending/failed invoice counts, the most
// recent successful sync, and whether Xero pushes are simulated or live. None of this
// was previously surfaced on the Executive Dashboard - only on the Xero Settings and
// Sync Status screens.
async function xeroHealth(req, res) {
  try {
    const [synced, pending, failed] = await Promise.all([
      Invoice.count({ where: { status: 'synced_to_xero' } }),
      Invoice.count({ where: { status: 'approved' } }),
      Invoice.count({ where: { status: 'failed' } }),
    ])

    const lastLog = await XeroSyncLog.findOne({
      where: { entity_type: 'ar_invoice', status: 'success' },
      order: [['synced_at', 'DESC']],
      attributes: ['synced_at'],
    })

    return success(res, {
      counts: { synced, pending, failed },
      last_synced_at: lastLog ? lastLog.synced_at : null,
      mode: xeroService.describeMode(),
    })
  } catch (err) {
    return internalError(res, err)
  }
}

// GET /api/dashboard/revenue-trend?granularity=month|week - invoiced revenue over
// time. Only counts invoices that reached synced_to_xero, since anything earlier in
// the pipeline isn't confirmed revenue yet. Defaults to the trailing 12 months.
async function revenueTrend(req, res) {
  try {
    const granularity = req.query.granularity === 'week' ? 'week' : 'month'
    const now = new Date()
    const from = new Date(now)
    if (granularity === 'week') from.setDate(from.getDate() - 7 * 12)
    else from.setMonth(from.getMonth() - 12)

    const invoices = await Invoice.findAll({
      where: { status: 'synced_to_xero', createdAt: { [Op.gte]: from } },
      attributes: ['total_amount', 'createdAt'],
    })

    const bucketKey = (date) => {
      if (granularity === 'week') {
        const d = new Date(date)
        const monday = new Date(d)
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
        return toDateOnly(monday)
      }
      return new Date(date).toISOString().slice(0, 7) // YYYY-MM
    }

    const buckets = new Map()
    for (const inv of invoices) {
      const key = bucketKey(inv.createdAt)
      buckets.set(key, (buckets.get(key) || 0) + Number(inv.total_amount))
    }

    const trend = [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([bucket, total]) => ({ bucket, total_revenue: total.toFixed(2) }))

    return success(res, { granularity, from: toDateOnly(from), to: toDateOnly(now), trend })
  } catch (err) {
    return internalError(res, err)
  }
}

// GET /api/dashboard/top-clients - top 5 clients by invoiced (synced_to_xero)
// revenue, with each client's total booking volume shown alongside.
async function topClients(req, res) {
  try {
    const invoices = await Invoice.findAll({
      where: { status: 'synced_to_xero' },
      include: [{ model: Client, attributes: ['id', 'name'] }],
      attributes: ['client_id', 'total_amount'],
    })

    const byClient = new Map()
    for (const inv of invoices) {
      const entry = byClient.get(inv.client_id) || {
        client_id: inv.client_id,
        client_name: inv.Client ? inv.Client.name : 'Unknown Client',
        total_revenue: 0,
        invoice_count: 0,
      }
      entry.total_revenue += Number(inv.total_amount)
      entry.invoice_count += 1
      byClient.set(inv.client_id, entry)
    }

    const bookings = await Booking.findAll({ attributes: ['client_id', 'id'] })
    const bookingCountByClient = new Map()
    for (const b of bookings) {
      bookingCountByClient.set(b.client_id, (bookingCountByClient.get(b.client_id) || 0) + 1)
    }

    const topClientsList = [...byClient.values()]
      .map((c) => ({
        client_id: c.client_id,
        client_name: c.client_name,
        total_revenue: c.total_revenue.toFixed(2),
        invoice_count: c.invoice_count,
        booking_count: bookingCountByClient.get(c.client_id) || 0,
      }))
      .sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue))
      .slice(0, 5)

    return success(res, { top_clients: topClientsList })
  } catch (err) {
    return internalError(res, err)
  }
}
```

Then replace:

```js
module.exports = { fleetOverview, vendorExpenses, revenueLeakage, cycleTime }
```

with:

```js
module.exports = { fleetOverview, vendorExpenses, revenueLeakage, cycleTime, xeroHealth, revenueTrend, topClients }
```

- [ ] **Step 4: Register the three routes**

In `backend/src/routes/dashboardRoutes.js`, replace:

```js
const { fleetOverviewQuerySchema, vendorExpensesQuerySchema, revenueLeakageQuerySchema, cycleTimeQuerySchema } = require('../validators')
const { fleetOverview, vendorExpenses, revenueLeakage, cycleTime } = require('../controllers/dashboardController')
```

with:

```js
const { fleetOverviewQuerySchema, vendorExpensesQuerySchema, revenueLeakageQuerySchema, cycleTimeQuerySchema, revenueTrendQuerySchema } = require('../validators')
const { fleetOverview, vendorExpenses, revenueLeakage, cycleTime, xeroHealth, revenueTrend, topClients } = require('../controllers/dashboardController')
```

and, immediately before `module.exports = router`, insert:

```js
router.get('/xero-health', authenticate, authorise('managing_director'), xeroHealth)

router.get(
  '/revenue-trend',
  authenticate,
  authorise('managing_director'),
  validate(revenueTrendQuerySchema, 'query'),
  revenueTrend
)

router.get('/top-clients', authenticate, authorise('managing_director'), topClients)
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd backend && npx jest tests/jasper/dashboardXeroHealthRevenueTopClients.test.js`
Expected: PASS (all 3 tests)

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && npx jest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/dashboardController.js backend/src/routes/dashboardRoutes.js backend/tests/jasper/dashboardXeroHealthRevenueTopClients.test.js
git commit -m "feat(backend): add GET /dashboard/xero-health, /revenue-trend, /top-clients"
```

---

## Task 4: Manual verification against the real dev database

**Files:** none (verification only)

- [ ] **Step 1: Reseed and start the backend**

Run: `cd backend && npm run db:setup && npm run dev`

- [ ] **Step 2: Exercise all four endpoints as `doris@efar.com.sg`**

`GET /api/dashboard/cycle-time`, `/xero-health`, `/revenue-trend`, `/top-clients` should each return 200 with real numbers derived from the seeded data (not `null`/empty unless the seed genuinely has no bookings that reached that stage).

- [ ] **Step 2 (no commit):** this task only verifies Tasks 1-3 against real seeded data.

---

## Task 5: Frontend API wrapper functions

**Files:**
- Modify: `frontend/src/api/fieldOps.js`

**Interfaces:**
- Consumes: the four new endpoints (Tasks 2-3)
- Produces: `getCycleTime(params)`, `getXeroHealth()`, `getRevenueTrend(params)`, `getTopClients()` - consumed by Task 6.

- [ ] **Step 1: Add the four functions**

In `frontend/src/api/fieldOps.js`, append after the existing `getVendorExpenses` function:

```js
export function getCycleTime(params) {
  return api.get('/dashboard/cycle-time', { params })
}

export function getXeroHealth() {
  return api.get('/dashboard/xero-health')
}

export function getRevenueTrend(params) {
  return api.get('/dashboard/revenue-trend', { params })
}

export function getTopClients() {
  return api.get('/dashboard/top-clients')
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/fieldOps.js
git commit -m "feat(frontend): add API wrappers for the new dashboard analytics endpoints"
```

---

## Task 6: Fleet Overview tab widgets

**Files:**
- Modify: `frontend/src/pages/dashboard/FleetOverviewTab.jsx`
- Test: `frontend/tests/jasper/FleetOverviewTab.test.jsx` (create)

**Interfaces:**
- Consumes: `getCycleTime`, `getXeroHealth`, `getRevenueTrend`, `getTopClients` (Task 5)
- Produces: no new exports - `FleetOverviewTab` (default export) renders the new widgets alongside the existing ones.

- [ ] **Step 1: Write the failing test**

Create `frontend/tests/jasper/FleetOverviewTab.test.jsx`:

```js
jest.mock('@/context/ToastContext', () => ({ useToast: () => ({ error: jest.fn(), success: jest.fn() }) }))
jest.mock('@/api/fieldOps', () => ({
  getFleetOverview: jest.fn(),
  getCycleTime: jest.fn(),
  getXeroHealth: jest.fn(),
  getRevenueTrend: jest.fn(),
  getTopClients: jest.fn(),
}))

const React = require('react')
const { render, screen } = require('@testing-library/react')
const {
  getFleetOverview, getCycleTime, getXeroHealth, getRevenueTrend, getTopClients,
} = require('@/api/fieldOps')
const FleetOverviewTab = require('../../src/pages/dashboard/FleetOverviewTab').default

function baseFleetOverview() {
  return {
    data: { data: {
      period: { from: '2026-08-01', to: '2026-08-06' },
      totals: { bookings_total: 10, active_jobs: 2, pending_memo_submission: 0, invoices_synced_to_xero: 8 },
      booking_status_breakdown: [{ status: 'completed', count: 10 }],
      revenue_risk: { completed_without_memo: 0, warning: false },
    } },
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  getFleetOverview.mockResolvedValue(baseFleetOverview())
  getCycleTime.mockResolvedValue({ data: { data: { overall_average_days: 2.5, stage_averages_days: {}, rows: [] } } })
  getXeroHealth.mockResolvedValue({ data: { data: {
    counts: { synced: 8, pending: 1, failed: 0 }, last_synced_at: '2026-08-05T00:00:00.000Z',
    mode: { simulated: true, label: 'SIMULATION', detail: 'Xero calls are simulated.' },
  } } })
  getRevenueTrend.mockResolvedValue({ data: { data: { granularity: 'month', trend: [{ bucket: '2026-07', total_revenue: '1000.00' }, { bucket: '2026-08', total_revenue: '1500.00' }] } } })
  getTopClients.mockResolvedValue({ data: { data: { top_clients: [{ client_id: 1, client_name: 'TTSH', total_revenue: '1500.00', invoice_count: 3, booking_count: 4 }] } } })
})

test('renders the average billing cycle KPI, Xero sync health, and top clients once loaded', async () => {
  render(React.createElement(FleetOverviewTab))

  expect(await screen.findByText('Average Billing Cycle')).toBeInTheDocument();
  expect(screen.getByText('2.5 days')).toBeInTheDocument();

  expect(screen.getByText('Xero Sync Health')).toBeInTheDocument();
  expect(screen.getByText('SIMULATION')).toBeInTheDocument();

  expect(screen.getByText('Top Clients')).toBeInTheDocument();
  expect(screen.getByText('TTSH')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx jest tests/jasper/FleetOverviewTab.test.jsx`
Expected: FAIL - none of the new widgets exist yet.

- [ ] **Step 3: Implement the widgets**

In `frontend/src/pages/dashboard/FleetOverviewTab.jsx`, replace the import block:

```jsx
import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCcw } from 'lucide-react'
import { PieChart } from '@mui/x-charts/PieChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/context/ToastContext'
import { getFleetOverview } from '@/api/fieldOps'
```

with:

```jsx
import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, RefreshCcw } from 'lucide-react'
import { PieChart } from '@mui/x-charts/PieChart'
import { LineChart } from '@mui/x-charts/LineChart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/context/ToastContext'
import { getFleetOverview, getCycleTime, getXeroHealth, getRevenueTrend, getTopClients } from '@/api/fieldOps'
```

Then replace the component body from `export default function FleetOverviewTab() {` through its closing `}`:

```jsx
export default function FleetOverviewTab() {
  const [period, setPeriod] = useState('today')
  const [overview, setOverview] = useState(null)
  const [status, setStatus] = useState('loading')
  const [cycleTime, setCycleTime] = useState(null)
  const [xeroHealth, setXeroHealth] = useState(null)
  const [revenueTrend, setRevenueTrend] = useState(null)
  const [topClients, setTopClients] = useState(null)
  const toast = useToast()

  async function load() {
    setStatus('loading')
    try {
      const { data } = await getFleetOverview({ period })
      setOverview(data.data)
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      toast.error(err.response?.data?.message || 'Failed to load fleet overview.')
    }
  }

  // These four are independent of the period filter above (each covers its own trailing
  // window or is a point-in-time snapshot), so they load once rather than re-fetching
  // on every Today/This Week/This Month click.
  async function loadAnalyticsWidgets() {
    try {
      const [cycleRes, xeroRes, trendRes, clientsRes] = await Promise.all([
        getCycleTime(), getXeroHealth(), getRevenueTrend(), getTopClients(),
      ])
      setCycleTime(cycleRes.data.data)
      setXeroHealth(xeroRes.data.data)
      setRevenueTrend(trendRes.data.data)
      setTopClients(clientsRes.data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load some dashboard analytics.')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period])

  useEffect(() => {
    loadAnalyticsWidgets()
  }, [])

  if (status === 'loading') {
    return <div className="flex items-center gap-2 text-muted-foreground text-sm py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading fleet overview...</div>
  }
  if (status === 'error') {
    return (
      <Card><CardContent className="p-6 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Couldn't load the fleet overview.</p>
        <Button variant="outline" size="sm" onClick={load}><RefreshCcw className="w-4 h-4 mr-2" /> Retry</Button>
      </CardContent></Card>
    )
  }

  // Zero-count statuses are dropped rather than passed through as 0-value arcs -
  // MUI still carves out a paddingAngle gap for each arc regardless of its value, so
  // with e.g. 1 total booking the other 3 statuses' phantom slices ate most of the
  // ring and left the real segment looking like a small wedge instead of a full circle.
  const pieData = overview.booking_status_breakdown
    .filter((b) => b.count > 0)
    .map((b) => ({
      id: b.status, value: b.count, label: formatStatusLabel(b.status), color: STATUS_COLORS[b.status],
    }))

  return (
    <div className="space-y-4">
      <Tabs value={period} onValueChange={setPeriod}>
        <TabsList>{PERIODS.map((p) => <TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>)}</TabsList>
      </Tabs>

      <div className="grid grid-cols-5 gap-4">
        <KpiCard label="Total Bookings" value={overview.totals.bookings_total} />
        <KpiCard label="Active Jobs" value={overview.totals.active_jobs} valueColor="#F59E0B" />
        <KpiCard
          label="Pending Memo Submission"
          value={overview.totals.pending_memo_submission}
          valueColor="#EF4444"
          borderColor={overview.revenue_risk.warning ? '#EF4444' : undefined}
        />
        <KpiCard label="Invoices Synced" value={overview.totals.invoices_synced_to_xero} valueColor="#22C55E" />
        <KpiCard
          label="Average Billing Cycle"
          value={cycleTime && cycleTime.overall_average_days !== null ? `${cycleTime.overall_average_days} days` : '—'}
        />
      </div>

      <div className="grid grid-cols-[1.2fr_1fr] gap-4">
        <Card>
          <CardHeader><CardTitle>Booking Status Distribution</CardTitle></CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">No bookings in this period.</p>
            ) : (
              <PieChart
                series={[{ data: pieData, innerRadius: 50, outerRadius: 90, paddingAngle: pieData.length > 1 ? 2 : 0 }]}
                height={260}
              />
            )}
          </CardContent>
        </Card>

        <Card className={overview.revenue_risk.warning ? 'border-l-4' : undefined} style={overview.revenue_risk.warning ? { borderLeftColor: '#EF4444' } : undefined}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {overview.revenue_risk.warning && <AlertTriangle className="w-4 h-4 text-[#EF4444]" />}
              Revenue Leakage Risk
            </CardTitle>
          </CardHeader>
          <CardContent>
            {overview.revenue_risk.warning ? (
              <p className="text-sm text-[#EF4444]">
                {overview.revenue_risk.completed_without_memo} completed job(s) have no memo submitted yet.
              </p>
            ) : (
              <p className="text-sm text-[#22C55E]">All completed jobs have memos.</p>
            )}
            <p className="text-xs text-muted-foreground mt-3">Source: booking data. Read-only view.</p>
          </CardContent>
        </Card>
      </div>

      {xeroHealth && (
        <Card className={xeroHealth.counts.failed > 0 ? 'border-l-4' : undefined} style={xeroHealth.counts.failed > 0 ? { borderLeftColor: '#EF4444' } : undefined}>
          <CardHeader><CardTitle>Xero Sync Health</CardTitle></CardHeader>
          <CardContent className="flex items-center gap-8">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Synced</p>
              <p className="text-2xl font-bold" style={{ color: '#22C55E' }}>{xeroHealth.counts.synced}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{xeroHealth.counts.pending}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold" style={{ color: xeroHealth.counts.failed > 0 ? '#EF4444' : '#1E293B' }}>{xeroHealth.counts.failed}</p>
            </div>
            <div className="ml-auto text-right">
              <span
                className="text-xs font-semibold px-2 py-1 rounded"
                style={xeroHealth.mode.simulated
                  ? { background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }
                  : { background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}
              >
                {xeroHealth.mode.label}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {xeroHealth.last_synced_at ? `Last sync: ${new Date(xeroHealth.last_synced_at).toLocaleString()}` : 'No successful sync yet.'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-[1.2fr_1fr] gap-4">
        <Card>
          <CardHeader><CardTitle>Revenue Trend</CardTitle></CardHeader>
          <CardContent>
            {!revenueTrend || revenueTrend.trend.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">Not enough synced revenue yet to show a trend.</p>
            ) : (
              <LineChart
                height={220}
                xAxis={[{ scaleType: 'point', data: revenueTrend.trend.map((t) => t.bucket) }]}
                series={[{ data: revenueTrend.trend.map((t) => Number(t.total_revenue)), label: 'Revenue ($)', color: '#3B82F6' }]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Top Clients</CardTitle></CardHeader>
          <CardContent>
            {!topClients || topClients.top_clients.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">No synced invoices yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase text-muted-foreground text-left">
                    <th className="pb-2">Client</th>
                    <th className="pb-2 text-right">Revenue</th>
                    <th className="pb-2 text-right">Bookings</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.top_clients.map((c) => (
                    <tr key={c.client_id} className="border-t">
                      <td className="py-2">{c.client_name}</td>
                      <td className="py-2 text-right font-semibold">${Number(c.total_revenue).toFixed(2)}</td>
                      <td className="py-2 text-right text-muted-foreground">{c.booking_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `cd frontend && npx jest tests/jasper/FleetOverviewTab.test.jsx`
Expected: PASS

- [ ] **Step 5: Run the full frontend suite**

Run: `cd frontend && npx jest`
Expected: PASS

- [ ] **Step 6: Start both dev servers and manually verify**

Run: `cd backend && npm run dev` and, in a second terminal, `cd frontend && npm run dev`. Log in as `doris@efar.com.sg`, open the Executive Dashboard's Fleet tab, and confirm all four new widgets render with real numbers and the existing donut/leakage card are unaffected.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/dashboard/FleetOverviewTab.jsx frontend/tests/jasper/FleetOverviewTab.test.jsx
git commit -m "feat(frontend): add billing-cycle KPI, Xero health, revenue trend, top clients to Fleet Overview"
```
