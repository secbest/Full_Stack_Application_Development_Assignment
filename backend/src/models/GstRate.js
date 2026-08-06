const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// Effective-dated Singapore GST configuration. Rows are append-only in normal use:
// when the law changes, add a new period instead of editing the old rate. Invoices keep
// their own snapshot as well, so historical totals never move with this table.
const GstRate = sequelize.define('GstRate', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  jurisdiction:   { type: DataTypes.STRING(2), allowNull: false, defaultValue: 'SG' },
  rate_percent:   { type: DataTypes.DECIMAL(5, 2), allowNull: false },
  effective_from: { type: DataTypes.DATEONLY, allowNull: false },
  effective_to:   { type: DataTypes.DATEONLY, allowNull: true },
  xero_tax_type:  { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'OUTPUT' },
  xero_input_tax_type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'INPUT' },
  source_name:    { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'IRAS' },
  source_url:     { type: DataTypes.STRING(500), allowNull: false },
  verified_at:    { type: DataTypes.DATE, allowNull: false },
  is_active:      { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: 'gst_rates',
  underscored: true,
  indexes: [
    { unique: true, fields: ['jurisdiction', 'effective_from'] },
    { fields: ['jurisdiction', 'is_active', 'effective_from', 'effective_to'] },
  ],
})

module.exports = GstRate
