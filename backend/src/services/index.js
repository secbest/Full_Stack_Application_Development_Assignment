// Business logic layer - no req/res objects here, making services independently testable

const xeroService = require('./xeroService')
const cloudinaryService = require('./cloudinaryService')
const ocrService = require('./ocrService')

module.exports = { xeroService, cloudinaryService, ocrService }
