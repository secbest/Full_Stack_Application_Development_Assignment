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

module.exports = { fleetOverviewQuerySchema, vendorExpensesQuerySchema }
