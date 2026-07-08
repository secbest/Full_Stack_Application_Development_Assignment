// Jasper - AR Billing, Pricing Engine & Invoice Sync (Wave 2B: pricing contracts CRUD).
// Design: design/jasper/api-documentation.md ; database-schema.md
const { Op } = require('sequelize')
const sequelize = require('../config')
const { PricingContract, PricingRate, SurchargeSchedule, Client, Invoice } = require('../models')
const { success, created, error, notFound, internalError } = require('../utils')

function todayDateOnly() {
  return new Date().toISOString().slice(0, 10)
}

// Thrown inside createContract's transaction to abort/rollback on a detected overlap,
// then caught by name in the outer catch to translate into the documented 409 response -
// distinct from a real INTERNAL_ERROR so the transaction's own catch doesn't have to
// know about HTTP status codes.
class ContractOverlapError extends Error {}

// is_active means "not manually withdrawn / not lapsed" - it is NOT "currently within
// the effective date range right now". Nothing in this app recomputes stored columns on
// a schedule (no cron), so if this returned false just because effective_from is in the
// future, a contract dated to start tomorrow would stay is_active=false forever unless
// someone happened to edit it again after that date - and the pricing engine's contract
// lookup (memoReviewController.findActiveContract) filters on is_active=true AND the
// date range, so it would never pick this contract up once it actually started.
// Instead: default to true, and only force false when the contract is already lapsed
// (effective_to in the past) - that's a one-way, correct-forever fact, unlike "hasn't
// started yet" which changes on its own as time passes. UC-02's edge case ("setting an
// end date in the past immediately sets is_active = false") is exactly this rule.
// Wave 3's existing date-range comparison (evaluated fresh at match time, not stored)
// is what correctly excludes an upcoming contract from matching until its start date -
// this function must not fight that by pre-emptively storing false for the future.
function computeIsActive(effectiveTo) {
  return effectiveTo >= todayDateOnly()
}

function serializeContract(contract) {
  return {
    id: contract.id,
    client_id: contract.client_id,
    client_name: contract.Client ? contract.Client.name : null,
    contract_name: contract.contract_name,
    effective_from: contract.effective_from,
    effective_to: contract.effective_to,
    is_active: contract.is_active,
    created_by: contract.created_by,
    created_at: contract.created_at,
  }
}

