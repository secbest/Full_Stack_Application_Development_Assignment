const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// One row per (service_type, transfer_type, time_of_day) combination within a contract.
// The pricing engine looks up exactly one matching row to determine the invoice base amount.
const PricingRate = sequelize.define('PricingRate', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contract_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'pricing_contracts', key: 'id' } },
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
  time_of_day: {
    type: DataTypes.ENUM('office_hours', 'non_office_hours', 'all_hours'),
    allowNull: false,
  },
  base_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, {
  tableName: 'pricing_rates',
  underscored: true,
})

module.exports = PricingRate
