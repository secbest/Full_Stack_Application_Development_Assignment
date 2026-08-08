const { Op } = require('sequelize')
const { Booking, ServiceMemo, Invoice, VendorInvoice, PricingContract, SurchargeSchedule, Client, JobMilestone, XeroSyncLog, User } = require('../models')
const { leakageService } = require('../services')
const xeroService = require('../services/xeroService')
const geocodingService = require('../services/geocodingService')
const { success, internalError, error, notFound, round2 } = require('../utils')

const BOOKING_STATUSES = ['confirmed', 'in_progress', 'completed', 'invoiced']

// Same 5-minute window Accounts Management uses for "Currently Online" (see
// userController.js's isOnline) - a field crew member with no active job is "available"
// if they're logged in and active, otherwise "off duty".
const ONLINE_THRESHOLD_MS = 5 * 60 * 1000
function isOnline(lastActiveAt) {
  if (!lastActiveAt) return false
  return Date.now() - new Date(lastActiveAt).getTime() <= ONLINE_THRESHOLD_MS
}

const MILESTONE_SEQUENCE = ['activated', 'arrived_at_location', 'en_route', 'arrived_at_destination', 'job_completed']

// ~200m of random offset at Singapore's latitude, so two crews simultaneously "en route"
// near the same midpoint don't render as exactly overlapping pins.
function jitter(value) {
  return value + (Math.random() - 0.5) * 0.004
}

// Every crew member with no active job (available or off_duty) shares the exact same HQ
// coordinate - without this they'd render as one pin stacked 6-deep instead of 6 visible
// ones. Deterministic (golden-angle spacing by id, not Math.random()) so a stationary
// crew member's pin doesn't drift to a new spot on every 30s poll - only real movement
// (the en_route jitter above) should look "live".
const HQ_SPREAD_DEGREES = 0.0015 // ~150m at Singapore's latitude
function hqOffset(crewId) {
  const angle = ((crewId * 137.5) % 360) * (Math.PI / 180)
  return { lat: Math.sin(angle) * HQ_SPREAD_DEGREES, lng: Math.cos(angle) * HQ_SPREAD_DEGREES }
}

// Local-calendar-day helpers. Shared with bookingController via utils/date.js, which
// documents why toISOString() is wrong here: every Date reaching toDateOnly is anchored to
// LOCAL midnight - from startOfDay() below, or from Yup.date() coercing a bare
// "2026-08-08" query param (Yup parses date-only strings as local; native `new Date()`
// parses them as UTC, which is why they disagree). In Singapore local midnight is 16:00 the
// previous day in UTC, which put this whole dashboard one calendar day behind.
//
// The output bounds DATE-only columns (scheduled_date, invoice_date), which is why a plain
// calendar string is the right shape here. TIMESTAMP columns use sgDayStart/sgDayEnd below.
const { startOfDay, toDateOnly } = require('../utils/date')

// EFAR operates only in Singapore (UTC+8, no DST). `date_from`/`date_to` arrive as bare
// YYYY-MM-DD calendar dates computed from the browser's local (Singapore) clock, so they
// must be anchored to Singapore local time when bounding a TIMESTAMP column - not UTC.
// Parsing e.g. "2026-08-08T00:00:00.000Z" reads as 08:00 Singapore time, not midnight, which
// silently drops early-morning records (created between local midnight and 8am) from a
// same-day "Today" filter. Only relevant for TIMESTAMP columns (created_at, recorded_at);
// DATE-only columns like scheduled_date/invoice_date have no time component to shift.
const SGT_OFFSET = '+08:00'
function sgDayStart(dateStr) {
  return new Date(`${dateStr}T00:00:00.000${SGT_OFFSET}`)
}
function sgDayEnd(dateStr) {
  return new Date(`${dateStr}T23:59:59.999${SGT_OFFSET}`)
}

