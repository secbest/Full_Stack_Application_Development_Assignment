const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// AP lifecycle record. Created when an AP Specialist uploads a vendor PDF.
// Unique composite index on (vendor_name, invoice_number) prevents duplicate uploads.
// extraction_confidence below 0.80 sets is_low_confidence = true and flags for manual review.
// rebate_amount and verified_total are calculated server-side: never trusted from the client.
const VendorInvoice = sequelize.define('VendorInvoice', {
  id:                   { type: DataTypes.INTEGER,     primaryKey: true, autoIncrement: true },
  uploaded_by:          { type: DataTypes.INTEGER,     allowNull: false, references: { model: 'users', key: 'id' } },
  approved_by:          { type: DataTypes.INTEGER,     allowNull: true,  references: { model: 'users', key: 'id' } },
  vendor_name:          { type: DataTypes.STRING(255), allowNull: false },
  invoice_number:       { type: DataTypes.STRING(100), allowNull: false },
  invoice_date:         { type: DataTypes.DATEONLY,    allowNull: true },
  pdf_url:              { type: DataTypes.STRING(512), allowNull: false },
  extracted_total:      { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  rebate_percentage:    { type: DataTypes.DECIMAL(5, 2),  allowNull: false, defaultValue: 1.00 },
  rebate_amount:        { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  verified_total:       { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  extraction_confidence: { type: DataTypes.FLOAT,      allowNull: true },
  is_low_confidence:    { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: false },
  status: {
    type: DataTypes.ENUM('pending_review', 'extraction_failed', 'approved', 'rejected', 'synced_to_xero', 'failed'),
    allowNull: false,
    defaultValue: 'pending_review',
  },
  xero_bill_id:      { type: DataTypes.STRING(255), allowNull: true },
  rejection_reason:  { type: DataTypes.TEXT,        allowNull: true },
  approved_at:       { type: DataTypes.DATE,        allowNull: true },
}, {
  tableName: 'vendor_invoices',
  underscored: true,
  indexes: [
    { unique: true, fields: ['vendor_name', 'invoice_number'] },
  ],
})

module.exports = VendorInvoice
