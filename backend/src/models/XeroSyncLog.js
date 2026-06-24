const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// Polymorphic audit log for every Xero sync attempt across both AR and AP flows.
// entity_type + entity_id together identify which record was being synced.
// No database-level FK on entity_id - the combination (entity_type, entity_id) is the logical key.
// attempt_count >= 3 disables the retry button in the UI ("Contact Support").
const XeroSyncLog = sequelize.define('XeroSyncLog', {
  id:             { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  entity_type: {
    type: DataTypes.ENUM('ar_invoice', 'vendor_invoice', 'bank_feed'),
    allowNull: false,
  },
  entity_id:      { type: DataTypes.INTEGER, allowNull: false },
  xero_record_id: { type: DataTypes.STRING(255), allowNull: true },
  status: {
    type: DataTypes.ENUM('pending', 'success', 'failed'),
    allowNull: false,
    defaultValue: 'pending',
  },
  attempt_count:  { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  error_message:  { type: DataTypes.TEXT,    allowNull: true },
  synced_at:      { type: DataTypes.DATE,    allowNull: true },
}, {
  tableName: 'xero_sync_logs',
  underscored: true,
})

module.exports = XeroSyncLog
