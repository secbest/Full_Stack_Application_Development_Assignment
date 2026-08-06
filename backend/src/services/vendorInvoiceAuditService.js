const { VendorInvoiceAudit } = require('../models')

function comparable(value) {
  if (value === undefined) return null
  if (value === null) return null
  if (value instanceof Date) return value.toISOString()
  return typeof value === 'object' && typeof value.toJSON === 'function' ? value.toJSON() : value
}

function diff(before, after, fields) {
  return fields.reduce((changes, field) => {
    const from = comparable(before[field])
    const to = comparable(after[field])
    if (String(from) !== String(to)) changes[field] = { from, to }
    return changes
  }, {})
}

async function record({ invoiceId, userId = null, action, changes = {}, note = null, transaction }) {
  return VendorInvoiceAudit.create({
    vendor_invoice_id: invoiceId,
    user_id: userId,
    action,
    changes,
    note,
  }, { transaction })
}

module.exports = { diff, record }
