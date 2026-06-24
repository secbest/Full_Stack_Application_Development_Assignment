const { Sequelize } = require('sequelize')

if (!process.env.DATABASE_URL) {
  console.warn('[DB] Warning: DATABASE_URL is not set. Database features will not work.')
}

const sequelize = new Sequelize(process.env.DATABASE_URL || '', {
  dialect: 'postgres',
  dialectOptions: {
    // Required for Supabase - all connections are SSL-only
    ssl: { require: true, rejectUnauthorized: false },
  },
  logging: false,
})

// Call testConnection() in src/index.js on startup to verify Supabase is reachable.
async function testConnection() {
  try {
    await sequelize.authenticate()
    console.log('[DB] Connected to Supabase PostgreSQL.')
  } catch (err) {
    console.error('[DB] Connection failed:', err.message)
    throw err
  }
}

module.exports = sequelize
module.exports.testConnection = testConnection
