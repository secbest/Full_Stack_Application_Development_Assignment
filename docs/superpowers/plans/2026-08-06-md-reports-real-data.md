# Reports Page Real-Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Reports screen's remaining mock/placeholder data (Billing Cycle tab, Leakage History tab, Vendor Expenditure tab, and the Revenue tab's service-type donut) with real backend-derived data, so nothing on this screen is fabricated before go-live.

**Architecture:** Two new endpoints on the existing `dashboardController.js` (`revenue-by-service-type`, `leakage-history`) plus reuse of two endpoints that already exist (`cycle-time` from the companion Executive Dashboard analytics plan, `vendor-expenses` already live on the Expense Summary tab). `ReportPage.jsx`'s four tab components each switch from a hardcoded array to a prop fed by a new fetch in `ReportsScreen`.

**Tech Stack:** Express, Sequelize, Yup, Jest (backend); React, recharts (already used for the Revenue tab's donut), Jest + Testing Library (frontend).

## Global Constraints

- **Depends on the companion plan** `docs/superpowers/plans/2026-08-06-md-dashboard-analytics-endpoints.md` - `GET /dashboard/cycle-time` must exist before Task 4 of this plan. Run that plan first (or at minimum its Task 2).
- The service-type revenue breakdown is implemented as its own `dashboard` endpoint rather than by extending `GET /api/invoices` (owned by Kwan Hua, `backend/src/controllers/invoiceController.js` / `backend/tests/kwan-hua/invoices.test.js`) - this keeps the change inside Jasper-owned files, matching how Accounts Management's test ownership was handled in the companion session-tracking plan.
- Every new controller function wraps its body in try/catch and returns `internalError(res, err)` on failure (see `project_uncaught_async_handler_crashes_server`).
- Reports is a `managing_director`-only screen (CLAUDE.md role table) - all new/reused routes stay gated to that role (`vendor-expenses` and `cycle-time` already are; the two new endpoints in this plan follow suit).
- No email confirmations; existing CSV/PDF export functions must keep working against the new real data sources.

---

## Task 1: Query validators for the two new endpoints

**Files:**
- Modify: `backend/src/validators/dashboardValidators.js`
- Modify: `backend/src/validators/index.js`

- [ ] **Step 1: Add the two schemas**

In `backend/src/validators/dashboardValidators.js`, add (adjust the exact insertion point to wherever Task 1 of the companion analytics plan left the `module.exports`, which by then also lists `cycleTimeQuerySchema`/`revenueTrendQuerySchema`):

```js
// GET /api/dashboard/revenue-by-service-type and /leakage-history both use the same
// YYYY-MM-DD string validation as revenueLeakageQuerySchema, for the same reason (the
// controller builds an explicit end-of-day bound from the string).
const revenueByServiceTypeQuerySchema = Yup.object({
  date_from: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'date_from must be in YYYY-MM-DD format'),
  date_to: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'date_to must be in YYYY-MM-DD format'),
}).test('date-range', 'date_from must be before or equal to date_to.', dateRangeTest())

const leakageHistoryQuerySchema = Yup.object({
  date_from: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'date_from must be in YYYY-MM-DD format'),
  date_to: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'date_to must be in YYYY-MM-DD format'),
}).test('date-range', 'date_from must be before or equal to date_to.', dateRangeTest())
```

and add both to the file's `module.exports` object.

- [ ] **Step 2: Export them from the shared validators barrel**

In `backend/src/validators/index.js`, add `revenueByServiceTypeQuerySchema` and `leakageHistoryQuerySchema` to both the destructured `require('./dashboardValidators')` line and the final `module.exports` object, alongside the existing dashboard schemas.

- [ ] **Step 3: Commit**

```bash
git add backend/src/validators/dashboardValidators.js backend/src/validators/index.js
git commit -m "feat(backend): add query validators for revenue-by-service-type and leakage-history"
```

---

## Task 2: GET /api/dashboard/revenue-by-service-type

**Files:**
- Modify: `backend/src/controllers/dashboardController.js`
- Modify: `backend/src/routes/dashboardRoutes.js`
- Test: `backend/tests/jasper/dashboardRevenueByServiceType.test.js` (create)

**Interfaces:**
- Consumes: `Invoice.belongsTo(Booking)` (existing association), `Booking.service_type` (existing).
- Produces: `revenueByServiceType(req, res)` → `{ period, breakdown: [{ service_type, label, total_revenue }] }`, sorted descending by revenue. Consumed by Task 6 (frontend).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/jasper/dashboardRevenueByServiceType.test.js`:

```js
jest.mock('../../src/models', () => ({
  Invoice: { findAll: jest.fn() },
  Booking: {},
  Client: {},
  ServiceMemo: {},
  VendorInvoice: {},
  PricingContract: {},
  SurchargeSchedule: {},
  JobMilestone: {},
  XeroSyncLog: {},
}))

const { Invoice } = require('../../src/models')
const { revenueByServiceType } = require('../../src/controllers/dashboardController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => { jest.clearAllMocks() })

describe('revenueByServiceType', () => {
  test('sums total_amount per Booking.service_type, sorted descending, with a friendly label', async () => {
    Invoice.findAll.mockResolvedValue([
      { total_amount: '100.00', Booking: { service_type: 'eas' } },
      { total_amount: '50.00',  Booking: { service_type: 'mts' } },
      { total_amount: '25.00',  Booking: { service_type: 'eas' } },
    ])

    const req = { query: {} }
    const res = mockRes()
    await revenueByServiceType(req, res)

    expect(jsonBody(res).data.breakdown).toEqual([
      { service_type: 'eas', label: 'Emergency Ambulance Services (EAS)', total_revenue: '125.00' },
      { service_type: 'mts', label: 'Medical Transport Service (MTS)', total_revenue: '50.00' },
    ])
  })

  test('groups an invoice with no linked booking under "unknown"', async () => {
    Invoice.findAll.mockResolvedValue([{ total_amount: '10.00', Booking: null }])

    const res = mockRes()
    await revenueByServiceType({ query: {} }, res)

    expect(jsonBody(res).data.breakdown).toEqual([{ service_type: 'unknown', label: 'unknown', total_revenue: '10.00' }])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest tests/jasper/dashboardRevenueByServiceType.test.js`
Expected: FAIL - `revenueByServiceType` doesn't exist yet.

- [ ] **Step 3: Implement it**

In `backend/src/controllers/dashboardController.js`, insert (after the functions added by the companion analytics plan, still before `module.exports`):

```js
const SERVICE_TYPE_LABELS = {
  eas: 'Emergency Ambulance Services (EAS)',
  mts: 'Medical Transport Service (MTS)',
  event_standby: 'Event Standby',
  workplace_standby: 'Workplace Standby',
}

// GET /api/dashboard/revenue-by-service-type - backs the Reports "Revenue by Service
// Type" donut, which previously rendered a hardcoded illustrative chart because
// GET /api/invoices (owned by Kwan Hua) doesn't join in the booking's service_type.
// Implemented here instead of extending that endpoint, to keep this change inside
// Jasper-owned files.
async function revenueByServiceType(req, res) {
  try {
    const { date_from, date_to } = req.query
    const from = date_from || `${new Date().getFullYear()}-01-01`
    const to = date_to || toDateOnly(new Date())

    const invoices = await Invoice.findAll({
      where: { created_at: { [Op.between]: [new Date(from), new Date(`${to}T23:59:59.999Z`)] } },
      include: [{ model: Booking, attributes: ['service_type'] }],
      attributes: ['total_amount'],
    })

    const byType = new Map()
    for (const inv of invoices) {
      const type = inv.Booking ? inv.Booking.service_type : 'unknown'
      byType.set(type, (byType.get(type) || 0) + Number(inv.total_amount))
    }

    const breakdown = [...byType.entries()]
      .map(([service_type, total]) => ({
        service_type,
        label: SERVICE_TYPE_LABELS[service_type] || service_type,
        total_revenue: total.toFixed(2),
      }))
      .sort((a, b) => Number(b.total_revenue) - Number(a.total_revenue))

    return success(res, { period: { from, to }, breakdown })
  } catch (err) {
    return internalError(res, err)
  }
}
```

Add `revenueByServiceType` to the `module.exports` object at the end of the file.

- [ ] **Step 4: Register the route**

In `backend/src/routes/dashboardRoutes.js`, add `revenueByServiceTypeQuerySchema` to the validators import and `revenueByServiceType` to the controller import, then insert before `module.exports = router`:

```js
router.get(
  '/revenue-by-service-type',
  authenticate,
  authorise('managing_director'),
  validate(revenueByServiceTypeQuerySchema, 'query'),
  revenueByServiceType
)
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd backend && npx jest tests/jasper/dashboardRevenueByServiceType.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/dashboardController.js backend/src/routes/dashboardRoutes.js backend/tests/jasper/dashboardRevenueByServiceType.test.js
git commit -m "feat(backend): add GET /dashboard/revenue-by-service-type"
```

---

## Task 3: GET /api/dashboard/leakage-history

**Files:**
- Modify: `backend/src/controllers/dashboardController.js`
- Modify: `backend/src/routes/dashboardRoutes.js`
- Test: `backend/tests/jasper/dashboardLeakageHistory.test.js` (create)

**Interfaces:**
- Consumes: `leakageService.buildReferenceRates`, `leakageService.valueEntry` (both already exported by `backend/src/services/leakageService.js`), `Invoice.unpriced_surcharges`, `Invoice.belongsTo(Booking)`, `Invoice.belongsTo(Client)`.
- Produces: `leakageHistory(req, res)` → `{ period, history: [{ month, estimated_leakage, affected_invoice_count, rows: [{ invoice_id, booking_reference, client_name, created_at, unpriced_count, estimated_amount }] }] }`, sorted ascending by month. Consumed by Task 8 (frontend).

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/jasper/dashboardLeakageHistory.test.js`:

```js
jest.mock('../../src/models', () => ({
  Invoice: { findAll: jest.fn() },
  SurchargeSchedule: { findAll: jest.fn() },
  Booking: {}, Client: {}, ServiceMemo: {}, VendorInvoice: {}, PricingContract: {}, JobMilestone: {}, XeroSyncLog: {},
}))

const { Invoice, SurchargeSchedule } = require('../../src/models')
const { leakageHistory } = require('../../src/controllers/dashboardController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => { jest.clearAllMocks() })

describe('leakageHistory', () => {
  test('groups estimated leakage by month, skipping invoices with no unpriced surcharges', async () => {
    SurchargeSchedule.findAll.mockResolvedValue([{ surcharge_type: 'oxygen_per_litre', amount: 10 }])
    Invoice.findAll.mockResolvedValue([
      {
        id: 1, createdAt: new Date('2026-06-10T00:00:00.000Z'),
        Booking: { reference_number: 'BKG-001' }, Client: { name: 'TTSH' },
        unpriced_surcharges: [{ surcharge_type: 'oxygen_per_litre', label: 'Oxygen', quantity: 2 }],
      },
      {
        id: 2, createdAt: new Date('2026-06-20T00:00:00.000Z'),
        Booking: { reference_number: 'BKG-002' }, Client: { name: 'CGH' },
        unpriced_surcharges: [],
      },
      {
        id: 3, createdAt: new Date('2026-07-01T00:00:00.000Z'),
        Booking: { reference_number: 'BKG-003' }, Client: { name: 'TTSH' },
        unpriced_surcharges: [{ surcharge_type: 'oxygen_per_litre', label: 'Oxygen', quantity: 1 }],
      },
    ])

    const res = mockRes()
    await leakageHistory({ query: {} }, res)

    const history = jsonBody(res).data.history
    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({ month: '2026-06', estimated_leakage: 20, affected_invoice_count: 1 })
    expect(history[0].rows).toEqual([
      { invoice_id: 1, booking_reference: 'BKG-001', client_name: 'TTSH', created_at: new Date('2026-06-10T00:00:00.000Z'), unpriced_count: 1, estimated_amount: 20 },
    ])
    expect(history[1]).toMatchObject({ month: '2026-07', estimated_leakage: 10, affected_invoice_count: 1 })
  })

  test('returns an empty history array when no invoice has unpriced surcharges', async () => {
    SurchargeSchedule.findAll.mockResolvedValue([])
    Invoice.findAll.mockResolvedValue([{ id: 1, createdAt: new Date(), Booking: null, Client: null, unpriced_surcharges: [] }])

    const res = mockRes()
    await leakageHistory({ query: {} }, res)

    expect(jsonBody(res).data.history).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd backend && npx jest tests/jasper/dashboardLeakageHistory.test.js`
Expected: FAIL - `leakageHistory` doesn't exist yet.

- [ ] **Step 3: Implement it**

In `backend/src/controllers/dashboardController.js`, insert (after `revenueByServiceType`, still before `module.exports`):

```js
// GET /api/dashboard/leakage-history - monthly-grouped view of the same
// unpriced-surcharge data revenueLeakage above reports as a point-in-time snapshot.
// Backs the Reports "Leakage History" tab. Reuses leakageService's reference-rate
// and per-entry valuation helpers rather than buildLeakageReport's single aggregate
// shape, since this needs one bucket per month instead of one bucket total.
async function leakageHistory(req, res) {
  try {
    const { date_from, date_to } = req.query
    const from = date_from || `${new Date().getFullYear()}-01-01`
    const to = date_to || toDateOnly(new Date())

    const invoices = await Invoice.findAll({
      where: { created_at: { [Op.between]: [new Date(from), new Date(`${to}T23:59:59.999Z`)] } },
      include: [
        { model: Client, attributes: ['id', 'name'], required: false },
        { model: Booking, attributes: ['reference_number'], required: false },
      ],
    })

    const surchargeRows = await SurchargeSchedule.findAll({ attributes: ['surcharge_type', 'amount'] })
    const reference = leakageService.buildReferenceRates(surchargeRows)

    const byMonth = new Map()
    for (const inv of invoices) {
      const entries = Array.isArray(inv.unpriced_surcharges) ? inv.unpriced_surcharges : []
      if (!entries.length) continue

      let invoiceTotal = 0
      for (const entry of entries) {
        if (!entry || !entry.surcharge_type) continue
        invoiceTotal += leakageService.valueEntry(entry, reference).estimated_amount
      }

      const month = new Date(inv.createdAt).toISOString().slice(0, 7)
      const bucket = byMonth.get(month) || { month, estimated_leakage: 0, affected_invoice_count: 0, rows: [] }
      bucket.estimated_leakage = round2(bucket.estimated_leakage + invoiceTotal)
      bucket.affected_invoice_count += 1
      bucket.rows.push({
        invoice_id: inv.id,
        booking_reference: inv.Booking ? inv.Booking.reference_number : null,
        client_name: inv.Client ? inv.Client.name : null,
        created_at: inv.createdAt,
        unpriced_count: entries.length,
        estimated_amount: round2(invoiceTotal),
      })
      byMonth.set(month, bucket)
    }

    const history = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))

    return success(res, { period: { from, to }, history })
  } catch (err) {
    return internalError(res, err)
  }
}
```

Add `leakageHistory` to the `module.exports` object.

- [ ] **Step 4: Register the route**

In `backend/src/routes/dashboardRoutes.js`, add `leakageHistoryQuerySchema` to the validators import and `leakageHistory` to the controller import, then insert before `module.exports = router`:

```js
router.get(
  '/leakage-history',
  authenticate,
  authorise('managing_director'),
  validate(leakageHistoryQuerySchema, 'query'),
  leakageHistory
)
```

- [ ] **Step 5: Run it to verify it passes**

Run: `cd backend && npx jest tests/jasper/dashboardLeakageHistory.test.js`
Expected: PASS

- [ ] **Step 6: Run the full backend suite**

Run: `cd backend && npx jest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/dashboardController.js backend/src/routes/dashboardRoutes.js backend/tests/jasper/dashboardLeakageHistory.test.js
git commit -m "feat(backend): add GET /dashboard/leakage-history"
```

---

## Task 4: Manual verification against the real dev database

- [ ] **Step 1: Reseed and start the backend**

Run: `cd backend && npm run db:setup && npm run dev`

- [ ] **Step 2: Exercise the two new endpoints plus the pre-existing cycle-time endpoint as `doris@efar.com.sg`**

`GET /api/dashboard/revenue-by-service-type`, `/leakage-history`, and `/cycle-time` (from the companion analytics plan) should each return 200 with data reflecting the seeded bookings/invoices. No commit - verification only.

---

## Task 5: Frontend API wrapper functions

**Files:**
- Modify: `frontend/src/api/fieldOps.js`

**Interfaces:**
- Consumes: the two new endpoints (Tasks 2-3), plus `getCycleTime`/`getVendorExpenses` already added/existing in this file.
- Produces: `getRevenueByServiceType(params)`, `getLeakageHistory(params)` - consumed by Tasks 6 and 8.

- [ ] **Step 1: Add the two functions**

In `frontend/src/api/fieldOps.js`, append:

```js
export function getRevenueByServiceType(params) {
  return api.get('/dashboard/revenue-by-service-type', { params })
}

export function getLeakageHistory(params) {
  return api.get('/dashboard/leakage-history', { params })
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/fieldOps.js
git commit -m "feat(frontend): add API wrappers for revenue-by-service-type and leakage-history"
```

---

## Task 6: Revenue tab - real service-type breakdown

**Files:**
- Modify: `frontend/src/pages/dashboard/ReportPage.jsx`

**Interfaces:**
- Consumes: `getRevenueByServiceType` (Task 5)
- Produces: `ReportRevenue` now takes a `serviceBreakdown` prop (array of `{ service_type, label, total_revenue }`) instead of reading the module-level `SERVICE_DONUT` constant.

- [ ] **Step 1: Remove the hardcoded donut data**

In `frontend/src/pages/dashboard/ReportPage.jsx`, replace:

```jsx
// Revenue by Service Type has no backing field yet - GET /api/invoices doesn't join
// in the service memo's service_type, so this chart stays illustrative until that's
// added. Everything else on the Revenue tab (KPIs, Revenue by Client, Invoice
// Breakdown) is now computed from real fetched invoices - see ReportRevenue below.
const SERVICE_DONUT = [
  { label: "Emergency Ambulance Services (EAS)", value: 38940, color: "#1E293B" },
  { label: "Medical Transport Service (MTS)",    value: 10820, color: "#3B82F6" },
  { label: "Event Standby",                      value: 3100,  color: "#F59E0B" },
  { label: "Workplace Standby",                  value: 1350,  color: "#22C55E" },
];
```

with:

```jsx
// Assigns a color to each service-type slice in the order the backend returns them
// (sorted by revenue descending), since GET /dashboard/revenue-by-service-type
// returns amounts, not colors. Repeats if there are ever more than 4 service types.
const DONUT_COLORS = ["#1E293B", "#3B82F6", "#F59E0B", "#22C55E"];
```

- [ ] **Step 2: Update ReportRevenue to render from the real prop**

Replace:

```jsx
function ReportRevenue({ invoices, loading, error, period }) {
```

with:

```jsx
function ReportRevenue({ invoices, loading, error, period, serviceBreakdown }) {
```

Replace:

```jsx
  const totalRevenueDonut = SERVICE_DONUT.reduce((s, d) => s + d.value, 0);
```

with:

```jsx
  const donutData = (serviceBreakdown || []).map((d, i) => ({ label: d.label, value: Number(d.total_revenue), color: DONUT_COLORS[i % DONUT_COLORS.length] }));
  const totalRevenueDonut = donutData.reduce((s, d) => s + d.value, 0);
```

Replace the "Revenue by Service Type" card body:

```jsx
        {/* Revenue by Service Type */}
        <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Revenue by Service Type</h2>
            <span style={{ fontSize: 11, color: "#94A3B8", fontStyle: "italic", fontFamily: "'Inter', sans-serif" }}>Illustrative - per-invoice service type isn't in the API response yet</span>
          </div>
          <div style={{ padding: "16px 24px" }}>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={SERVICE_DONUT} cx="50%" cy="50%" innerRadius={55} outerRadius={84} paddingAngle={3} dataKey="value" nameKey="label" isAnimationActive={false}>
                    {SERVICE_DONUT.map((entry, i) => <Cell key={`donut-cell-${i}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`$${v.toLocaleString()}`, name]} contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, color: "#1E293B", fontSize: 13, fontFamily: "'Inter', sans-serif", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} itemStyle={{ color: "#1E293B" }} labelStyle={{ color: "#64748B" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {SERVICE_DONUT.map((d) => (
                <div key={d.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: 13, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{d.label}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>${d.value.toLocaleString()}</span>
                    <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>{Math.round((d.value / totalRevenueDonut) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
```

with:

```jsx
        {/* Revenue by Service Type */}
        <div style={{ ...cardBase, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>Revenue by Service Type</h2>
          </div>
          <div style={{ padding: "16px 24px" }}>
            {donutData.length === 0 ? (
              <p style={{ fontSize: 13, color: "#94A3B8", fontFamily: "'Inter', sans-serif", textAlign: "center", padding: "20px 0" }}>No invoices in this period.</p>
            ) : (
              <>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={55} outerRadius={84} paddingAngle={3} dataKey="value" nameKey="label" isAnimationActive={false}>
                        {donutData.map((entry, i) => <Cell key={`donut-cell-${i}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v, name) => [`$${v.toLocaleString()}`, name]} contentStyle={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8, color: "#1E293B", fontSize: 13, fontFamily: "'Inter', sans-serif", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }} itemStyle={{ color: "#1E293B" }} labelStyle={{ color: "#64748B" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
                  {donutData.map((d) => (
                    <div key={d.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0, display: "inline-block" }} />
                        <span style={{ fontSize: 13, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{d.label}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>${d.value.toLocaleString()}</span>
                        <span style={{ fontSize: 12, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>{Math.round((d.value / totalRevenueDonut) * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
```

- [ ] **Step 3: Fetch the real breakdown and pass it down**

This is wired in Task 10 (the shared `ReportsScreen` fetch-effect task), since it touches the same effect all four tabs' real-data fetches share. Leave `ReportRevenue`'s call site (`<ReportRevenue invoices={invoices} ... />`) unchanged for now - Task 10 adds the `serviceBreakdown` prop there alongside the other three tabs' data.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/dashboard/ReportPage.jsx
git commit -m "feat(frontend): Revenue tab service-type donut reads real backend data"
```

---

## Task 7: Billing Cycle tab - real cycle-time data

**Files:**
- Modify: `frontend/src/pages/dashboard/ReportPage.jsx`

**Interfaces:**
- Consumes: `GET /dashboard/cycle-time` response shape (from the companion analytics plan): `{ overall_average_days, stage_averages_days, rows: [{ booking_id, job_completed_at, memo_submitted_at, invoice_approved_at, synced_at, total_days }] }`.
- Produces: `ReportBillingCycle` now takes `{ data, loading, error }` props instead of reading `BILLING_ROWS`.

- [ ] **Step 1: Remove BILLING_ROWS and rewrite ReportBillingCycle**

Replace:

```jsx
const BILLING_ROWS = [
  { bkg: "BKG-008", jobDate: "5 Jul 2026",  memoAt: "5 Jul 2026",  invAt: "6 Jul 2026",  syncAt: "6 Jul 2026",  days: 1 },
  { bkg: "BKG-007", jobDate: "3 Jul 2026",  memoAt: "3 Jul 2026",  invAt: "4 Jul 2026",  syncAt: "4 Jul 2026",  days: 1 },
  { bkg: "BKG-006", jobDate: "2 Jul 2026",  memoAt: "3 Jul 2026",  invAt: "4 Jul 2026",  syncAt: "5 Jul 2026",  days: 3 },
  { bkg: "BKG-005", jobDate: "1 Jul 2026",  memoAt: "4 Jul 2026",  invAt: "5 Jul 2026",  syncAt: "6 Jul 2026",  days: 5 },
  { bkg: "BKG-004", jobDate: "14 Jun 2026", memoAt: "14 Jun 2026", invAt: "15 Jun 2026", syncAt: "15 Jun 2026", days: 1 },
];
```

with nothing (delete the block entirely).

Replace the whole `ReportBillingCycle` function:

```jsx
function ReportBillingCycle() {
  const cardBase = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...cardBase, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20 }}>
        <div>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Average Billing Cycle</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>1.8 days</span>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>Average days from job completion to Xero sync this quarter. Rows marked in amber exceeded 3 days.</p>
      </div>
      <div style={{ ...cardBase, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
              {["Booking Ref", "Job Date", "Memo Submitted", "Invoice Approved", "Synced At", "Total Days"].map((col) => (
                <th key={col} style={{ padding: "11px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Inter', sans-serif", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BILLING_ROWS.map((row, i) => {
              const isLate = row.days > 3;
              const bg = isLate ? "rgba(245,158,11,0.07)" : i % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
              return (
                <tr key={row.bkg} style={{ borderBottom: "1px solid #F1F5F9", height: 48, background: bg }}>
                  <td style={{ padding: "0 16px", fontSize: 13, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.bkg}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.jobDate}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.memoAt}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.invAt}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.syncAt}</td>
                  <td style={{ padding: "0 16px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: isLate ? "#F59E0B" : "#22C55E", fontFamily: "'Inter', sans-serif" }}>{row.days}d</span>
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

with:

```jsx
function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

function ReportBillingCycle({ data, loading, error }) {
  const cardBase = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };

  if (loading) {
    return <div style={{ ...cardBase, padding: "48px 24px", textAlign: "center" }}><p style={{ fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Loading billing cycle data…</p></div>;
  }
  if (error) {
    return <div style={{ ...cardBase, padding: "48px 24px", textAlign: "center" }}><p style={{ fontSize: 13, color: "#EF4444", fontFamily: "'Inter', sans-serif" }}>{error}</p></div>;
  }

  const rows = data?.rows || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...cardBase, padding: "20px 24px", display: "flex", alignItems: "center", gap: 20 }}>
        <div>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Average Billing Cycle</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{data?.overall_average_days != null ? `${data.overall_average_days} days` : "—"}</span>
        </div>
        <p style={{ fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>Average days from job completion to Xero sync in this period. Rows marked in amber exceeded 3 days; bookings not yet synced show "—" for Total Days.</p>
      </div>
      <div style={{ ...cardBase, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
              {["Booking ID", "Job Completed", "Memo Submitted", "Invoice Approved", "Synced At", "Total Days"].map((col) => (
                <th key={col} style={{ padding: "11px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Inter', sans-serif", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>No completed jobs in this period.</td></tr>
            ) : rows.map((row, i) => {
              const isLate = row.total_days != null && row.total_days > 3;
              const bg = isLate ? "rgba(245,158,11,0.07)" : i % 2 === 1 ? "#F8FAFC" : "#FFFFFF";
              return (
                <tr key={row.booking_id} style={{ borderBottom: "1px solid #F1F5F9", height: 48, background: bg }}>
                  <td style={{ padding: "0 16px", fontSize: 13, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>BKG-{row.booking_id}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{fmtDate(row.job_completed_at)}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{fmtDate(row.memo_submitted_at)}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{fmtDate(row.invoice_approved_at)}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{fmtDate(row.synced_at)}</td>
                  <td style={{ padding: "0 16px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: row.total_days == null ? "#94A3B8" : isLate ? "#F59E0B" : "#22C55E", fontFamily: "'Inter', sans-serif" }}>{row.total_days != null ? `${row.total_days}d` : "—"}</span>
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

- [ ] **Step 2: Update getReportTableData's "billing" branch to read from the real rows**

Replace:

```jsx
  if (reportTab === "billing") {
    return {
      title: "Billing Cycle Report",
      headers: ["Booking Ref", "Job Date", "Memo Submitted", "Invoice Approved", "Synced At", "Total Days"],
      rows: BILLING_ROWS.map((r) => [r.bkg, r.jobDate, r.memoAt, r.invAt, r.syncAt, `${r.days}d`]),
    };
  }
```

with:

```jsx
  if (reportTab === "billing") {
    const rows = (cycleTimeData?.rows) || [];
    return {
      title: "Billing Cycle Report",
      headers: ["Booking ID", "Job Completed", "Memo Submitted", "Invoice Approved", "Synced At", "Total Days"],
      rows: rows.map((r) => [`BKG-${r.booking_id}`, fmtDate(r.job_completed_at), fmtDate(r.memo_submitted_at), fmtDate(r.invoice_approved_at), fmtDate(r.synced_at), r.total_days != null ? `${r.total_days}d` : "—"]),
    };
  }
```

This changes `getReportTableData`'s signature - Task 10 updates it (and its call sites in `PeriodBar`/export functions) to accept the extra data sources for all four tabs together, since they all need to change at once.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/dashboard/ReportPage.jsx
git commit -m "feat(frontend): Billing Cycle tab reads real cycle-time data"
```

---

## Task 8: Leakage History tab - real leakage data

**Files:**
- Modify: `frontend/src/pages/dashboard/ReportPage.jsx`

**Interfaces:**
- Consumes: `GET /dashboard/leakage-history` response shape (Task 3): `{ history: [{ month, estimated_leakage, affected_invoice_count, rows: [{ invoice_id, booking_reference, client_name, created_at, unpriced_count, estimated_amount }] }] }`.
- Produces: `ReportLeakage` now takes `{ data, loading, error }` props. The invented mock columns ("Days Until Memo", "Crew Member", "Resolution") are replaced by columns the real data actually has - there is no crew/resolution concept in `unpriced_surcharges`.

- [ ] **Step 1: Remove LEAKAGE_ROWS, BILLING_STATUS_CONFIG, getBillingStatus, and BillingStatusBadge**

Delete these four blocks entirely from `frontend/src/pages/dashboard/ReportPage.jsx`:

```jsx
const LEAKAGE_ROWS = [
  { bkg: "BKG-004", client: "TTSH",          completedAt: "14 Jun 2026", daysUntilMemo: 0.4, crew: "—",          resolution: "Memo Submitted" },
  { bkg: "BKG-007", client: "CGH",           completedAt: "20 Jun 2026", daysUntilMemo: 2.1, crew: "Ahmad",      resolution: "Memo Submitted" },
  { bkg: "BKG-009", client: "Mount Alvernia",completedAt: "20 Jun 2026", daysUntilMemo: 4.3, crew: "Jason Teo",  resolution: "Still Missing" },
  { bkg: "BKG-011", client: "TTSH",          completedAt: "25 Jun 2026", daysUntilMemo: 1.2, crew: "Ravi Kumar", resolution: "Dismissed" },
];

// Billing status badge: derived from the leak's resolution/days, distinct from the
// per-row "Resolution" column (what happened to the leak) below.
const BILLING_STATUS_CONFIG = {
  missing:  { label: "Missing", bg: "rgba(239,68,68,0.15)",  color: "#991B1B", Icon: XCircle },
  late:     { label: "Late",    bg: "rgba(245,158,11,0.15)", color: "#92400E", Icon: AlertTriangle },
  on_time:  { label: "On Time", bg: "rgba(34,197,94,0.15)",  color: "#166534", Icon: null },
};

function getBillingStatus(row) {
  if (row.resolution === "Still Missing") return "missing";
  if (row.daysUntilMemo >= 2) return "late";
  return "on_time";
}

function BillingStatusBadge({ status }) {
  const { label, bg, color, Icon } = BILLING_STATUS_CONFIG[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, background: bg, color, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>
      {Icon && <Icon size={12} strokeWidth={2.5} />}
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Replace ReportLeakage**

Replace the whole `ReportLeakage` function:

```jsx
function ReportLeakage() {
  const cardBase = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
  const resStyle = (r) => r === "Memo Submitted" ? { bg: "rgba(34,197,94,0.10)", color: "#22C55E" } : r === "Dismissed" ? { bg: "rgba(100,116,139,0.10)", color: "#64748B" } : { bg: "rgba(239,68,68,0.10)", color: "#EF4444" };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...cardBase, padding: "18px 24px", display: "flex", alignItems: "center", gap: 20 }}>
        <AlertTriangle size={22} color="#EF4444" strokeWidth={2} />
        <p style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
          <strong style={{ color: "#1E293B" }}>This quarter: 3 jobs billed late, 1 job never billed.</strong> See the Billing Status column for each booking's status.
        </p>
      </div>
      <div style={{ ...cardBase, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
              {["Booking Ref", "Client", "Completion Date", "Days Until Memo", "Billing Status", "Crew Member", "Resolution"].map((col) => (
                <th key={col} style={{ padding: "11px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Inter', sans-serif", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LEAKAGE_ROWS.map((row, i) => {
              const { bg: rBg, color: rColor } = resStyle(row.resolution);
              return (
                <tr key={row.bkg}
                  style={{ borderBottom: "1px solid #F1F5F9", height: 48, background: "transparent", transition: "background 0.12s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#F1F5F9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <td style={{ padding: "0 16px", fontSize: 13, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.bkg}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.client}</td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.completedAt}</td>
                  <td style={{ padding: "0 16px" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: row.daysUntilMemo >= 3 ? "#EF4444" : row.daysUntilMemo >= 1.5 ? "#F59E0B" : "#22C55E", fontFamily: "'Inter', sans-serif" }}>{row.daysUntilMemo}d</span>
                  </td>
                  <td style={{ padding: "0 16px" }}>
                    <BillingStatusBadge status={getBillingStatus(row)} />
                  </td>
                  <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{row.crew}</td>
                  <td style={{ padding: "0 16px" }}>
                    <span style={{ display: "inline-flex", padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500, background: rBg, color: rColor, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.resolution}</span>
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

with:

```jsx
function ReportLeakage({ data, loading, error }) {
  const cardBase = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };

  if (loading) {
    return <div style={{ ...cardBase, padding: "48px 24px", textAlign: "center" }}><p style={{ fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Loading leakage history…</p></div>;
  }
  if (error) {
    return <div style={{ ...cardBase, padding: "48px 24px", textAlign: "center" }}><p style={{ fontSize: 13, color: "#EF4444", fontFamily: "'Inter', sans-serif" }}>{error}</p></div>;
  }

  const history = data?.history || [];
  const totalLeakage = history.reduce((s, m) => s + m.estimated_leakage, 0);
  const totalAffected = history.reduce((s, m) => s + m.affected_invoice_count, 0);
  const rows = history.flatMap((m) => m.rows.map((r) => ({ ...r, month: m.month })));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ ...cardBase, padding: "18px 24px", display: "flex", alignItems: "center", gap: 20 }}>
        <AlertTriangle size={22} color="#EF4444" strokeWidth={2} />
        <p style={{ fontSize: 14, color: "#64748B", fontFamily: "'Inter', sans-serif", lineHeight: 1.6 }}>
          {totalAffected > 0 ? (
            <><strong style={{ color: "#1E293B" }}>This period: ${totalLeakage.toFixed(2)} in estimated leakage across {totalAffected} invoice{totalAffected === 1 ? "" : "s"}.</strong> Amounts are estimates - see the Revenue Leakage page for methodology.</>
          ) : (
            <strong style={{ color: "#1E293B" }}>No unpriced surcharges were recorded in this period.</strong>
          )}
        </p>
      </div>
      <div style={{ ...cardBase, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
              {["Month", "Booking Ref", "Client", "Invoice Created", "Unpriced Items", "Estimated Amount"].map((col) => (
                <th key={col} style={{ padding: "11px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", fontFamily: "'Inter', sans-serif", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>No unpriced surcharges in this period.</td></tr>
            ) : rows.map((row) => (
              <tr key={row.invoice_id}
                style={{ borderBottom: "1px solid #F1F5F9", height: 48, background: "transparent", transition: "background 0.12s" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#F1F5F9"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{row.month}</td>
                <td style={{ padding: "0 16px", fontSize: 13, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.booking_reference || "—"}</td>
                <td style={{ padding: "0 16px", fontSize: 13, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{row.client_name || "—"}</td>
                <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap" }}>{fmtDate(row.created_at)}</td>
                <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{row.unpriced_count}</td>
                <td style={{ padding: "0 16px", fontSize: 13, fontWeight: 600, color: "#EF4444", fontFamily: "'Inter', sans-serif" }}>${row.estimated_amount.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Update getReportTableData's "leakage" branch**

Replace:

```jsx
  if (reportTab === "leakage") {
    return {
      title: "Leakage History Report",
      headers: ["Booking Ref", "Client", "Completion Date", "Days Until Memo", "Billing Status", "Crew Member", "Resolution"],
      rows: LEAKAGE_ROWS.map((r) => [r.bkg, r.client, r.completedAt, `${r.daysUntilMemo}d`, BILLING_STATUS_CONFIG[getBillingStatus(r)].label, r.crew, r.resolution]),
    };
  }
```

with:

```jsx
  if (reportTab === "leakage") {
    const rows = (leakageHistoryData?.history || []).flatMap((m) => m.rows.map((r) => ({ ...r, month: m.month })));
    return {
      title: "Leakage History Report",
      headers: ["Month", "Booking Ref", "Client", "Invoice Created", "Unpriced Items", "Estimated Amount"],
      rows: rows.map((r) => [r.month, r.booking_reference || "—", r.client_name || "—", fmtDate(r.created_at), r.unpriced_count, `$${r.estimated_amount.toFixed(2)}`]),
    };
  }
```

(`leakageHistoryData` is threaded into `getReportTableData` by Task 10, alongside `cycleTimeData` from Task 7.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/dashboard/ReportPage.jsx
git commit -m "feat(frontend): Leakage History tab reads real leakage data"
```

---

## Task 9: Vendor Expenditure tab - real implementation

**Files:**
- Modify: `frontend/src/pages/dashboard/ReportPage.jsx`

**Interfaces:**
- Consumes: `getVendorExpenses` (already exists in `frontend/src/api/fieldOps.js`, already used by `ExpenseSummaryTab.jsx`).
- Produces: replaces the `ExpenseSummary` placeholder component with a real `ReportVendorExpenditure({ data, loading, error })`, styled with this file's existing inline-style convention (not `ExpenseSummaryTab.jsx`'s shadcn/Tailwind convention, to stay consistent within this file).

- [ ] **Step 1: Replace the placeholder component**

Replace:

```jsx
function ExpenseSummary() {
  return (
    <div style={{ padding: 20, textAlign: 'center', color: '#64748B', fontFamily: "'Inter', sans-serif" }}>
      Vendor Expenditure functionality not yet implemented.
    </div>
  );
}
```

with:

```jsx
function ReportVendorExpenditure({ data, loading, error }) {
  const cardBase = { background: "#FFFFFF", borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" };
  const thS = { padding: "11px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif" };

  if (loading) {
    return <div style={{ ...cardBase, padding: "48px 24px", textAlign: "center" }}><p style={{ fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>Loading vendor expenditure…</p></div>;
  }
  if (error) {
    return <div style={{ ...cardBase, padding: "48px 24px", textAlign: "center" }}><p style={{ fontSize: 13, color: "#EF4444", fontFamily: "'Inter', sans-serif" }}>{error}</p></div>;
  }

  const byVendor = data?.by_vendor || [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Vendor Expenditure</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>${data?.summary?.total_expenditure ?? "0.00"}</span>
        </div>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Rebates Applied</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#22C55E", fontFamily: "'Inter', sans-serif" }}>${data?.summary?.total_rebates_applied ?? "0.00"}</span>
        </div>
        <div style={{ ...cardBase, padding: "20px 24px" }}>
          <p style={{ fontSize: 11, color: "#64748B", fontWeight: 500, fontFamily: "'Inter', sans-serif", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Net Payable After Rebates</p>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>${data?.summary?.net_payable ?? "0.00"}</span>
        </div>
      </div>

      <div style={{ ...cardBase, overflow: "hidden" }}>
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #E2E8F0" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>By Vendor</h2>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #E2E8F0" }}>
              {["Vendor", "Expenditure", "Rebates", "Net Payable", "Invoice Count"].map((col) => <th key={col} style={thS}>{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {byVendor.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "#94A3B8", fontFamily: "'Inter', sans-serif" }}>No approved vendor invoices in this period.</td></tr>
            ) : byVendor.map((v, i) => (
              <tr key={v.vendor_name} style={{ borderBottom: "1px solid #F1F5F9", height: 48, background: i % 2 === 1 ? "#F8FAFC" : "#FFFFFF" }}>
                <td style={{ padding: "0 16px", fontSize: 13, fontWeight: 500, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>{v.vendor_name}</td>
                <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>${v.total_expenditure}</td>
                <td style={{ padding: "0 16px", fontSize: 13, color: "#22C55E", fontFamily: "'Inter', sans-serif" }}>${v.total_rebates}</td>
                <td style={{ padding: "0 16px", fontSize: 13, fontWeight: 600, color: "#1E293B", fontFamily: "'Inter', sans-serif" }}>${v.net_payable}</td>
                <td style={{ padding: "0 16px", fontSize: 13, color: "#64748B", fontFamily: "'Inter', sans-serif" }}>{v.invoice_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update getReportTableData and its callers for the renamed tab**

`getReportTableData` currently returns `null` for `reportTab === "vendor"` (falls through to the final `return null;`), which is why CSV/PDF export is already disabled on that tab (see `PeriodBar`'s `exportDisabled` check) - leave that behavior as-is; Vendor Expenditure gets a real screen in this task but CSV/PDF export for it is out of scope (the existing `getReportTableData` shape - flat header/rows - doesn't fit this tab's KPI-cards-plus-table layout without a redesign of the export format, which is not part of this fix).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/dashboard/ReportPage.jsx
git commit -m "feat(frontend): implement Vendor Expenditure tab with real data"
```

---

## Task 10: Wire ReportsScreen's data fetching for all four tabs

**Files:**
- Modify: `frontend/src/pages/dashboard/ReportPage.jsx`

**Interfaces:**
- Consumes: `getRevenueByServiceType`, `getCycleTime`, `getLeakageHistory`, `getVendorExpenses` (all imported from `../../api/fieldOps`).
- Produces: `ReportsScreen` now fetches and threads four additional datasets to the four tab components and to `getReportTableData`/the export functions.

- [ ] **Step 1: Add the new imports**

Replace:

```jsx
import { listInvoices as fetchInvoices } from '../../api/ar';
```

with:

```jsx
import { listInvoices as fetchInvoices } from '../../api/ar';
import { getRevenueByServiceType, getCycleTime, getLeakageHistory, getVendorExpenses } from '../../api/fieldOps';
```

- [ ] **Step 2: Update getReportTableData's signature and call sites**

Replace:

```jsx
function getReportTableData(reportTab, invoices) {
```

with:

```jsx
function getReportTableData(reportTab, invoices, cycleTimeData, leakageHistoryData) {
```

(The "billing" and "leakage" branches inside this function were already updated in Tasks 7-8 to read `cycleTimeData`/`leakageHistoryData` instead of the removed mock arrays.)

Replace every call site of `getReportTableData(reportTab, invoices)` (there are four: inside `exportReportCSV`, `exportReportPDF`, and twice inside `PeriodBar`'s `exportDisabled` line and its own destructured props) so they instead read `getReportTableData(reportTab, invoices, cycleTimeData, leakageHistoryData)`. Concretely:

Replace:

```jsx
function exportReportCSV(reportTab, period, invoices) {
  const data = getReportTableData(reportTab, invoices);
```

with:

```jsx
function exportReportCSV(reportTab, period, invoices, cycleTimeData, leakageHistoryData) {
  const data = getReportTableData(reportTab, invoices, cycleTimeData, leakageHistoryData);
```

Replace:

```jsx
function exportReportPDF(reportTab, period, invoices) {
  const data = getReportTableData(reportTab, invoices);
```

with:

```jsx
function exportReportPDF(reportTab, period, invoices, cycleTimeData, leakageHistoryData) {
  const data = getReportTableData(reportTab, invoices, cycleTimeData, leakageHistoryData);
```

Replace:

```jsx
function PeriodBar({ period, setPeriod, dateFrom, setDateFrom, dateTo, setDateTo, reportTab, invoices, invoicesLoading }) {
  const [dfFocus, setDfFocus] = useState(false);
  const [dtFocus, setDtFocus] = useState(false);
  const exportDisabled = !getReportTableData(reportTab, invoices) || (reportTab === "revenue" && invoicesLoading);
```

with:

```jsx
function PeriodBar({ period, setPeriod, dateFrom, setDateFrom, dateTo, setDateTo, reportTab, invoices, invoicesLoading, cycleTimeData, leakageHistoryData }) {
  const [dfFocus, setDfFocus] = useState(false);
  const [dtFocus, setDtFocus] = useState(false);
  const exportDisabled = !getReportTableData(reportTab, invoices, cycleTimeData, leakageHistoryData) || (reportTab === "revenue" && invoicesLoading);
```

and, further down in the same component, replace:

```jsx
        <button disabled={exportDisabled} onClick={() => exportReportCSV(reportTab, period, invoices)}
```

with:

```jsx
        <button disabled={exportDisabled} onClick={() => exportReportCSV(reportTab, period, invoices, cycleTimeData, leakageHistoryData)}
```

and replace:

```jsx
        <button disabled={exportDisabled} onClick={() => exportReportPDF(reportTab, period, invoices)}
```

with:

```jsx
        <button disabled={exportDisabled} onClick={() => exportReportPDF(reportTab, period, invoices, cycleTimeData, leakageHistoryData)}
```

- [ ] **Step 3: Add state and a fetch effect for the four new datasets**

Replace:

```jsx
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState("");
```

with:

```jsx
  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [invoicesError, setInvoicesError] = useState("");

  const [serviceBreakdown, setServiceBreakdown] = useState([]);
  const [cycleTimeData, setCycleTimeData] = useState(null);
  const [leakageHistoryData, setLeakageHistoryData] = useState(null);
  const [vendorExpenseData, setVendorExpenseData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState("");
```

Then, immediately after the existing `useEffect` that fetches `invoices` (the one calling `fetchInvoices(...)`), add a second effect covering the same date range:

```jsx
  // The four dashboard-analytics endpoints all take the same YYYY-MM-DD date_from/date_to
  // shape (see backend/src/validators/dashboardValidators.js), unlike the invoices fetch
  // above which takes ISO datetimes - so this effect converts dateRange separately.
  useEffect(() => {
    if (period === "Custom" && (!dateRange.startDate || !dateRange.endDate)) return;

    let cancelled = false;
    setAnalyticsLoading(true);
    setAnalyticsError("");

    const toYMD = (d) => d.toISOString().slice(0, 10);
    const params = {};
    if (dateRange.startDate) params.date_from = toYMD(dateRange.startDate);
    if (dateRange.endDate) params.date_to = toYMD(dateRange.endDate);

    Promise.all([
      getRevenueByServiceType(params),
      getCycleTime(params),
      getLeakageHistory(params),
      getVendorExpenses(params),
    ])
      .then(([serviceRes, cycleRes, leakageRes, vendorRes]) => {
        if (cancelled) return;
        setServiceBreakdown(serviceRes.data.data.breakdown);
        setCycleTimeData(cycleRes.data.data);
        setLeakageHistoryData(leakageRes.data.data);
        setVendorExpenseData(vendorRes.data.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setAnalyticsError(err.response?.data?.message || "Failed to load report analytics.");
      })
      .finally(() => {
        if (!cancelled) setAnalyticsLoading(false);
      });

    return () => { cancelled = true; };
  }, [dateRange, period]);
```

- [ ] **Step 4: Pass the new data down to each tab and to PeriodBar**

Replace:

```jsx
      {/* Period bar */}
      <PeriodBar period={period} setPeriod={setPeriod} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} reportTab={reportTab} invoices={invoices} invoicesLoading={invoicesLoading} />

      {/* Tab content */}
      {reportTab === "revenue" && <ReportRevenue invoices={invoices} loading={invoicesLoading} error={invoicesError} period={period} />}
      {reportTab === "billing" && <ReportBillingCycle />}
      {reportTab === "leakage" && <ReportLeakage />}
      {reportTab === "vendor" && <ExpenseSummary />}
```

with:

```jsx
      {/* Period bar */}
      <PeriodBar period={period} setPeriod={setPeriod} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} reportTab={reportTab} invoices={invoices} invoicesLoading={invoicesLoading} cycleTimeData={cycleTimeData} leakageHistoryData={leakageHistoryData} />

      {/* Tab content */}
      {reportTab === "revenue" && <ReportRevenue invoices={invoices} loading={invoicesLoading} error={invoicesError} period={period} serviceBreakdown={serviceBreakdown} />}
      {reportTab === "billing" && <ReportBillingCycle data={cycleTimeData} loading={analyticsLoading} error={analyticsError} />}
      {reportTab === "leakage" && <ReportLeakage data={leakageHistoryData} loading={analyticsLoading} error={analyticsError} />}
      {reportTab === "vendor" && <ReportVendorExpenditure data={vendorExpenseData} loading={analyticsLoading} error={analyticsError} />}
```

- [ ] **Step 5: Start the dev servers and manually verify all four tabs**

Run: `cd backend && npm run dev` and, in a second terminal, `cd frontend && npm run dev`. Log in as `doris@efar.com.sg`, open Reports, and click through Revenue, Billing Cycle, Leakage History, and Vendor Expenditure - confirm each renders real numbers (not the old mock values like "1.8 days" or "3 jobs billed late"), and that CSV/PDF export on the Revenue and Billing Cycle/Leakage History tabs still produces a file.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/dashboard/ReportPage.jsx
git commit -m "feat(frontend): wire ReportsScreen to fetch real data for all four Reports tabs"
```

---

## Task 11: Frontend tests for the rewritten Reports tabs

**Files:**
- Create: `frontend/tests/jasper/ReportPageRealData.test.jsx`

**Interfaces:**
- Consumes: the rewritten `ReportPage.jsx` (Tasks 6-10)

- [ ] **Step 1: Write the tests**

Create `frontend/tests/jasper/ReportPageRealData.test.jsx`:

```js
jest.mock('../../src/api/ar', () => ({ listInvoices: jest.fn() }))
jest.mock('../../src/api/fieldOps', () => ({
  getRevenueByServiceType: jest.fn(),
  getCycleTime: jest.fn(),
  getLeakageHistory: jest.fn(),
  getVendorExpenses: jest.fn(),
}))

const React = require('react')
const { render, screen, waitFor } = require('@testing-library/react')
const userEvent = require('@testing-library/user-event').default
const { listInvoices } = require('../../src/api/ar')
const { getRevenueByServiceType, getCycleTime, getLeakageHistory, getVendorExpenses } = require('../../src/api/fieldOps')
const ReportsScreen = require('../../src/pages/dashboard/ReportPage').default

beforeEach(() => {
  jest.clearAllMocks()
  listInvoices.mockResolvedValue({ data: [] })
  getRevenueByServiceType.mockResolvedValue({ data: { data: { breakdown: [] } } })
  getCycleTime.mockResolvedValue({ data: { data: { overall_average_days: 3.5, stage_averages_days: {}, rows: [{ booking_id: 42, job_completed_at: '2026-06-01T00:00:00.000Z', memo_submitted_at: '2026-06-02T00:00:00.000Z', invoice_approved_at: '2026-06-03T00:00:00.000Z', synced_at: '2026-06-05T00:00:00.000Z', total_days: 4 }] } } })
  getLeakageHistory.mockResolvedValue({ data: { data: { history: [{ month: '2026-06', estimated_leakage: 120.5, affected_invoice_count: 1, rows: [{ invoice_id: 7, booking_reference: 'BKG-007', client_name: 'CGH', created_at: '2026-06-10T00:00:00.000Z', unpriced_count: 2, estimated_amount: 120.5 }] }] } } })
  getVendorExpenses.mockResolvedValue({ data: { data: { summary: { total_expenditure: '500.00', total_rebates_applied: '50.00', net_payable: '450.00' }, by_vendor: [{ vendor_name: 'MedSupply Co', total_expenditure: '500.00', total_rebates: '50.00', net_payable: '450.00', invoice_count: 2 }], monthly_trend: [] } } })
})

test('Billing Cycle tab renders the real overall average and the row from getCycleTime', async () => {
  render(React.createElement(ReportsScreen))
  await userEvent.click(screen.getByRole('button', { name: 'Billing Cycle' }))

  expect(await screen.findByText('3.5 days')).toBeInTheDocument()
  expect(screen.getByText('BKG-42')).toBeInTheDocument()
})

test('Leakage History tab renders the real monthly summary and row from getLeakageHistory', async () => {
  render(React.createElement(ReportsScreen))
  await userEvent.click(screen.getByRole('button', { name: 'Leakage History' }))

  expect(await screen.findByText(/\$120\.50 in estimated leakage across 1 invoice/)).toBeInTheDocument()
  expect(screen.getByText('BKG-007')).toBeInTheDocument()
})

test('Vendor Expenditure tab renders real KPIs and vendor rows instead of the "not yet implemented" placeholder', async () => {
  render(React.createElement(ReportsScreen))
  await userEvent.click(screen.getByRole('button', { name: 'Vendor Expenditure' }))

  expect(screen.queryByText('Vendor Expenditure functionality not yet implemented.')).not.toBeInTheDocument()
  expect(await screen.findByText('MedSupply Co')).toBeInTheDocument()
  expect(screen.getByText('$500.00')).toBeInTheDocument()
})

test('Revenue tab shows no illustrative-data note and renders real service-type slices', async () => {
  getRevenueByServiceType.mockResolvedValue({ data: { data: { breakdown: [{ service_type: 'eas', label: 'Emergency Ambulance Services (EAS)', total_revenue: '250.00' }] } } })

  render(React.createElement(ReportsScreen))

  await waitFor(() => expect(getRevenueByServiceType).toHaveBeenCalled())
  expect(screen.queryByText(/Illustrative/)).not.toBeInTheDocument()
  expect(await screen.findByText('Emergency Ambulance Services (EAS)')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd frontend && npx jest tests/jasper/ReportPageRealData.test.jsx`
Expected: FAIL before Tasks 6-10 are implemented (or PASS if run after - this task should be executed last so it verifies the finished result).

- [ ] **Step 3: Run it to verify it passes**

Run: `cd frontend && npx jest tests/jasper/ReportPageRealData.test.jsx`
Expected: PASS (all 4 tests)

- [ ] **Step 4: Run the full frontend suite**

Run: `cd frontend && npx jest`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/tests/jasper/ReportPageRealData.test.jsx
git commit -m "test: add coverage for the real-data Reports tabs"
```
