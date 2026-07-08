const router = require('express').Router()
const { authenticate, authorise, validate } = require('../middleware')
const { ROLE } = require('../models')
const {
  createContractSchema,
  updateContractSchema,
  listContractsQuerySchema,
  contractIdParamSchema,
  contractIdOnlyParamSchema,
  addRateSchema,
  rateParamSchema,
  updateRateSchema,
  surchargeParamSchema,
  updateSurchargeSchema,
} = require('../validators')
const {
  listContracts,
  createContract,
  getContractById,
  updateContract,
  addRate,
  updateRate,
  deleteRate,
  updateSurcharge,
} = require('../controllers/contractController')

// Order matters: authenticate -> authorise (role) -> validate (shape) -> controller.
// Role Access Matrix (design/jasper/api-documentation.md): reads are
// ar_specialist + managing_director; writes are ar_specialist only.

router.get(
  '/',
  authenticate,
  authorise(ROLE.AR_SPECIALIST, ROLE.MANAGING_DIRECTOR),
  validate(listContractsQuerySchema, 'query'),
  listContracts
)

router.post(
  '/',
  authenticate,
  authorise(ROLE.AR_SPECIALIST),
  validate(createContractSchema),
  createContract
)

router.get(
  '/:id',
  authenticate,
  authorise(ROLE.AR_SPECIALIST, ROLE.MANAGING_DIRECTOR),
  validate(contractIdParamSchema, 'params'),
  getContractById
)

router.patch(
  '/:id',
  authenticate,
  authorise(ROLE.AR_SPECIALIST),
  validate(contractIdParamSchema, 'params'),
  validate(updateContractSchema),
  updateContract
)

router.post(
  '/:contractId/rates',
  authenticate,
  authorise(ROLE.AR_SPECIALIST),
  validate(contractIdOnlyParamSchema, 'params'),
  validate(addRateSchema),
  addRate
)

router.put(
  '/:contractId/rates/:rateId',
  authenticate,
  authorise(ROLE.AR_SPECIALIST),
  validate(rateParamSchema, 'params'),
  validate(updateRateSchema),
  updateRate
)

router.delete(
  '/:contractId/rates/:rateId',
  authenticate,
  authorise(ROLE.AR_SPECIALIST),
  validate(rateParamSchema, 'params'),
  deleteRate
)

router.put(
  '/:contractId/surcharges/:surchargeId',
  authenticate,
  authorise(ROLE.AR_SPECIALIST),
  validate(surchargeParamSchema, 'params'),
  validate(updateSurchargeSchema),
  updateSurcharge
)

module.exports = router
