const express = require('express')
const cors = require('cors')
require('dotenv').config()

const { testConnection } = require('./config')
require('./models')   // initialise all models and associations
const routes = require('./routes')
const { xeroService } = require('./services')

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())

// Health check - verify the server is reachable before wiring up features
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'EFAR API', env: process.env.NODE_ENV || 'development' })
})

// All feature routes mounted under /api
app.use('/api', routes)

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` })
})

// Global error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`EFAR API running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  // Stated at startup because simulation is the DEFAULT: a deployment with real Xero
  // credentials that forgets XERO_SIMULATION=false would otherwise report every sync as
  // successful while nothing ever reaches Xero.
  xeroService.logMode()
  // Verify the DB is reachable but never crash the process if it isn't.
  // In Node 15+ an unhandled rejection inside an async listen callback kills the process.
  testConnection().catch((err) => {
    console.error('[DB] Startup connection check failed:', err.message)
    console.error('[DB] Check DATABASE_URL in backend/.env')
  })
})

module.exports = app
