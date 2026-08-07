// Adds the one column needed by automatic AP email intake. This is deliberately a
// narrow, idempotent migration: unlike `db:sync -- alter`, it cannot modify unrelated
// tables while an existing environment is being repaired.
require('dotenv').config()
const { DataTypes } = require('sequelize')
const sequelize = require('../config')

const INDEX_NAME = 'vendor_invoices_inbound_email_id_unique'

async function run() {
  try {
    await sequelize.authenticate()
    const queryInterface = sequelize.getQueryInterface()
    const columns = await queryInterface.describeTable('vendor_invoices')
    if (!columns.inbound_email_id) {
      await queryInterface.addColumn('vendor_invoices', 'inbound_email_id', {
        type: DataTypes.STRING(512),
        allowNull: true,
      })
    }

    const indexes = await queryInterface.showIndex('vendor_invoices')
    if (!indexes.some((index) => index.name === INDEX_NAME)) {
      await queryInterface.addIndex('vendor_invoices', ['inbound_email_id'], {
        name: INDEX_NAME,
        unique: true,
      })
    }

    console.log('[migrate-ap-inbound-email] Complete.')
  } catch (err) {
    console.error('[migrate-ap-inbound-email] Failed:', err.message)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}

run()
