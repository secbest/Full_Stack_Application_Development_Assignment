const { Op } = require('sequelize')
const { PricingContract } = require('../models')

// Finds the client's contract that is active for a service date. `transaction` is
// optional so memo approval and invoice rematching can share this exact date rule while
// still keeping their own writes atomic.
async function findActiveContract(clientId, onDate = new Date(), { transaction } = {}) {
  const day = onDate.toISOString().slice(0, 10)
  return PricingContract.findOne({
    where: {
      client_id: clientId,
      is_active: true,
      effective_from: { [Op.lte]: day },
      effective_to: { [Op.gte]: day },
    },
    order: [['effective_from', 'DESC']],
    transaction,
  })
}

module.exports = { findActiveContract }
