const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// One row per OCR-extracted line item on a vendor invoice.
// Deleted automatically when the parent VendorInvoice is deleted (CASCADE).
// AP Specialist can correct individual fields during review; updated_at tracks the last edit.
const VendorInvoiceItem = sequelize.define('VendorInvoiceItem', {
  id:                { type: DataTypes.INTEGER,      primaryKey: true, autoIncrement: true },
  vendor_invoice_id: { type: DataTypes.INTEGER,      allowNull: false, references: { model: 'vendor_invoices', key: 'id' } },
  description:       { type: DataTypes.STRING(500),  allowNull: false },
  quantity:          { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 1.00 },
  unit_price:        { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  amount:            { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, {
  tableName: 'vendor_invoice_items',
  underscored: true,
})

module.exports = VendorInvoiceItem
