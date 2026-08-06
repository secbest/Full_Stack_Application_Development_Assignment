const { Op } = require('sequelize')
const { Booking, ServiceMemo, Invoice, VendorInvoice, PricingContract, SurchargeSchedule, Client } = require('../models')
const { leakageService } = require('../services')
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
// number that actually reflects what AP signed off on. Gross expenditure and net payable
// are accumulated separately so the rebate is never deducted from verified_total twice.
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
    where: { created_at: { [Op.between]: [new Date(from), new Date(`${to}T23:59:59.999Z`)] } },
    include: [
      { model: Client, attributes: ['id', 'name'], required: false },
      { model: PricingContract, attributes: ['id', 'contract_name'], required: false },
    ],
  })

  // Reference rates come from every surcharge row in the system: if any contract prices
  // oxygen_per_litre, that is a defensible basis for valuing a contract that does not.
  const surchargeRows = await SurchargeSchedule.findAll({ attributes: ['surcharge_type', 'amount'] })

  const rows = invoices.map((inv) => ({
    id: inv.id,
    client_id: inv.client_id,
    client_name: inv.Client ? inv.Client.name : null,
    contract_id: inv.contract_id,
    contract_name: inv.PricingContract ? inv.PricingContract.contract_name : null,
    created_at: inv.createdAt,
    unpriced_surcharges: inv.unpriced_surcharges || [],
  }))

  const report = leakageService.buildLeakageReport(rows, surchargeRows)

  return success(res, {
    period: { from, to },
    ...report,
    // Stated in the payload so the UI cannot present an estimate as a billed figure.
    basis_note: 'Amounts are estimates. Unpriced surcharges have no contracted rate by definition, so each is valued at the median rate other contracts charge for the same surcharge type. Items with no reference rate anywhere in the system are counted but valued at zero.',
  })
}

module.exports = { fleetOverview, vendorExpenses, revenueLeakage }
