const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// Raw customer request from the public intake portal. Stays in 'pending' until
// a Quotations Specialist confirms (creates a Booking) or rejects it.
// reference_number (e.g. EFAR-2026-00001) is shown to the customer as their confirmation code.
const IntakeSubmission = sequelize.define('IntakeSubmission', {
  id:               { type: DataTypes.INTEGER,     primaryKey: true, autoIncrement: true },
  reference_number: { type: DataTypes.STRING(20),  allowNull: false, unique: true },
  customer_name:    { type: DataTypes.STRING(255), allowNull: false },
  organisation:     { type: DataTypes.STRING(255), allowNull: true },
  contact_email:    { type: DataTypes.STRING(255), allowNull: false },
  contact_phone:    { type: DataTypes.STRING(20),  allowNull: false },
  service_type: {
    type: DataTypes.ENUM('eas', 'mts', 'event_standby', 'workplace_standby'),
    allowNull: false,
  },
  service_tier: {
    type: DataTypes.ENUM('basic', 'advanced', 'critical'),
    // Customers no longer choose this. Quotations assigns the tier when confirming.
    allowNull: true,
  },
  preferred_date:   { type: DataTypes.DATEONLY, allowNull: false },
  preferred_time:   { type: DataTypes.STRING(10), allowNull: false },   // stored as "HH:MM"
  pickup_location:  { type: DataTypes.TEXT, allowNull: false },
  destination:      { type: DataTypes.TEXT, allowNull: false },
  additional_notes: { type: DataTypes.TEXT, allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
  },
  rejection_reason: { type: DataTypes.TEXT,    allowNull: true },
  reviewed_by:      { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
  reviewed_at:      { type: DataTypes.DATE,    allowNull: true },
}, {
  tableName: 'intake_submissions',
  underscored: true,
})

module.exports = IntakeSubmission
