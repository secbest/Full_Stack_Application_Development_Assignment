const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// Single-row config table - only one Xero org is connected at a time.
// access_token and refresh_token are AES-256-GCM encrypted BEFORE being saved here.
// token_expiry lets the sync service refresh proactively instead of waiting for a 401.
const XeroConnection = sequelize.define('XeroConnection', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  xero_tenant_id: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  xero_org_name:  { type: DataTypes.STRING(255), allowNull: false },
  access_token:   { type: DataTypes.TEXT,        allowNull: false },
  refresh_token:  { type: DataTypes.TEXT,        allowNull: false },
  token_expiry:   { type: DataTypes.DATE,        allowNull: false },
  is_connected:   { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: true },
  connected_at:   { type: DataTypes.DATE,        allowNull: false },
}, {
  tableName: 'xero_connections',
  underscored: true,
})

module.exports = XeroConnection
