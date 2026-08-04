const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// One row per surcharge type within a contract. The pricing engine reads these
// and applies applicable surcharges on top of the base rate from pricing_rates.
const SurchargeSchedule = sequelize.define('SurchargeSchedule', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contract_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'pricing_contracts', key: 'id' } },
  surcharge_type: {
    type: DataTypes.ENUM(
      'oxygen_base', 'oxygen_per_litre', 'inconvenience_fee', 'disposables_base',
      'resuscitation', 'suction', 'waiting_time_per_30min',
      'heavy_lifting_min', 'heavy_lifting_max',
      'jurong_island_min', 'jurong_island_max',
      'overtime_per_hour',
      'cancellation'
    ),
    allowNull: false,
  },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
}, {
  tableName: 'surcharge_schedules',
  underscored: true,
})

module.exports = SurchargeSchedule
