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

  // What KIND of charge this row is, which is not derivable from is_manual_adjustment.
  //
  //   base       - the transport charge from a pricing rate or a frozen quotation.
  //                Exactly one per priced invoice, and the bulk of the money.
  //   surcharge  - an engine-priced extra (oxygen, resuscitation, waiting time...).
  //   adjustment - added by hand by the AR Specialist.
  //
  // This exists because an invoice can legitimately carry engine-priced surcharges while
  // its base is still unknown (quotation mismatch, missing contract or missing rate). Once
  // a manual adjustment flips such an invoice out of `unmatched`, nothing else in the row
  // data distinguishes "priced in full" from "priced except for the transport charge" -
  // and invoices did reach Xero billed for a $20 surcharge with the base silently absent.
  // The approval guard in invoiceController reads this column.
  line_type: {
    type: DataTypes.ENUM('base', 'surcharge', 'adjustment'),
    allowNull: false,
    defaultValue: 'adjustment',
  },

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
