const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { fleetOverviewQuerySchema, vendorExpensesQuerySchema, revenueLeakageQuerySchema } = require('../validators')
const { fleetOverview, vendorExpenses, revenueLeakage } = require('../controllers/dashboardController')

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

module.exports = router
