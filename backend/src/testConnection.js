require('dotenv').config()
const { Sequelize } = require('sequelize')

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  dialectOptions: {
    ssl: { require: true, rejectUnauthorized: false }
  },
  logging: false,
})

async function test() {
  try {
    await sequelize.authenticate()
    console.log('Connection successful.')

    // Optional: list your tables to confirm schema is there
    const [results] = await sequelize.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    )
    console.log('Tables:', results ? results.map(r => r.table_name) : [])
  } catch (err) {
    console.error('Connection failed:', err.message)
  } finally {
    await sequelize.close()
  }
}

test()