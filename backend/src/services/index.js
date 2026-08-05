// Business logic layer - no req/res objects here, making services independently testable

const xeroService = require('./xeroService')
const cloudinaryService = require('./cloudinaryService')
const ocrService = require('./ocrService')
const pricingService = require('./pricingService')
const leakageService = require('./leakageService')

module.exports = { xeroService, cloudinaryService, ocrService, pricingService, leakageService }
