const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// One memo per booking (unique on booking_id). Written to DB only on final submission -
// drafts live in browser localStorage and are never partially persisted.
// The pricing engine fields (service_type through is_jurong_island) are required by
// Jasper's AR engine for invoice calculation - all must be non-null before status can advance.
const ServiceMemo = sequelize.define('ServiceMemo', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  booking_id:   { type: DataTypes.INTEGER, allowNull: false, unique: true, references: { model: 'bookings', key: 'id' } },
  submitted_by: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  reviewed_by:  { type: DataTypes.INTEGER, allowNull: true,  references: { model: 'users', key: 'id' } },

  // Job timeline
  job_start_time: { type: DataTypes.DATE, allowNull: false },
  job_end_time:   { type: DataTypes.DATE, allowNull: false },
  overtime_hours: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0.00 },
  evacuation_floors: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },

  // Patient details
  patient_name:         { type: DataTypes.STRING(255), allowNull: false },
  hospital_destination: { type: DataTypes.STRING(255), allowNull: false },
  additional_charges_notes:  { type: DataTypes.TEXT,        allowNull: true },
  hospital_stamp_image_url:  { type: DataTypes.STRING(512), allowNull: true },

  // Pricing engine fields - ENUM values match pricing_rates/surcharge_schedules exactly
  service_type: {
    type: DataTypes.ENUM('eas', 'mts', 'event_standby', 'workplace_standby'),
    allowNull: false,
  },
  transfer_type: {
    type: DataTypes.ENUM(
      'one_way_hospital', 'two_way_hospital', 'covid_19', 'imh_psychiatric',
      'airport_no_tarmac', 'airport_with_tarmac', 'sg_jb_ground', 'air_evacuation'
    ),
    allowNull: false,
  },
  is_office_hours:         { type: DataTypes.BOOLEAN,      allowNull: false },
  oxygen_litres_used:      { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0.00 },
  has_inconvenience_fee:   { type: DataTypes.BOOLEAN,      allowNull: false, defaultValue: false },
  disposables_used:        { type: DataTypes.BOOLEAN,      allowNull: false, defaultValue: false },
  resuscitation_performed: { type: DataTypes.BOOLEAN,      allowNull: false, defaultValue: false },
  suction_performed:       { type: DataTypes.BOOLEAN,      allowNull: false, defaultValue: false },
  waiting_time_minutes:    { type: DataTypes.INTEGER,      allowNull: false, defaultValue: 0 },
  patient_weight_kg:       { type: DataTypes.DECIMAL(5, 1), allowNull: true },
  is_jurong_island:        { type: DataTypes.BOOLEAN,      allowNull: false, defaultValue: false },

  status: {
    type: DataTypes.ENUM('submitted', 'reviewed', 'invoiced'),
    allowNull: false,
    defaultValue: 'submitted',
  },

  // Written only by the AR review endpoints (Jasper's Wave 3): the correction note
  // left when a memo is returned to the field crew. Surfaced in the crew's Memo History.
  ar_note: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: 'service_memos',
  underscored: true,
})

module.exports = ServiceMemo
