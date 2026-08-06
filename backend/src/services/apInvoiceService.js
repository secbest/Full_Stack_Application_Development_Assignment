const gstService = require('./gstService')
const { round2 } = require('../utils')

const GST_TREATMENTS = ['standard_rated', 'zero_rated', 'exempt', 'non_gst', 'disallowed']
const ZERO_RATE_TAX_TYPES = {
  zero_rated: 'ZERORATEDINPUT',
  exempt: 'EPINPUT',
  non_gst: 'NRINPUT',
}

function disallowedTaxType(rate) {
  if (Number(rate) === 9) return 'BLINPUT3Y24'
  if (Number(rate) === 8) return 'BLINPUT3Y23'
  return 'BLINPUT3'
}

async function resolveTaxSnapshot(invoiceDate, treatment, options = {}) {
  if (!GST_TREATMENTS.includes(treatment)) {
    const err = new Error('Select a valid GST treatment.')
    err.code = 'INVALID_GST_TREATMENT'
    throw err
  }
  if (treatment === 'standard_rated' || treatment === 'disallowed') {
    const rate = await gstService.findApplicableRate(invoiceDate, options)
    return {
      gst_rate_id: rate.id,
      gst_rate_percent: Number(rate.rate_percent),
      gst_effective_date: gstService.toDateOnly(invoiceDate),
      xero_tax_type: treatment === 'disallowed'
        ? disallowedTaxType(rate.rate_percent)
        : rate.xero_input_tax_type,
    }
  }
  return {
    gst_rate_id: null,
    gst_rate_percent: 0,
    gst_effective_date: invoiceDate ? gstService.toDateOnly(invoiceDate) : null,
    xero_tax_type: ZERO_RATE_TAX_TYPES[treatment],
  }
}

function calculateTax(lineItems, ratePercent) {
  return gstService.calculateTaxForLineItems(lineItems || [], ratePercent || 0)
}

function calculateAmounts({ lineItems = [], subtotal, gstAmount, totalIncludingGst, rebatePercentage = 0 }) {
  const lineSubtotal = round2(lineItems.reduce((sum, item) => sum + Number(item.amount || 0), 0))
  const resolvedSubtotal = subtotal === null || subtotal === undefined ? lineSubtotal : round2(subtotal)
  const resolvedGst = round2(gstAmount || 0)
  const resolvedTotal = totalIncludingGst === null || totalIncludingGst === undefined
    ? round2(resolvedSubtotal + resolvedGst)
    : round2(totalIncludingGst)
  const rebateAmount = round2(resolvedTotal * Number(rebatePercentage || 0) / 100)
  return {
    lineSubtotal,
    subtotal: resolvedSubtotal,
    gstAmount: resolvedGst,
    totalIncludingGst: resolvedTotal,
    rebateAmount,
    verifiedTotal: round2(resolvedTotal - rebateAmount),
  }
}

function issue(code, message) {
  return { code, message }
}

