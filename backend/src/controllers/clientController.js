// Minimal read-only endpoint - Client itself is Zheng Bao's owned table (shared group
// resource). This does not duplicate or replace future full Client CRUD; it exists only
// because nothing in the app exposes a client list yet, and the pricing contract form
// needs one for its client picker (Wave 2B, Jasper).
const { Client } = require('../models')
const { success, internalError } = require('../utils')

async function listClients(req, res) {
  try {
    const clients = await Client.findAll({
      attributes: ['id', 'name'],
      order: [['name', 'ASC']],
    })
    return success(res, clients)
  } catch (err) {
    return internalError(res, err)
  }
}

module.exports = { listClients }