// Resolves the `period` shorthand into a concrete [from, to] range. Only used when the
// caller didn't supply explicit date_from/date_to (those always take precedence).
function resolvePeriodRange(period) {
  const today = startOfDay(new Date())

  if (period === 'this_week') {
    const dayOfWeek = today.getDay() // 0 = Sunday
    const monday = new Date(today)
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7))
    return { from: monday, to: today }
  }
  if (period === 'this_month') {
    return { from: new Date(today.getFullYear(), today.getMonth(), 1), to: today }
  }
  return { from: today, to: today } // 'today' (default)
}

// UC-06 fleet overview: aggregates across bookings (Zheng Bao), service_memos (own), and
// invoices (Jasper). "Pending memo submission" is computed as a set difference in JS
// (completed booking IDs minus booking IDs that have a memo) rather than a SQL anti-join -
// at EFAR's data volume this is simpler to read and test than a NOT EXISTS subquery, and
// keeps the query portable if the team ever swaps databases.
async function fleetOverview(req, res) {
  const { period, date_from, date_to } = req.query
  const range = date_from || date_to
    ? { from: new Date(date_from || date_to), to: new Date(date_to || date_from) }
    : resolvePeriodRange(period)

  const from = toDateOnly(range.from)
  const to = toDateOnly(range.to)

  const bookings = await Booking.findAll({
    where: { scheduled_date: { [Op.between]: [from, to] } },
    attributes: ['id', 'status'],
  })
  const bookingIds = bookings.map((b) => b.id)

  const statusCounts = bookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1
    return acc
  }, {})

  const completedIds = bookings.filter((b) => b.status === 'completed').map((b) => b.id)
  const memosForCompleted = completedIds.length
    ? await ServiceMemo.findAll({ where: { booking_id: { [Op.in]: completedIds } }, attributes: ['booking_id'] })
    : []
  const bookingIdsWithMemo = new Set(memosForCompleted.map((m) => m.booking_id))
  const pendingMemoSubmission = completedIds.filter((id) => !bookingIdsWithMemo.has(id)).length

  const invoicesSynced = bookingIds.length
    ? await Invoice.count({ where: { booking_id: { [Op.in]: bookingIds }, status: 'synced_to_xero' } })
    : 0

  return success(res, {
    period: { from, to },
    totals: {
      bookings_total: bookings.length,
      active_jobs: statusCounts.in_progress || 0,
      pending_memo_submission: pendingMemoSubmission,
      invoices_synced_to_xero: invoicesSynced,
    },
    booking_status_breakdown: BOOKING_STATUSES.map((status) => ({ status, count: statusCounts[status] || 0 })),
    revenue_risk: {
      completed_without_memo: pendingMemoSubmission,
      warning: pendingMemoSubmission > 0,
    },
  })
}

