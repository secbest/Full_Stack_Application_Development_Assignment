const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// One row per surcharge type. The pricing engine reads these and applies applicable
// surcharges on top of the base rate from pricing_rates.
//
// contract_id NULL marks a GLOBAL DEFAULT row - EFAR's published rate card. Surcharges
// (oxygen, resuscitation, suction, waiting time, heavy lifting, Jurong Island) are
// published rates that do not vary by client; only the base transport rates in
// pricing_rates are negotiated per contract. Without these defaults, any booking priced
// by one-off quotation had no surcharge schedule at all, so every charge the crew
// recorded came back unpriced and every invoice carried a warning.
//
// Resolution order is contract row -> global default -> unpriced; see
// services/surchargeScheduleService.js. Contract rows therefore act as per-client
// OVERRIDES of the published rate, which is what a negotiated schedule actually is.
const SurchargeSchedule = sequelize.define('SurchargeSchedule', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contract_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'pricing_contracts', key: 'id' } },
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
