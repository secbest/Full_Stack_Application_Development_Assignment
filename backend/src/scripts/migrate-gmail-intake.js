require('dotenv').config()
const sequelize = require('../config')
const { GmailConnection } = require('../models')

async function run() {
  try {
    await sequelize.authenticate()
    await GmailConnection.sync()
    console.log('[migrate-gmail-intake] Complete.')
  } catch (err) {
    console.error('[migrate-gmail-intake] Failed:', err.message)
    process.exitCode = 1
  } finally {
    await sequelize.close()
  }
}
run()
