const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { fleetOverviewQuerySchema, vendorExpensesQuerySchema, revenueLeakageQuerySchema, cycleTimeQuerySchema, revenueTrendQuerySchema, revenueByServiceTypeQuerySchema, leakageHistoryQuerySchema } = require('../validators')
const { fleetOverview, vendorExpenses, revenueLeakage, cycleTime, xeroHealth, revenueTrend, topClients, revenueByServiceType, leakageHistory, crewPositions } = require('../controllers/dashboardController')

router.get(
  '/fleet-overview',
  authenticate,
  authorise('managing_director'),
  validate(fleetOverviewQuerySchema, 'query'),
  fleetOverview
)

router.get(
  '/vendor-expenses',
  authenticate,
  authorise('managing_director'),
  validate(vendorExpensesQuerySchema, 'query'),
  vendorExpenses
)

// The AR Specialist sees this too, not only the MD: she is the one who fixes the contracts
// the report points at, so gating it to managing_director alone would name the problem to
// the only person who cannot act on it.
router.get(
  '/revenue-leakage',
  authenticate,
  authorise('managing_director', 'ar_specialist'),
  validate(revenueLeakageQuerySchema, 'query'),
  revenueLeakage
)

router.get(
  '/cycle-time',
  authenticate,
  authorise('managing_director'),
  validate(cycleTimeQuerySchema, 'query'),
  cycleTime
)

router.get('/xero-health', authenticate, authorise('managing_director'), xeroHealth)

router.get(
  '/revenue-trend',
  authenticate,
  authorise('managing_director'),
  validate(revenueTrendQuerySchema, 'query'),
  revenueTrend
)

router.get('/top-clients', authenticate, authorise('managing_director'), topClients)

router.get(
  '/revenue-by-service-type',
  authenticate,
  authorise('managing_director'),
  validate(revenueByServiceTypeQuerySchema, 'query'),
  revenueByServiceType
)

router.get(
  '/leakage-history',
  authenticate,
  authorise('managing_director'),
  validate(leakageHistoryQuerySchema, 'query'),
  leakageHistory
)

router.get('/crew-positions', authenticate, authorise('managing_director'), crewPositions)

module.exports = router
