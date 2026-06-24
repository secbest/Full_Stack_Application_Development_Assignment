const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// Shared group table - represents a corporate client that books EFAR services.
// Referenced by bookings, pricing_contracts, and invoices.
// A Client record is looked up or created when a Quotations Specialist confirms an intake.
const Client = sequelize.define('Client', {
  id:            { type: DataTypes.INTEGER,     primaryKey: true, autoIncrement: true },
  name:          { type: DataTypes.STRING(255), allowNull: false },
  contact_email: { type: DataTypes.STRING(255), allowNull: false },
  contact_phone: { type: DataTypes.STRING(20),  allowNull: true },
  billing_address: { type: DataTypes.TEXT,      allowNull: true },
}, {
  tableName: 'clients',
  underscored: true,
})

module.exports = Client
