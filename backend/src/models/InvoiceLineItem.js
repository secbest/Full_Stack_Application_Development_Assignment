const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// One row per charge on an invoice. Auto-generated rows come from the pricing engine;
// is_manual_adjustment = true marks rows added manually by the AR Specialist.
const InvoiceLineItem = sequelize.define('InvoiceLineItem', {
  id:         { type: DataTypes.INTEGER,      primaryKey: true, autoIncrement: true },
  invoice_id: { type: DataTypes.INTEGER,      allowNull: false, references: { model: 'invoices', key: 'id' } },
  description: { type: DataTypes.STRING(255), allowNull: false },
  quantity:    { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 1.00 },
  unit_price:  { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  amount:      { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  is_manual_adjustment: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },

  // Provenance. is_manual_adjustment alone can't tell "the engine calculated this" from
  // "the engine calculated this and then someone changed the number", and on an invoice
  // that distinction IS the audit trail - a hand-edited figure displayed as engine-derived
  // is a false attribution. Set when an engine-generated row is edited; the original
  // engine figures are retained so the change is reviewable rather than just flagged.
  was_manually_edited: { type: DataTypes.BOOLEAN,        allowNull: false, defaultValue: false },
  engine_unit_price:   { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  engine_amount:       { type: DataTypes.DECIMAL(10, 2), allowNull: true },
}, {
  tableName: 'invoice_line_items',
  underscored: true,
})

module.exports = InvoiceLineItem