async function validateForApproval(invoice, options = {}) {
  const items = invoice.VendorInvoiceItems || invoice.items || []
  const issues = []
  const required = [
    ['vendor_name', 'Vendor name is required.'],
    ['invoice_number', 'Invoice number is required.'],
    ['invoice_date', 'Invoice date is required.'],
    ['due_date', 'Due date is required.'],
    ['currency_code', 'Currency code is required.'],
    ['xero_account_code', 'Xero expense account code is required.'],
    ['subtotal_excluding_gst', 'Subtotal excluding GST is required.'],
    ['gst_amount', 'GST amount is required.'],
    ['total_including_gst', 'Total including GST is required.'],
    ['verified_total', 'Net payable is required.'],
  ]
  for (const [field, message] of required) {
    if (invoice[field] === null || invoice[field] === undefined || String(invoice[field]).trim() === '') {
      issues.push(issue(`MISSING_${field.toUpperCase()}`, message))
    }
  }
  if (!items.length) issues.push(issue('MISSING_LINE_ITEMS', 'At least one line item is required.'))
  if (invoice.currency_code && invoice.currency_code !== 'SGD') {
    issues.push(issue('UNSUPPORTED_AP_CURRENCY', 'AP GST validation currently supports SGD invoices only. Convert and record the required SGD tax amounts before approving a foreign-currency invoice.'))
  }
  if (invoice.invoice_date && invoice.due_date && String(invoice.due_date) < String(invoice.invoice_date)) {
    issues.push(issue('DUE_DATE_BEFORE_INVOICE', 'Due date cannot be before the invoice date.'))
  }

  let snapshot = null
  if (invoice.invoice_date && GST_TREATMENTS.includes(invoice.gst_treatment)) {
    try {
      snapshot = await resolveTaxSnapshot(invoice.invoice_date, invoice.gst_treatment, options)
      if (Number(invoice.gst_rate_percent) !== Number(snapshot.gst_rate_percent) || invoice.xero_tax_type !== snapshot.xero_tax_type) {
        issues.push(issue('STALE_GST_SNAPSHOT', 'GST rate or Xero tax type does not match the invoice date and selected treatment. Save the invoice again.'))
      }
    } catch (err) {
      issues.push(issue(err.code || 'GST_CONFIGURATION_ERROR', err.message))
    }
  } else if (!GST_TREATMENTS.includes(invoice.gst_treatment)) {
    issues.push(issue('MISSING_GST_TREATMENT', 'GST treatment is required.'))
  }

  if (invoice.gst_treatment === 'standard_rated' && !String(invoice.supplier_gst_registration_no || '').trim()) {
    issues.push(issue('MISSING_SUPPLIER_GST_NUMBER', 'Supplier GST registration number is required for a standard-rated purchase.'))
  }

  if (items.length && invoice.subtotal_excluding_gst !== null && invoice.subtotal_excluding_gst !== undefined) {
    const lineSubtotal = round2(items.reduce((sum, item) => sum + Number(item.amount || 0), 0))
    if (Math.abs(lineSubtotal - Number(invoice.subtotal_excluding_gst)) > 0.01) {
      issues.push(issue('LINE_TOTAL_MISMATCH', `Line items total ${lineSubtotal.toFixed(2)} but the subtotal excluding GST is ${Number(invoice.subtotal_excluding_gst).toFixed(2)}.`))
    }
    const badLine = items.find((item) => Math.abs(round2(Number(item.quantity) * Number(item.unit_price)) - Number(item.amount)) > 0.01)
    if (badLine) issues.push(issue('LINE_ARITHMETIC_MISMATCH', 'One or more line amounts do not equal quantity x unit price.'))
  }

  if (snapshot && invoice.gst_amount !== null && invoice.gst_amount !== undefined) {
    const expectedTax = calculateTax(items, snapshot.gst_rate_percent)
    if (Math.abs(expectedTax - Number(invoice.gst_amount)) > 0.01) {
      issues.push(issue('GST_AMOUNT_MISMATCH', `GST should be ${expectedTax.toFixed(2)} for the current line items and treatment, but the invoice records ${Number(invoice.gst_amount).toFixed(2)}.`))
    }
  }
  if ([invoice.subtotal_excluding_gst, invoice.gst_amount, invoice.total_including_gst].every((v) => v !== null && v !== undefined)) {
    const expectedTotal = round2(Number(invoice.subtotal_excluding_gst) + Number(invoice.gst_amount))
    if (Math.abs(expectedTotal - Number(invoice.total_including_gst)) > 0.01) {
      issues.push(issue('INVOICE_TOTAL_MISMATCH', `Subtotal plus GST is ${expectedTotal.toFixed(2)}, but total including GST is ${Number(invoice.total_including_gst).toFixed(2)}.`))
    }
    const expectedNet = round2(Number(invoice.total_including_gst) - Number(invoice.rebate_amount || 0))
    if (Math.abs(expectedNet - Number(invoice.verified_total)) > 0.01) {
      issues.push(issue('VERIFIED_TOTAL_MISMATCH', `Net payable should be ${expectedNet.toFixed(2)} after rebate.`))
    }
  }

  return {
    can_approve: issues.length === 0,
    issues,
    requires_low_confidence_confirmation: Boolean(invoice.is_low_confidence),
  }
}

module.exports = {
  GST_TREATMENTS,
  resolveTaxSnapshot,
  calculateTax,
  calculateAmounts,
  validateForApproval,
}