// GET /api/contracts - UC-01/UC-02: list, filterable by client and active status.
async function listContracts(req, res) {
  try {
    const { client_id, is_active, page, limit } = req.query

    const where = {}
    if (client_id) where.client_id = client_id
    if (is_active !== undefined) where.is_active = is_active

    const { rows, count } = await PricingContract.findAndCountAll({
      where,
      include: [{ model: Client, attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    })

    return success(res, {
      data: rows.map(serializeContract),
      meta: { total: count, page, limit },
    })
  } catch (err) {
    return internalError(res, err)
  }
}

// POST /api/contracts - UC-01: create a contract with its initial rates + full
// surcharge schedule in one atomic transaction. Surcharges can ONLY be created here -
// there is no POST .../surcharges endpoint, only PUT to edit an existing row's amount -
// so a contract created with an incomplete surcharge list stays that way permanently.
async function createContract(req, res) {
  try {
    const { client_id, contract_name, effective_from, effective_to, rates, surcharges } = req.body

    // addRate rejects a duplicate (service_type, transfer_type, time_of_day) combo on
    // an existing contract - bulkCreate below has no equivalent guard, so without this
    // check two identical rows in one create payload would be silently accepted and
    // make the pricing engine's lookup ambiguous later. Same idea for surcharge_type,
    // which must be unique per contract since it's what updateSurcharge looks up by.
    const rateKeys = rates.map((r) => `${r.service_type}|${r.transfer_type}|${r.time_of_day}`)
    if (new Set(rateKeys).size !== rateKeys.length) {
      return error(res, 'Duplicate rate rows: service_type, transfer_type, and time_of_day must be unique within a contract.', 'RATE_DUPLICATE', 409)
    }
    const surchargeKeys = surcharges.map((s) => s.surcharge_type)
    if (new Set(surchargeKeys).size !== surchargeKeys.length) {
      return error(res, 'Duplicate surcharge rows: surcharge_type must be unique within a contract.', 'VALIDATION_ERROR', 400)
    }

    const client = await Client.findByPk(client_id)
    if (!client) return notFound(res, 'No client with this id.', 'CLIENT_NOT_FOUND')

    let contract
    await sequelize.transaction(async (t) => {
      // Serialize concurrent creates for the same client before checking overlap.
      // Without this, a plain findOne-then-create is a classic check-then-act race:
      // two near-simultaneous requests (a double-click, two open tabs) could both pass
      // the overlap check below before either one commits, producing two overlapping
      // active contracts with nothing ever erroring. There's no DB-level unique/
      // exclusion constraint on (client_id, date range) to catch this instead, so a
      // Postgres advisory lock scoped to this transaction (released automatically on
      // commit/rollback) closes the race without a schema migration.
      await sequelize.query('SELECT pg_advisory_xact_lock(:clientId)', {
        replacements: { clientId: client_id },
        transaction: t,
      })

      // UC-01 edge case: block if this client already has an active contract whose
      // date range overlaps the one being created. Overlap test: two ranges [a,b] and
      // [c,d] overlap unless one ends before the other starts.
      const overlapping = await PricingContract.findOne({
        where: {
          client_id,
          is_active: true,
          effective_from: { [Op.lte]: effective_to },
          effective_to: { [Op.gte]: effective_from },
        },
        transaction: t,
      })
      if (overlapping) throw new ContractOverlapError()

      contract = await PricingContract.create(
        {
          client_id,
          created_by: req.user.sub,
          contract_name,
          effective_from,
          effective_to,
          is_active: computeIsActive(effective_to),
        },
        { transaction: t }
      )

      if (rates.length) {
        await PricingRate.bulkCreate(
          rates.map((r) => ({ ...r, contract_id: contract.id })),
          { transaction: t }
        )
      }
      if (surcharges.length) {
        await SurchargeSchedule.bulkCreate(
          surcharges.map((s) => ({ ...s, contract_id: contract.id })),
          { transaction: t }
        )
      }
    })

    const [createdRates, createdSurcharges] = await Promise.all([
      PricingRate.findAll({ where: { contract_id: contract.id } }),
      SurchargeSchedule.findAll({ where: { contract_id: contract.id } }),
    ])

    // UC-01 edge case: a contract with no pricing rules saves successfully (it's a
    // valid state, not an error), but the pricing engine can't match any jobs against
    // it until rules are added - the doc requires warning Sarah of that, not silently
    // returning 201 as if everything is ready to bill.
    return created(res, {
      ...serializeContract(contract),
      rates: createdRates.map((r) => ({
        id: r.id, service_type: r.service_type, transfer_type: r.transfer_type,
        time_of_day: r.time_of_day, base_amount: r.base_amount,
      })),
      surcharges: createdSurcharges.map((s) => ({ id: s.id, surcharge_type: s.surcharge_type, amount: s.amount })),
      warning: createdRates.length === 0
        ? 'This contract has no pricing rates. The pricing engine will not be able to generate invoice amounts for this client until rates are added.'
        : null,
    })
  } catch (err) {
    if (err instanceof ContractOverlapError) {
      return error(
        res,
        'An active contract already exists for this client. Please set an end date on the existing contract before creating a new one.',
        'CONTRACT_OVERLAP',
        409
      )
    }
    return internalError(res, err)
  }
}

// GET /api/contracts/:id - single contract with all rate rows and surcharge schedule.
async function getContractById(req, res) {
  try {
    const contract = await PricingContract.findByPk(req.params.id, {
      include: [{ model: Client, attributes: ['id', 'name'] }],
    })
    if (!contract) return notFound(res, 'No contract with this id.', 'CONTRACT_NOT_FOUND')

    // Excludes 'unmatched' invoices - same filter as updateContract's HAS_MATCHED_INVOICES
    // check and deleteRate's RATE_IN_USE check, so this displayed count always means the
    // same thing everywhere: "invoices that actually used this contract's pricing rules."
    const [rates, surcharges, matchedInvoiceCount] = await Promise.all([
      PricingRate.findAll({ where: { contract_id: contract.id }, order: [['id', 'ASC']] }),
      SurchargeSchedule.findAll({ where: { contract_id: contract.id }, order: [['id', 'ASC']] }),
      Invoice.count({ where: { contract_id: contract.id, status: { [Op.ne]: 'unmatched' } } }),
    ])

    return success(res, {
      ...serializeContract(contract),
      rates: rates.map((r) => ({
        id: r.id, service_type: r.service_type, transfer_type: r.transfer_type,
        time_of_day: r.time_of_day, base_amount: r.base_amount,
      })),
      surcharges: surcharges.map((s) => ({ id: s.id, surcharge_type: s.surcharge_type, amount: s.amount })),
      matched_invoice_count: matchedInvoiceCount,
    })
  } catch (err) {
    return internalError(res, err)
  }
}

// PATCH /api/contracts/:id - UC-02: rename, re-date, or manually deactivate a contract.
// Rate/surcharge changes go through their own endpoints, not this one.
async function updateContract(req, res) {
  try {
    const contract = await PricingContract.findByPk(req.params.id)
    if (!contract) return notFound(res, 'No contract with this id.', 'CONTRACT_NOT_FOUND')

    const { contract_name, effective_from, effective_to, is_active, acknowledge_matched_invoices } = req.body

    const nextFrom = effective_from !== undefined ? effective_from : contract.effective_from
    const nextTo = effective_to !== undefined ? effective_to : contract.effective_to
    if (nextTo < nextFrom) {
      return error(res, 'effective_to must be on or after effective_from.', 'VALIDATION_ERROR', 400)
    }

    // UC-02: editing a contract that already has matched invoices requires an explicit
    // acknowledgment round-trip - the frontend shows the count, then resubmits with the
    // flag. Excludes 'unmatched' invoices, same as deleteRate's RATE_IN_USE check below -
    // an unmatched invoice never actually used this contract's rules, so it shouldn't
    // trigger a "billing history" warning here any more than it blocks a rate deletion.
    if (!acknowledge_matched_invoices) {
      const matchedInvoiceCount = await Invoice.count({
        where: { contract_id: contract.id, status: { [Op.ne]: 'unmatched' } },
      })
      if (matchedInvoiceCount > 0) {
        return error(
          res,
          `${matchedInvoiceCount} invoice(s) have already been matched using this contract. Editing rules will not retroactively change those invoices.`,
          'HAS_MATCHED_INVOICES',
          400,
          { matched_invoice_count: matchedInvoiceCount }
        )
      }
    }

    const updates = {}
    if (contract_name !== undefined) updates.contract_name = contract_name
    if (effective_from !== undefined) updates.effective_from = effective_from
    if (effective_to !== undefined) updates.effective_to = effective_to

    // Explicit is_active wins (manual deactivation/reactivation per UC-02). Otherwise,
    // only recompute when effective_to changed - covers "setting an end date in the
    // past immediately sets is_active = false" without a separate code path. A change
    // to effective_from alone never affects is_active (see computeIsActive's comment) -
    // whether a contract has started yet is a date-range fact checked fresh at match
    // time, not something this stored flag should track.
    if (is_active !== undefined) {
      updates.is_active = is_active
    } else if (effective_to !== undefined) {
      updates.is_active = computeIsActive(nextTo)
    }

    await contract.update(updates)

    return success(res, {
      id: contract.id,
      contract_name: contract.contract_name,
      effective_from: contract.effective_from,
      effective_to: contract.effective_to,
      is_active: contract.is_active,
      updated_at: contract.updated_at,
    })
  } catch (err) {
    return internalError(res, err)
  }
}

function serializeRate(rate) {
  return {
    id: rate.id, contract_id: rate.contract_id, service_type: rate.service_type,
    transfer_type: rate.transfer_type, time_of_day: rate.time_of_day, base_amount: rate.base_amount,
  }
}

// POST /api/contracts/:contractId/rates - add one rate row to an existing contract.
async function addRate(req, res) {
  try {
    const contract = await PricingContract.findByPk(req.params.contractId)
    if (!contract) return notFound(res, 'No contract with this id.', 'CONTRACT_NOT_FOUND')

    const { service_type, transfer_type, time_of_day, base_amount } = req.body

    // The pricing engine looks up exactly one row per (service_type, transfer_type,
    // time_of_day) combination - a duplicate would make the lookup ambiguous.
    const duplicate = await PricingRate.findOne({
      where: { contract_id: contract.id, service_type, transfer_type, time_of_day },
    })
    if (duplicate) {
      return error(
        res,
        'A rate row with the same service_type, transfer_type, and time_of_day already exists on this contract.',
        'RATE_DUPLICATE',
        409
      )
    }

    const rate = await PricingRate.create({ contract_id: contract.id, service_type, transfer_type, time_of_day, base_amount })
    return created(res, serializeRate(rate))
  } catch (err) {
    return internalError(res, err)
  }
}

// PUT /api/contracts/:contractId/rates/:rateId - update only base_amount.
async function updateRate(req, res) {
  try {
    const rate = await PricingRate.findOne({ where: { id: req.params.rateId, contract_id: req.params.contractId } })
    if (!rate) return notFound(res, 'No rate row with this id on this contract.', 'RATE_NOT_FOUND')

    await rate.update({ base_amount: req.body.base_amount })
    return success(res, serializeRate(rate))
  } catch (err) {
    return internalError(res, err)
  }
}

// DELETE /api/contracts/:contractId/rates/:rateId - blocked if the contract has any
// billing history. This is a COARSE, contract-level check, not a per-rate one:
// invoice_line_items has no rate_id column to trace a specific rate to a specific
// invoice, so "in use" here means "this contract has produced at least one invoice
// that wasn't unmatched", not "this exact rate was used". Deliberately conservative -
// it can over-block (refuse to delete an unrelated, never-used rate on a busy
// contract) but never under-blocks a rate that really was billed. Revisit if a
// rate_id FK is ever added to invoice_line_items by the Wave 3 owner.
async function deleteRate(req, res) {
  try {
    const rate = await PricingRate.findOne({ where: { id: req.params.rateId, contract_id: req.params.contractId } })
    if (!rate) return notFound(res, 'No rate row with this id on this contract.', 'RATE_NOT_FOUND')

    const billedInvoiceCount = await Invoice.count({
      where: { contract_id: req.params.contractId, status: { [Op.ne]: 'unmatched' } },
    })
    if (billedInvoiceCount > 0) {
      return error(
        res,
        'Invoices have been matched using this contract - deletion blocked to preserve the audit trail.',
        'RATE_IN_USE',
        409
      )
    }

    await rate.destroy()
    return success(res, { message: 'Rate row deleted.' })
  } catch (err) {
    return internalError(res, err)
  }
}

// PUT /api/contracts/:contractId/surcharges/:surchargeId - update only amount.
// There is no create-surcharge endpoint by design (see createContract) - surcharge
// rows only ever come from POST /api/contracts and are edited, never added, after.
async function updateSurcharge(req, res) {
  try {
    const surcharge = await SurchargeSchedule.findOne({
      where: { id: req.params.surchargeId, contract_id: req.params.contractId },
    })
    if (!surcharge) return notFound(res, 'No surcharge row with this id on this contract.', 'SURCHARGE_NOT_FOUND')

    await surcharge.update({ amount: req.body.amount })
    return success(res, { id: surcharge.id, contract_id: surcharge.contract_id, surcharge_type: surcharge.surcharge_type, amount: surcharge.amount })
  } catch (err) {
    return internalError(res, err)
  }
}

module.exports = {
  serializeContract,
  computeIsActive,
  listContracts,
  createContract,
  getContractById,
  updateContract,
  addRate,
  updateRate,
  deleteRate,
  updateSurcharge,
}
