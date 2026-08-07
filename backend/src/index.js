const express = require('express')
const cors = require('cors')
require('dotenv').config()

const { testConnection } = require('./config')
require('./models')   // initialise all models and associations
const routes = require('./routes')
const { xeroService } = require('./services')
const { importPendingGmailInvoices } = require('./controllers/gmailController')

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
  // Gmail has no HTTP-forwarding primitive. Once the inbox has been connected, poll
  // only its explicitly-labelled AP queue. The immediate Import Gmail button uses the
  // same function for a test; this timer makes subsequent vendor emails automatic.
  const gmailPollMs = Math.max(Number(process.env.GMAIL_INTAKE_POLL_MS) || 5 * 60 * 1000, 60 * 1000)
  let gmailImportRunning = false
  const pollGmail = async () => {
    if (gmailImportRunning) return
    gmailImportRunning = true
    try {
      const result = await importPendingGmailInvoices()
      const count = result.imported?.filter((entry) => entry.imported).length || 0
      if (count) console.log(`[gmail-intake] Imported ${count} Gmail message(s).`)
    } catch (err) {
      console.error('[gmail-intake] Poll failed:', err.message)
    } finally { gmailImportRunning = false }
  }
  const gmailTimer = setInterval(pollGmail, gmailPollMs)
  gmailTimer.unref()
  pollGmail()
  // Verify the DB is reachable but never crash the process if it isn't.
  // In Node 15+ an unhandled rejection inside an async listen callback kills the process.
  testConnection().catch((err) => {
    console.error('[DB] Startup connection check failed:', err.message)
    console.error('[DB] Check DATABASE_URL in backend/.env')
  })
})

module.exports = app
