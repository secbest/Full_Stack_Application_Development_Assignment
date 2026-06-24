const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// One active contract per client at a time (enforced at application layer, not DB).
// Acts as the header that groups a client's pricing_rates and surcharge_schedules.
const PricingContract = sequelize.define('PricingContract', {
  id:            { type: DataTypes.INTEGER,     primaryKey: true, autoIncrement: true },
  client_id:     { type: DataTypes.INTEGER,     allowNull: false, references: { model: 'clients', key: 'id' } },
  created_by:    { type: DataTypes.INTEGER,     allowNull: false, references: { model: 'users', key: 'id' } },
  contract_name: { type: DataTypes.STRING(255), allowNull: false },
  effective_from: { type: DataTypes.DATEONLY,   allowNull: false },
  effective_to:   { type: DataTypes.DATEONLY,   allowNull: false },
  is_active:     { type: DataTypes.BOOLEAN,     allowNull: false, defaultValue: true },
}, {
  tableName: 'pricing_contracts',
  underscored: true,
})

module.exports = PricingContract
