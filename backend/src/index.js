const express = require('express')
const cors = require('cors')
require('dotenv').config()

const { testConnection } = require('./config')
require('./models')   // initialise all models and associations
const routes = require('./routes')

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
app.listen(PORT, async () => {
  console.log(`EFAR API running on port ${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
  await testConnection()
})

module.exports = app