// UC-07 vendor expense summary: reads only Kwan Hua's `vendor_invoices`, filtered to
// 'approved' and 'synced_to_xero' so rejected/pending invoices never inflate the totals
// Doris sees. `verified_total` (the AP-reviewed figure) is preferred over `extracted_total`
// (the raw OCR figure) wherever a verified value exists, since verified_total is the
// number that actually reflects what AP signed off on. Gross expenditure and net payable
// are accumulated separately so the rebate is never deducted from verified_total twice.
async function vendorExpenses(req, res) {
  try {
    const { date_from, date_to, vendor_name } = req.query
    const from = date_from || `${new Date().getFullYear()}-01-01`
    const to = date_to || toDateOnly(new Date())

    const where = {
      status: { [Op.in]: ['approved', 'synced_to_xero'] },
      invoice_date: { [Op.between]: [from, to] },
    }
    if (vendor_name) where.vendor_name = { [Op.iLike]: `%${vendor_name}%` }

    const invoices = await VendorInvoice.findAll({ where })
    const grossAmountOf = (inv) => Number(inv.total_including_gst ?? inv.extracted_total ?? 0)
    const netAmountOf = (inv) => Number(inv.verified_total ?? (grossAmountOf(inv) - Number(inv.rebate_amount ?? 0)))
    const rebateOf = (inv) => Number(inv.rebate_amount ?? 0)
    const money = (n) => n.toFixed(2)

    const summary = invoices.reduce(
      (acc, inv) => {
        acc.total_expenditure += grossAmountOf(inv)
        acc.net_payable += netAmountOf(inv)
        acc.total_rebates_applied += rebateOf(inv)
        acc.invoice_count += 1
        return acc
      },
      { total_expenditure: 0, total_rebates_applied: 0, net_payable: 0, invoice_count: 0 }
    )

    const byVendorMap = new Map()
    const monthlyMap = new Map()
    for (const inv of invoices) {
      const amount = grossAmountOf(inv)
      const netAmount = netAmountOf(inv)
      const rebate = rebateOf(inv)

      const vendorEntry = byVendorMap.get(inv.vendor_name) || {
        vendor_name: inv.vendor_name, total_expenditure: 0, total_rebates: 0, net_payable: 0, invoice_count: 0,
      }
      vendorEntry.total_expenditure += amount
      vendorEntry.total_rebates += rebate
      vendorEntry.net_payable += netAmount
      vendorEntry.invoice_count += 1
      byVendorMap.set(inv.vendor_name, vendorEntry)

      const month = (inv.invoice_date || '').slice(0, 7)
      if (month) {
        const monthEntry = monthlyMap.get(month) || { month, total_expenditure: 0, net_payable: 0 }
        monthEntry.total_expenditure += amount
        monthEntry.net_payable += netAmount
        monthlyMap.set(month, monthEntry)
      }
    }

    return success(res, {
      period: { from, to },
      summary: {
        total_expenditure: money(summary.total_expenditure),
        total_rebates_applied: money(summary.total_rebates_applied),
        net_payable: money(summary.net_payable),
        invoice_count: summary.invoice_count,
      },
      by_vendor: [...byVendorMap.values()]
        .sort((a, b) => b.total_expenditure - a.total_expenditure) // largest cost contributor first, per the doc
        .map((v) => ({
          vendor_name: v.vendor_name,
          total_expenditure: money(v.total_expenditure),
          total_rebates: money(v.total_rebates),
          net_payable: money(v.net_payable),
          invoice_count: v.invoice_count,
        })),
      monthly_trend: [...monthlyMap.values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((m) => ({ month: m.month, total_expenditure: money(m.total_expenditure), net_payable: money(m.net_payable) })),
    })
  } catch (err) {
    return internalError(res, err)
  }
}

// GET /api/dashboard/revenue-leakage - the revenue leakage report.
//
// Every invoice carries `unpriced_surcharges`: charges the crew recorded on the memo that
// the client's contract had no rate for. The pricing engine has always refused to drop
// them silently, but nothing read the column, so the platform was quietly accumulating an
// exact record of its own leakage. This turns that record into the report the Managing
// Director needs: how much is going unbilled, which surcharge causes it, and which
// contract to fix first.
//
// Values are ESTIMATES and labelled as such - by definition there is no contracted rate
// for these charges, so the report prices them off the median rate other active contracts
// charge for the same surcharge, and separately counts anything it cannot value at all.
async function revenueLeakage(req, res) {
  const { date_from, date_to } = req.query
  const from = date_from || `${new Date().getFullYear()}-01-01`
  const to = date_to || toDateOnly(new Date())

  // Invoices created in the window that recorded at least one unpriced surcharge. The
  // JSONB emptiness test is done in JS rather than SQL to stay portable across databases
  // (the same reasoning as fleetOverview's set difference above).
  const invoices = await Invoice.findAll({
    where: { created_at: { [Op.between]: [sgDayStart(from), sgDayEnd(to)] } },
    include: [
      { model: Client, attributes: ['id', 'name'], required: false },
      { model: PricingContract, attributes: ['id', 'contract_name'], required: false },
      { model: User, as: 'dismissedBy', attributes: ['id', 'name'], required: false },
    ],
  })

  // Reference rates come from every surcharge row in the system: if any contract prices
  // oxygen_per_litre, that is a defensible basis for valuing a contract that does not.
  const surchargeRows = await SurchargeSchedule.findAll({ attributes: ['surcharge_type', 'amount'] })

  const toRow = (inv) => ({
    id: inv.id,
    client_id: inv.client_id,
    client_name: inv.Client ? inv.Client.name : null,
    contract_id: inv.contract_id,
    contract_name: inv.PricingContract ? inv.PricingContract.contract_name : null,
    created_at: inv.createdAt,
    unpriced_surcharges: inv.unpriced_surcharges || [],
  })

  // A dismissed row is a decision already taken, so it must not keep inflating the open
  // figure the MD is being asked to act on. It is not deleted either: the split is done
  // here rather than in the SQL above so the same reference rates value both sets, and the
  // closed total can be reported alongside instead of vanishing.
  const open = invoices.filter((inv) => !inv.leakage_dismissed_at)
  const dismissed = invoices.filter((inv) => inv.leakage_dismissed_at)

  const report = leakageService.buildLeakageReport(open.map(toRow), surchargeRows)
  const dismissedReport = leakageService.buildLeakageReport(dismissed.map(toRow), surchargeRows)

  const dismissedRows = dismissed
    .filter((inv) => (inv.unpriced_surcharges || []).length > 0)
    .map((inv) => {
      const valued = dismissedReport.affected_invoices.find((r) => r.invoice_id === inv.id)
      return {
        invoice_id: inv.id,
        client_id: inv.client_id,
        client_name: inv.Client ? inv.Client.name : null,
        created_at: inv.createdAt,
        unpriced_count: (inv.unpriced_surcharges || []).length,
        estimated_amount: valued ? valued.estimated_amount : 0,
        dismissed_at: inv.leakage_dismissed_at,
        dismissed_reason: inv.leakage_dismissed_reason,
        dismissed_by: inv.dismissedBy ? { id: inv.dismissedBy.id, name: inv.dismissedBy.name } : null,
      }
    })
    .sort((a, b) => new Date(b.dismissed_at) - new Date(a.dismissed_at))

  return success(res, {
    period: { from, to },
    ...report,
    // Reported separately so "we are leaking $X" and "we decided to stop chasing $Y" stay
    // distinguishable. Folding them into one number would let a write-off look like a fix.
    dismissed: {
      count: dismissedRows.length,
      estimated_amount: dismissedReport.summary.estimated_leakage,
      rows: dismissedRows,
    },
    // Stated in the payload so the UI cannot present an estimate as a billed figure.
    basis_note: 'Amounts are estimates. Unpriced surcharges have no contracted rate by definition, so each is valued at the median rate other contracts charge for the same surcharge type. Items with no reference rate anywhere in the system are counted but valued at zero.',
  })
}

// PATCH /api/dashboard/revenue-leakage/:invoiceId/dismiss
//
// Closes a leakage row that will not be recovered, with an attributable reason. This is the
// end of the loop the report opens: prevention (surcharges price from the published rate
// card) and detection (this report) were already in place, but a gap that had genuinely
// been dealt with - billed separately, or written off - had no way to leave the total.
//
// Deliberately does NOT clear unpriced_surcharges. The record of what went unbilled is the
// evidence behind the decision; erasing it would make the dismissal unauditable and the
// figure unreproducible.
async function dismissLeakage(req, res) {
  try {
    const invoice = await Invoice.findByPk(req.params.invoiceId)
    if (!invoice) return notFound(res, 'No invoice with this id.')

    // Nothing to dismiss is a different situation from an already-dismissed row, and
    // silently succeeding on either would let the UI show a resolution that never happened.
    if (!(invoice.unpriced_surcharges || []).length) {
      return error(res, 'This invoice has no unpriced charges, so there is no leakage to dismiss.', 'NO_LEAKAGE_TO_DISMISS', 409)
    }
    if (invoice.leakage_dismissed_at) {
      return error(res, 'This leakage row has already been dismissed.', 'LEAKAGE_ALREADY_DISMISSED', 409)
    }

    await invoice.update({
      leakage_dismissed_at: new Date(),
      leakage_dismissed_reason: req.body.reason.trim(),
      leakage_dismissed_by: req.user.sub,
    })

    return success(res, {
      invoice_id: invoice.id,
      dismissed_at: invoice.leakage_dismissed_at,
      dismissed_reason: invoice.leakage_dismissed_reason,
    })
  } catch (err) {
    return internalError(res, err)
  }
}

// DELETE /api/dashboard/revenue-leakage/:invoiceId/dismiss - reopens a dismissed row.
//
// A write-off decided in error must be reversible, otherwise the safe move is never to
// dismiss anything and the feature goes unused. Clearing all three fields returns the row
// to exactly the state it had before, which is what NULL already means everywhere else.
async function restoreLeakage(req, res) {
  try {
    const invoice = await Invoice.findByPk(req.params.invoiceId)
    if (!invoice) return notFound(res, 'No invoice with this id.')
    if (!invoice.leakage_dismissed_at) {
      return error(res, 'This leakage row is not dismissed.', 'LEAKAGE_NOT_DISMISSED', 409)
    }

    await invoice.update({
      leakage_dismissed_at: null,
      leakage_dismissed_reason: null,
      leakage_dismissed_by: null,
    })

    return success(res, { invoice_id: invoice.id, dismissed_at: null })
  } catch (err) {
    return internalError(res, err)
  }
}

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
        recorded_at: { [Op.between]: [sgDayStart(from), sgDayEnd(to)] },
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
    if (granularity === 'week') from.setUTCDate(from.getUTCDate() - 7 * 12)
    else from.setUTCMonth(from.getUTCMonth() - 12)

    const invoices = await Invoice.findAll({
      where: { status: 'synced_to_xero', createdAt: { [Op.gte]: from } },
      attributes: ['total_amount', 'createdAt'],
    })

    const bucketKey = (date) => {
      const d = new Date(date)
      if (granularity === 'week') {
        const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)))
        return toDateOnly(monday)
      }
      return d.toISOString().slice(0, 7) // YYYY-MM, already UTC
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
// revenue, with each client's invoiced booking count shown alongside (not total
// booking volume - a cancelled/never-invoiced booking would skew revenue-per-booking).
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

    const topFive = [...byClient.values()]
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, 5)

    const topFiveIds = topFive.map((c) => c.client_id)
    const bookingCounts = topFiveIds.length
      ? await Booking.findAll({
          where: { client_id: { [Op.in]: topFiveIds }, status: 'invoiced' },
          attributes: ['client_id'],
        })
      : []
    const bookingCountByClient = new Map()
    for (const b of bookingCounts) {
      bookingCountByClient.set(b.client_id, (bookingCountByClient.get(b.client_id) || 0) + 1)
    }

    const topClientsList = topFive.map((c) => ({
      client_id: c.client_id,
      client_name: c.client_name,
      total_revenue: c.total_revenue.toFixed(2),
      invoice_count: c.invoice_count,
      booking_count: bookingCountByClient.get(c.client_id) || 0,
    }))

    return success(res, { top_clients: topClientsList })
  } catch (err) {
    return internalError(res, err)
  }
}

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
      where: { created_at: { [Op.between]: [sgDayStart(from), sgDayEnd(to)] } },
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
      where: { created_at: { [Op.between]: [sgDayStart(from), sgDayEnd(to)] } },
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

