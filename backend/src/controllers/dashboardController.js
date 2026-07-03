const { Op } = require('sequelize')
const { Booking, ServiceMemo, Invoice, VendorInvoice } = require('../models')
const { success } = require('../utils')

const BOOKING_STATUSES = ['confirmed', 'in_progress', 'completed', 'invoiced']

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10)
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
// number that actually reflects what AP signed off on.
async function vendorExpenses(req, res) {
  const { date_from, date_to, vendor_name } = req.query
  const from = date_from || `${new Date().getFullYear()}-01-01`
  const to = date_to || toDateOnly(new Date())

  const where = {
    status: { [Op.in]: ['approved', 'synced_to_xero'] },
    invoice_date: { [Op.between]: [from, to] },
  }
  if (vendor_name) where.vendor_name = { [Op.iLike]: `%${vendor_name}%` }

  const invoices = await VendorInvoice.findAll({ where })
  const amountOf = (inv) => Number(inv.verified_total ?? inv.extracted_total ?? 0)
  const rebateOf = (inv) => Number(inv.rebate_amount ?? 0)
  const money = (n) => n.toFixed(2)

  const summary = invoices.reduce(
    (acc, inv) => {
      acc.total_expenditure += amountOf(inv)
      acc.total_rebates_applied += rebateOf(inv)
      acc.invoice_count += 1
      return acc
    },
    { total_expenditure: 0, total_rebates_applied: 0, invoice_count: 0 }
  )

  const byVendorMap = new Map()
  const monthlyMap = new Map()
  for (const inv of invoices) {
    const amount = amountOf(inv)
    const rebate = rebateOf(inv)

    const vendorEntry = byVendorMap.get(inv.vendor_name) || {
      vendor_name: inv.vendor_name, total_expenditure: 0, total_rebates: 0, invoice_count: 0,
    }
    vendorEntry.total_expenditure += amount
    vendorEntry.total_rebates += rebate
    vendorEntry.invoice_count += 1
    byVendorMap.set(inv.vendor_name, vendorEntry)

    const month = (inv.invoice_date || '').slice(0, 7)
    if (month) {
      const monthEntry = monthlyMap.get(month) || { month, total_expenditure: 0, net_payable: 0 }
      monthEntry.total_expenditure += amount
      monthEntry.net_payable += amount - rebate
      monthlyMap.set(month, monthEntry)
    }
  }

  return success(res, {
    period: { from, to },
    summary: {
      total_expenditure: money(summary.total_expenditure),
      total_rebates_applied: money(summary.total_rebates_applied),
      net_payable: money(summary.total_expenditure - summary.total_rebates_applied),
      invoice_count: summary.invoice_count,
    },
    by_vendor: [...byVendorMap.values()]
      .sort((a, b) => b.total_expenditure - a.total_expenditure) // largest cost contributor first, per the doc
      .map((v) => ({
        vendor_name: v.vendor_name,
        total_expenditure: money(v.total_expenditure),
        total_rebates: money(v.total_rebates),
        net_payable: money(v.total_expenditure - v.total_rebates),
        invoice_count: v.invoice_count,
      })),
    monthly_trend: [...monthlyMap.values()]
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((m) => ({ month: m.month, total_expenditure: money(m.total_expenditure), net_payable: money(m.net_payable) })),
  })
}

module.exports = { fleetOverview, vendorExpenses }
