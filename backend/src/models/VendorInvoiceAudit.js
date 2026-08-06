const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// Append-only AP history. `changes` stores field-level before/after values while `note`
// captures a human-readable outcome (for example a Xero error). Keeping this separate
// from updated_at means corrections and status transitions remain reconstructable.
const VendorInvoiceAudit = sequelize.define('VendorInvoiceAudit', {
  id:                { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  vendor_invoice_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'vendor_invoices', key: 'id' } },
  user_id:           { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
  action:            { type: DataTypes.STRING(50), allowNull: false },
  changes:           { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  note:              { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'vendor_invoice_audits',
  underscored: true,
  updatedAt: false,
  indexes: [{ fields: ['vendor_invoice_id', 'created_at'] }],
})

module.exports = VendorInvoiceAudit