// Live Fleet Tracker: one row per field crew member, with a status derived from their
// current job (if any) and a simulated position. Positions "jump" between pickup,
// midpoint, and destination as milestones are tapped, rather than animating on a
// fabricated timer - the pin only moves when a real JobMilestone event says it should.
async function crewPositions(req, res) {
  try {
    const crew = await User.findAll({
      where: { role: 'field_crew' },
      attributes: ['id', 'name', 'last_active_at'],
      order: [['name', 'ASC']],
    })
    const crewIds = crew.map((c) => c.id)

    const activeBookings = crewIds.length
      ? await Booking.findAll({
          where: { assigned_crew_id: { [Op.in]: crewIds }, status: 'in_progress' },
          attributes: ['id', 'assigned_crew_id', 'reference_number', 'pickup_location', 'destination'],
        })
      : []
    const bookingByCrewId = new Map(activeBookings.map((b) => [b.assigned_crew_id, b]))

    const milestoneRows = activeBookings.length
      ? await JobMilestone.findAll({
          where: { booking_id: { [Op.in]: activeBookings.map((b) => b.id) } },
          attributes: ['booking_id', 'milestone_type'],
        })
      : []
    const milestonesByBooking = new Map()
    milestoneRows.forEach((m) => {
      if (!milestonesByBooking.has(m.booking_id)) milestonesByBooking.set(m.booking_id, new Set())
      milestonesByBooking.get(m.booking_id).add(m.milestone_type)
    })

    function latestStage(bookingId) {
      const recorded = milestonesByBooking.get(bookingId) || new Set()
      for (let i = MILESTONE_SEQUENCE.length - 1; i >= 0; i--) {
        if (recorded.has(MILESTONE_SEQUENCE[i])) return MILESTONE_SEQUENCE[i]
      }
      return null
    }

    // 'arrived_at_location' = at pickup (on scene collecting the patient); 'en_route' =
    // between pickup and destination; 'arrived_at_destination'/'job_completed' = at
    // destination. 'activated' (or no milestone yet, which shouldn't happen once a
    // booking is in_progress) means still heading to pickup.
    async function computeJobPosition(booking) {
      const stage = latestStage(booking.id)

      if (stage === 'arrived_at_location') {
        return { status: 'on_scene', position: await geocodingService.geocodeAddress(booking.pickup_location) }
      }
      if (stage === 'en_route') {
        const [pickup, destination] = await Promise.all([
          geocodingService.geocodeAddress(booking.pickup_location),
          geocodingService.geocodeAddress(booking.destination),
        ])
        return {
          status: 'en_route',
          position: { lat: jitter((pickup.lat + destination.lat) / 2), lng: jitter((pickup.lng + destination.lng) / 2) },
        }
      }
      if (stage === 'arrived_at_destination' || stage === 'job_completed') {
        return { status: 'on_scene', position: await geocodingService.geocodeAddress(booking.destination) }
      }
      return { status: 'en_route', position: await geocodingService.geocodeAddress(booking.pickup_location) }
    }

    const now = new Date()
    const results = await Promise.all(crew.map(async (member) => {
      const booking = bookingByCrewId.get(member.id)

      if (!booking) {
        const hq = await geocodingService.geocodeAddress(geocodingService.HQ_ADDRESS)
        const offset = hqOffset(member.id)
        return {
          id: member.id,
          name: member.name,
          status: isOnline(member.last_active_at) ? 'available' : 'off_duty',
          position: { lat: hq.lat + offset.lat, lng: hq.lng + offset.lng },
          current_job_reference: null,
          last_updated: now,
        }
      }

      const { status, position } = await computeJobPosition(booking)
      return {
        id: member.id,
        name: member.name,
        status,
        position,
        current_job_reference: booking.reference_number,
        last_updated: now,
      }
    }))

    return success(res, results)
  } catch (err) {
    return internalError(res, err)
  }
}

module.exports = { fleetOverview, vendorExpenses, revenueLeakage, dismissLeakage, restoreLeakage, cycleTime, xeroHealth, revenueTrend, topClients, revenueByServiceType, leakageHistory, crewPositions }
