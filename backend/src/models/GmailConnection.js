const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// One Gmail inbox is used for AP intake. Only the encrypted refresh token is kept;
// short-lived Gmail access tokens are requested when an import runs.
const GmailConnection = sequelize.define('GmailConnection', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  gmail_address: { type: DataTypes.STRING(320), allowNull: false, unique: true },
  refresh_token: { type: DataTypes.TEXT, allowNull: false },
  is_connected: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  connected_at: { type: DataTypes.DATE, allowNull: false },
  connected_by: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
}, { tableName: 'gmail_connections', underscored: true })

module.exports = GmailConnection
