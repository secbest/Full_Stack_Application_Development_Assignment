const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// Central job record created when a Quotations Specialist confirms an intake submission.
// Links intake → crew → service memo → invoice.
// Status is updated by multiple team members:
//   confirmed     → Quotations Specialist (Zheng Bao)
//   in_progress   → field crew activation (Liang Yi)
//   completed     → field memo submission (Liang Yi)
//   invoiced      → successful Xero sync (Jasper)
const Booking = sequelize.define('Booking', {
  id:                  { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  reference_number:    { type: DataTypes.STRING(20), allowNull: false, unique: true },
  intake_submission_id: { type: DataTypes.INTEGER, allowNull: true,  references: { model: 'intake_submissions', key: 'id' } },
  client_id:           { type: DataTypes.INTEGER, allowNull: false,  references: { model: 'clients', key: 'id' } },
  created_by:          { type: DataTypes.INTEGER, allowNull: false,  references: { model: 'users', key: 'id' } },
  assigned_crew_id:    { type: DataTypes.INTEGER, allowNull: true,   references: { model: 'users', key: 'id' } },
  service_type: {
    type: DataTypes.ENUM('eas', 'mts', 'event_standby', 'workplace_standby'),
    allowNull: false,
  },
  service_tier: {
    type: DataTypes.ENUM('basic', 'advanced', 'critical'),
    allowNull: false,
  },
  original_service_tier: {
    type: DataTypes.ENUM('basic', 'advanced', 'critical'),
    allowNull: true,
  },
  // Pricing agreed by Quotations when the booking is confirmed. The amount is frozen
  // even for contract pricing so a later contract edit cannot rewrite what was quoted.
  // Nullable for legacy/seed bookings created before this cross-role handoff existed.
  pricing_source:      { type: DataTypes.STRING(30), allowNull: true }, // contract | one_off_quote
  pricing_contract_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'pricing_contracts', key: 'id' } },
  quoted_base_amount:  { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  quoted_transfer_type:{ type: DataTypes.STRING(50), allowNull: true },
  quoted_time_of_day:  { type: DataTypes.STRING(30), allowNull: true },
  quoted_by:           { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
  quoted_at:           { type: DataTypes.DATE, allowNull: true },
  scheduled_date:  { type: DataTypes.DATEONLY,    allowNull: false },
  scheduled_time:  { type: DataTypes.STRING(10),  allowNull: false },   // stored as "HH:MM"
  pickup_location: { type: DataTypes.TEXT,        allowNull: false },
  destination:     { type: DataTypes.TEXT,        allowNull: false },
  status: {
    type: DataTypes.ENUM('confirmed', 'in_progress', 'completed', 'invoiced'),
    allowNull: false,
    defaultValue: 'confirmed',
  },
  notes:                    { type: DataTypes.TEXT, allowNull: true },
  leakage_dismissed_at:     { type: DataTypes.DATE, allowNull: true },
  leakage_dismissed_reason: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'bookings',
  underscored: true,
})

module.exports = Booking
