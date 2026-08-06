const { Op } = require('sequelize')
const { GstRate } = require('../models')

const GST_JURISDICTION = 'SG'

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

function toDateOnly(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10)
  const text = String(value || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00.000Z`))) {
    const err = new Error('A valid tax date is required to determine the applicable GST rate.')
    err.code = 'INVALID_GST_DATE'
    throw err
  }
  return text
}

async function findApplicableRate(taxDate, { transaction } = {}) {
  const date = toDateOnly(taxDate)
  const rate = await GstRate.findOne({
    where: {
      jurisdiction: GST_JURISDICTION,
      is_active: true,
      effective_from: { [Op.lte]: date },
      [Op.or]: [
        { effective_to: null },
        { effective_to: { [Op.gte]: date } },
      ],
    },
    order: [['effective_from', 'DESC']],
    transaction,
  })

  if (!rate) {
    const err = new Error(`No verified Singapore GST rate is configured for ${date}. Billing has been stopped to avoid issuing an invoice with the wrong tax.`)
    err.code = 'GST_RATE_NOT_CONFIGURED'
    throw err
  }
  return rate
}

async function buildSnapshot(taxDate, options = {}) {
  const date = toDateOnly(taxDate)
  const rate = await findApplicableRate(date, options)
  return {
    gst_rate_id: rate.id,
    gst_rate_percent: Number(rate.rate_percent),
    gst_effective_date: date,
    xero_tax_type: rate.xero_tax_type,
  }
}

// Xero calculates exclusive tax per line. Mirroring that rounding here prevents a one-cent
// drift between EFAR and Xero on invoices containing several fractional-value rows.
function calculateTaxForLineItems(lineItems, ratePercent) {
  const rate = Number(ratePercent)
  if (!Number.isFinite(rate) || rate < 0) throw new Error('A valid GST percentage is required.')
  return round2((lineItems || []).reduce(
    (sum, item) => sum + round2(Number(item.amount || 0) * rate / 100),
    0
  ))
}

function calculateTotals(lineItems, ratePercent) {
  const subtotal = round2((lineItems || []).reduce((sum, item) => sum + Number(item.amount || 0), 0))
  const tax_amount = calculateTaxForLineItems(lineItems, ratePercent)
  return { subtotal, tax_amount, total_amount: round2(subtotal + tax_amount) }
}

module.exports = {
  GST_JURISDICTION,
  toDateOnly,
  findApplicableRate,
  buildSnapshot,
  calculateTaxForLineItems,
  calculateTotals,
}
