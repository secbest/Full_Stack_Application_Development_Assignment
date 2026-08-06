const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// In-app notification record. Inserted by controllers across all feature areas via
// the shared notificationService helper - never written directly.
// link holds the frontend route to navigate to when the notification is clicked.
const Notification = sequelize.define('Notification', {
  id:      { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
  type: {
    type: DataTypes.ENUM(
      'new_intake_submission',
      'memo_submitted',
      'memo_returned',
      'job_assigned',
      'xero_sync_failed',
      'ocr_low_confidence'
    ),
    allowNull: false,
  },
  title:   { type: DataTypes.STRING(255), allowNull: false },
  body:    { type: DataTypes.TEXT,        allowNull: true },
  link:    { type: DataTypes.STRING(255), allowNull: true },
  is_read: { type: DataTypes.BOOLEAN,    allowNull: false, defaultValue: false },
}, {
  tableName: 'notifications',
  underscored: true,
})

module.exports = Notification
