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

  // The verifiable checks behind is_low_confidence: [{ check, passed, detail }].
  // is_low_confidence used to rest solely on a confidence score the model reported about
  // itself, which told the AP Specialist a number but never a reason. These are arithmetic
  // and format facts (do the line items sum to the stated total, does each line's amount
  // match quantity x unit price, is there a usable date) so the review screen can show
  // WHY an invoice needs a closer look. Written by ocrService.reconcile().
  extraction_checks: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },

  // Sum of the extracted line items at extraction time, and its distance from the total
  // printed on the invoice. Persisted so the discrepancy survives into the review panel
  // instead of being recomputed (and possibly disagreeing) on every read.
  extracted_items_sum:  { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  reconciliation_delta: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
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
