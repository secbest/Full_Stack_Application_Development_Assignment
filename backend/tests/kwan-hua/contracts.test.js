jest.mock('../../src/models', () => ({
  PricingContract: { findByPk: jest.fn(), create: jest.fn(), findOne: jest.fn(), findAndCountAll: jest.fn() },
  PricingRate: { findAll: jest.fn(), bulkCreate: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  SurchargeSchedule: { findAll: jest.fn(), bulkCreate: jest.fn(), findOne: jest.fn() },
  Client: { findByPk: jest.fn() },
  Invoice: { count: jest.fn() },
}))

jest.mock('../../src/config', () => ({
  transaction: jest.fn((cb) => cb({})),
  query: jest.fn().mockResolvedValue([]),
}))

const { PricingContract, PricingRate, SurchargeSchedule, Client, Invoice } = require('../../src/models')
const {
  computeIsActive, createContract, updateContract, addRate, deleteRate, updateSurcharge,
} = require('../../src/controllers/contractController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}

function payload(res) {
  return res.json.mock.calls[0][0]
}

function makeContract(overrides = {}) {
  const obj = {
    id: 1, contract_name: 'TTSH Agreement', effective_from: '2026-01-01', effective_to: '2026-12-31',
    is_active: true, updated_at: null, ...overrides,
  }
  obj.update = jest.fn(async (fields) => { Object.assign(obj, fields); return obj })
  return obj
}

beforeEach(() => jest.clearAllMocks())

describe('computeIsActive (UC-01/UC-02)', () => {
  test('a contract whose end date is in the future is active', () => {
    expect(computeIsActive('2099-01-01')).toBe(true)
  })
  test('a contract whose end date is in the past is not active', () => {
    expect(computeIsActive('2000-01-01')).toBe(false)
  })
})

describe('createContract (UC-01)', () => {
  const baseReq = (overrides = {}) => ({
    body: {
      client_id: 1, contract_name: 'TTSH Agreement', effective_from: '2026-01-01', effective_to: '2026-12-31',
      rates: [], surcharges: [],
      ...overrides,
    },
    user: { sub: 5 },
  })

  test('rejects duplicate rate rows (same service/transfer/time_of_day) before touching the DB', async () => {
    const res = mockRes()
    await createContract(baseReq({
      rates: [
        { service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: 850 },
        { service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: 900 },
      ],
    }), res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('RATE_DUPLICATE')
    expect(Client.findByPk).not.toHaveBeenCalled()
  })

  test('rejects duplicate surcharge_type rows before touching the DB', async () => {
    const res = mockRes()
    await createContract(baseReq({
      surcharges: [{ surcharge_type: 'oxygen_base', amount: 50 }, { surcharge_type: 'oxygen_base', amount: 60 }],
    }), res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('VALIDATION_ERROR')
  })

  test('404s when the client does not exist', async () => {
    Client.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await createContract(baseReq(), res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(payload(res).code).toBe('CLIENT_NOT_FOUND')
  })

  test('409s when an active contract already overlaps this client\'s date range', async () => {
    Client.findByPk.mockResolvedValue({ id: 1, name: 'TTSH' })
    PricingContract.findOne.mockResolvedValue(makeContract())
    const res = mockRes()
    await createContract(baseReq(), res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('CONTRACT_OVERLAP')
    expect(PricingContract.create).not.toHaveBeenCalled()
  })

  test('creates the contract with rates + surcharges and returns 201', async () => {
    Client.findByPk.mockResolvedValue({ id: 1, name: 'TTSH' })
    PricingContract.findOne.mockResolvedValue(null)
    PricingContract.create.mockResolvedValue(makeContract({ id: 10 }))
    PricingRate.bulkCreate.mockResolvedValue([])
    SurchargeSchedule.bulkCreate.mockResolvedValue([])
    PricingRate.findAll.mockResolvedValue([
      { id: 1, service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: '850.00' },
    ])
    SurchargeSchedule.findAll.mockResolvedValue([])

    const res = mockRes()
    await createContract(baseReq({
      rates: [{ service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: 850 }],
    }), res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(payload(res).data.id).toBe(10)
    expect(payload(res).data.rates).toHaveLength(1)
    expect(payload(res).data.warning).toBeNull()
  })

  test('warns when the contract is created with no pricing rates', async () => {
    Client.findByPk.mockResolvedValue({ id: 1, name: 'TTSH' })
    PricingContract.findOne.mockResolvedValue(null)
    PricingContract.create.mockResolvedValue(makeContract({ id: 11 }))
    PricingRate.bulkCreate.mockResolvedValue([])
    SurchargeSchedule.bulkCreate.mockResolvedValue([])
    PricingRate.findAll.mockResolvedValue([])
    SurchargeSchedule.findAll.mockResolvedValue([])

    const res = mockRes()
    await createContract(baseReq(), res)
    expect(payload(res).data.warning).toMatch(/no pricing rates/)
  })
})

describe('updateContract (UC-02)', () => {
  // Pin "today" so the past/future date-branch tests below don't depend on the real
  // calendar date the suite happens to run on.
  beforeAll(() => { jest.useFakeTimers().setSystemTime(new Date('2026-07-09T00:00:00Z')) })
  afterAll(() => { jest.useRealTimers() })

  test('404s when the contract does not exist', async () => {
    PricingContract.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await updateContract({ params: { id: 99 }, body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('rejects effective_to before effective_from', async () => {
    PricingContract.findByPk.mockResolvedValue(makeContract())
    const res = mockRes()
    await updateContract({ params: { id: 1 }, body: { effective_to: '2025-01-01' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('VALIDATION_ERROR')
  })

  test('blocks the edit when matched invoices exist and acknowledgment is missing', async () => {
    PricingContract.findByPk.mockResolvedValue(makeContract())
    Invoice.count.mockResolvedValue(3)
    const res = mockRes()
    await updateContract({ params: { id: 1 }, body: { contract_name: 'Renamed' } }, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(payload(res).code).toBe('HAS_MATCHED_INVOICES')
    expect(payload(res).matched_invoice_count).toBe(3)
  })

  test('proceeds when matched invoices exist but acknowledge_matched_invoices is set', async () => {
    const contract = makeContract()
    PricingContract.findByPk.mockResolvedValue(contract)
    Invoice.count.mockResolvedValue(3)
    const res = mockRes()
    await updateContract({ params: { id: 1 }, body: { contract_name: 'Renamed', acknowledge_matched_invoices: true } }, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(contract.contract_name).toBe('Renamed')
  })

  test('an explicit is_active always wins over the recomputed value', async () => {
    const contract = makeContract()
    PricingContract.findByPk.mockResolvedValue(contract)
    Invoice.count.mockResolvedValue(0)
    const res = mockRes()
    await updateContract({ params: { id: 1 }, body: { effective_to: '2000-01-01', is_active: true } }, res)
    expect(contract.is_active).toBe(true)
  })

  test('setting an end date in the past auto-deactivates when is_active is not explicit', async () => {
    // effective_to must stay >= effective_from (2026-01-01) to pass the date-range check,
    // but still land before "today" (2026-07-09) to exercise the auto-deactivate branch.
    const contract = makeContract()
    PricingContract.findByPk.mockResolvedValue(contract)
    Invoice.count.mockResolvedValue(0)
    const res = mockRes()
    await updateContract({ params: { id: 1 }, body: { effective_to: '2026-02-01' } }, res)
    expect(contract.is_active).toBe(false)
  })
})

describe('addRate (UC-01)', () => {
  test('404s when the contract does not exist', async () => {
    PricingContract.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await addRate({ params: { contractId: 1 }, body: {} }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('409s on a duplicate (service_type, transfer_type, time_of_day) combo', async () => {
    PricingContract.findByPk.mockResolvedValue(makeContract())
    PricingRate.findOne.mockResolvedValue({ id: 5 })
    const res = mockRes()
    await addRate({ params: { contractId: 1 }, body: { service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: 850 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('RATE_DUPLICATE')
  })

  test('creates a new rate row and returns 201', async () => {
    PricingContract.findByPk.mockResolvedValue(makeContract())
    PricingRate.findOne.mockResolvedValue(null)
    PricingRate.create.mockResolvedValue({ id: 7, contract_id: 1, service_type: 'mts', transfer_type: 'sg_jb_ground', time_of_day: 'all_hours', base_amount: 1800 })
    const res = mockRes()
    await addRate({ params: { contractId: 1 }, body: { service_type: 'mts', transfer_type: 'sg_jb_ground', time_of_day: 'all_hours', base_amount: 1800 } }, res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(payload(res).data.id).toBe(7)
  })
})

describe('deleteRate (UC-01 edge case: audit trail)', () => {
  test('404s when the rate row does not belong to this contract', async () => {
    PricingRate.findOne.mockResolvedValue(null)
    const res = mockRes()
    await deleteRate({ params: { contractId: 1, rateId: 99 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('blocks deletion once the contract has produced any non-unmatched invoice', async () => {
    PricingRate.findOne.mockResolvedValue({ id: 1, destroy: jest.fn() })
    Invoice.count.mockResolvedValue(1)
    const res = mockRes()
    await deleteRate({ params: { contractId: 1, rateId: 1 } }, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res).code).toBe('RATE_IN_USE')
  })

  test('deletes the rate row when the contract has no billing history', async () => {
    const rate = { id: 1, destroy: jest.fn().mockResolvedValue() }
    PricingRate.findOne.mockResolvedValue(rate)
    Invoice.count.mockResolvedValue(0)
    const res = mockRes()
    await deleteRate({ params: { contractId: 1, rateId: 1 } }, res)
    expect(rate.destroy).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

describe('updateSurcharge (UC-02)', () => {
  test('404s when the surcharge row does not belong to this contract', async () => {
    SurchargeSchedule.findOne.mockResolvedValue(null)
    const res = mockRes()
    await updateSurcharge({ params: { contractId: 1, surchargeId: 99 }, body: { amount: 60 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('updates the surcharge amount', async () => {
    const surcharge = { id: 1, contract_id: 1, surcharge_type: 'oxygen_base', amount: 50, update: jest.fn(async (f) => Object.assign(surcharge, f)) }
    SurchargeSchedule.findOne.mockResolvedValue(surcharge)
    const res = mockRes()
    await updateSurcharge({ params: { contractId: 1, surchargeId: 1 }, body: { amount: 60 } }, res)
    expect(surcharge.amount).toBe(60)
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
