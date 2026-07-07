const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { fleetOverviewQuerySchema, vendorExpensesQuerySchema } = require('../validators')
const { fleetOverview, vendorExpenses } = require('../controllers/dashboardController')

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

module.exports = router
