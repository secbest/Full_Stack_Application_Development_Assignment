const { Sequelize } = require('sequelize')

if (!process.env.DATABASE_URL) {
  console.warn('[DB] Warning: DATABASE_URL is not set. Database features will not work.')
}

// Parse the URL manually so dialectOptions.ssl is always applied.
// When Sequelize receives a raw URI string, pg v8 can silently ignore ssl options
// and produce "read ECONNRESET" from Supabase, which requires SSL on every connection.
function buildSequelize(rawUrl) {
  if (!rawUrl) {
    return new Sequelize({ dialect: 'postgres', logging: false })
  }

  const url = new URL(rawUrl)
  return new Sequelize({
    dialect: 'postgres',
    host: url.hostname,
    port: Number(url.port) || 5432,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    logging: false,
  })
}

const sequelize = buildSequelize(process.env.DATABASE_URL)

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
