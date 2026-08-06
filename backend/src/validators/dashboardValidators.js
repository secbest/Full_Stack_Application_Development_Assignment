const Yup = require('yup')

function dateRangeTest(errorPath = 'date_to') {
  return function (values) {
    if (!values.date_from || !values.date_to) return true
    if (new Date(values.date_from) > new Date(values.date_to)) {
      return this.createError({ path: errorPath, message: 'date_from must be before or equal to date_to.' })
    }
    return true
  }
}

const fleetOverviewQuerySchema = Yup.object({
  period: Yup.string()
    .oneOf(['today', 'this_week', 'this_month'], 'period must be one of: today, this_week, this_month')
    .default('today'),
  date_from: Yup.date(),
  date_to: Yup.date(),
}).test('date-range', 'date_from must be before or equal to date_to.', dateRangeTest())

const vendorExpensesQuerySchema = Yup.object({
  date_from: Yup.date(),
  date_to: Yup.date(),
  vendor_name: Yup.string().trim(),
}).test('date-range', 'date_from must be before or equal to date_to.', dateRangeTest())

// GET /api/dashboard/revenue-leakage
//
// Dates are validated as YYYY-MM-DD STRINGS rather than Yup.date() (as the two schemas
// above use) because the controller builds an explicit end-of-day bound from them
// (`${to}T23:59:59.999Z`). A coerced Date object would stringify to its full form and
// produce an unparseable bound, silently widening or emptying the window.
const revenueLeakageQuerySchema = Yup.object({
  date_from: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'date_from must be in YYYY-MM-DD format'),
  date_to: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'date_to must be in YYYY-MM-DD format'),
}).test('date-range', 'date_from must be before or equal to date_to.', dateRangeTest())

// GET /api/dashboard/cycle-time - same YYYY-MM-DD string validation as
// revenueLeakageQuerySchema above, for the same reason (the controller builds an
// explicit end-of-day bound from the string).
const cycleTimeQuerySchema = Yup.object({
  date_from: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'date_from must be in YYYY-MM-DD format'),
  date_to: Yup.string().matches(/^\d{4}-\d{2}-\d{2}$/, 'date_to must be in YYYY-MM-DD format'),
}).test('date-range', 'date_from must be before or equal to date_to.', dateRangeTest())

const revenueTrendQuerySchema = Yup.object({
  granularity: Yup.string().oneOf(['month', 'week'], 'granularity must be one of: month, week').default('month'),
})

module.exports = {
  fleetOverviewQuerySchema,
  vendorExpensesQuerySchema,
  revenueLeakageQuerySchema,
  cycleTimeQuerySchema,
  revenueTrendQuerySchema,
}
