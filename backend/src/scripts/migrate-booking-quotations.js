// Adds the immutable quotation snapshot passed from Quotations to AR.
// Idempotent and non-destructive: existing bookings remain nullable legacy rows.
require('dotenv').config()
const { DataTypes } = require('sequelize')
const sequelize = require('../config')

async function addColumnIfMissing(queryInterface, columns, name, definition) {
  if (columns[name]) return false
  await queryInterface.addColumn('bookings', name, definition)
  return true
}

async function main() {
  try {
    await sequelize.authenticate()
    const queryInterface = sequelize.getQueryInterface()
    const columns = await queryInterface.describeTable('bookings')
    const added = []
    const definitions = {
      pricing_source: { type: DataTypes.STRING(30), allowNull: true },
      pricing_contract_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'pricing_contracts', key: 'id' } },
      quoted_base_amount: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      quoted_transfer_type: { type: DataTypes.STRING(50), allowNull: true },
      quoted_time_of_day: { type: DataTypes.STRING(30), allowNull: true },
      quoted_by: { type: DataTypes.INTEGER, allowNull: true, references: { model: 'users', key: 'id' } },
      quoted_at: { type: DataTypes.DATE, allowNull: true },
    }
    for (const [name, definition] of Object.entries(definitions)) {
      if (await addColumnIfMissing(queryInterface, columns, name, definition)) added.push(name)
    }
    console.log(added.length
      ? `[migrate-booking-quotations] Added: ${added.join(', ')}`
      : '[migrate-booking-quotations] Booking quotation columns already exist.')
  } catch (err) {
    console.error('[migrate-booking-quotations] Failed:', err.message)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}

main()
