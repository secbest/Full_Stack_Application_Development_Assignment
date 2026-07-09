// Jasper - Pricing Contracts (Wave 2B). Controller unit tests: models, sequelize
// (transaction/query), and the Client/Invoice cross-references are all mocked, so
// these run without a live database - only ../../src/utils (success/created/error/
// notFound/internalError) is real, so response shapes are asserted exactly as the
// route would actually send them.
jest.mock('../../src/config', () => ({
  transaction: jest.fn((cb) => cb({})),
  query: jest.fn().mockResolvedValue([[], {}]),
}))

jest.mock('../../src/models', () => ({
  PricingContract: { findAndCountAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), findByPk: jest.fn() },
  PricingRate: { bulkCreate: jest.fn(), findAll: jest.fn(), findOne: jest.fn(), create: jest.fn() },
  SurchargeSchedule: { bulkCreate: jest.fn(), findAll: jest.fn(), findOne: jest.fn() },
  Client: { findByPk: jest.fn() },
  Invoice: { count: jest.fn() },
}))

const sequelize = require('../../src/config')
const { PricingContract, PricingRate, SurchargeSchedule, Client, Invoice } = require('../../src/models')
const {
  listContracts,
  createContract,
  getContractById,
  updateContract,
  addRate,
  updateRate,
  deleteRate,
  updateSurcharge,
} = require('../../src/controllers/contractController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}

function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => {
  jest.clearAllMocks()
  sequelize.transaction.mockImplementation((cb) => cb({}))
  sequelize.query.mockResolvedValue([[], {}])
})

// internalError() deliberately logs every 500 server-side - expected noise for the two
// "unexpected failure" tests below, not something worth silencing in the real app.
let consoleErrorSpy
beforeAll(() => { consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}) })
afterAll(() => { consoleErrorSpy.mockRestore() })

describe('listContracts (GET /api/contracts)', () => {
  test('returns 200 with serialized contracts and pagination meta', async () => {
    PricingContract.findAndCountAll.mockResolvedValue({
      rows: [{ id: 1, client_id: 1, Client: { name: 'TTSH' }, contract_name: 'FY2027', effective_from: '2027-01-01', effective_to: '2027-12-31', is_active: true, created_by: 1, created_at: 't' }],
      count: 1,
    })
    const req = { query: { page: 1, limit: 20 } }
    const res = mockRes()

    await listContracts(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(jsonBody(res)).toMatchObject({
      success: true,
      data: { data: [{ id: 1, client_name: 'TTSH' }], meta: { total: 1, page: 1, limit: 20 } },
    })
  })

  test('filters by client_id and is_active when both are provided', async () => {
    PricingContract.findAndCountAll.mockResolvedValue({ rows: [], count: 0 })
    const req = { query: { client_id: '5', is_active: 'true', page: 1, limit: 20 } }

    await listContracts(req, mockRes())

    expect(PricingContract.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { client_id: '5', is_active: 'true' } })
    )
  })

  test('returns 500 INTERNAL_ERROR when the query throws', async () => {
    PricingContract.findAndCountAll.mockRejectedValue(new Error('boom'))
    const res = mockRes()

    await listContracts({ query: {} }, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'INTERNAL_ERROR' })
  })
})

describe('createContract (POST /api/contracts, UC-01)', () => {
  function baseReq(overrides = {}) {
    return {
      body: {
        client_id: 1,
        contract_name: 'FY2027',
        effective_from: '2027-01-01',
        effective_to: '2027-12-31',
        rates: [],
        surcharges: [],
        ...overrides,
      },
      user: { sub: 1 },
    }
  }

  test('happy path: creates the contract, rates, and surcharges inside one transaction', async () => {
    Client.findByPk.mockResolvedValue({ id: 1, name: 'TTSH' })
    PricingContract.findOne.mockResolvedValue(null) // no overlap
    PricingContract.create.mockResolvedValue({ id: 42, client_id: 1, contract_name: 'FY2027', effective_from: '2027-01-01', effective_to: '2027-12-31', is_active: true, created_by: 1, created_at: 't' })
    PricingRate.findAll.mockResolvedValue([{ id: 1, service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: '850.00' }])
    SurchargeSchedule.findAll.mockResolvedValue([{ id: 1, surcharge_type: 'oxygen_base', amount: '50.00' }])

    const req = baseReq({
      rates: [{ service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: 850 }],
      surcharges: [{ surcharge_type: 'oxygen_base', amount: 50 }],
    })
    const res = mockRes()

    await createContract(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(jsonBody(res).data).toMatchObject({ id: 42, warning: null })
    expect(PricingRate.bulkCreate).toHaveBeenCalledWith(
      [expect.objectContaining({ contract_id: 42 })],
      expect.objectContaining({ transaction: expect.anything() })
    )
    expect(SurchargeSchedule.bulkCreate).toHaveBeenCalled()
  })

  test('returns a warning (still 201) when created with zero rates', async () => {
    Client.findByPk.mockResolvedValue({ id: 1, name: 'TTSH' })
    PricingContract.findOne.mockResolvedValue(null)
    PricingContract.create.mockResolvedValue({ id: 43, contract_name: 'FY2027' })
    PricingRate.findAll.mockResolvedValue([])
    SurchargeSchedule.findAll.mockResolvedValue([])

    const res = mockRes()
    await createContract(baseReq(), res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(jsonBody(res).data.warning).toMatch(/no pricing rates/i)
  })

  test('rejects duplicate rate rows within the same payload before ever hitting the DB', async () => {
    const res = mockRes()
    await createContract(baseReq({
      rates: [
        { service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: 850 },
        { service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: 950 },
      ],
    }), res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'RATE_DUPLICATE' })
    expect(Client.findByPk).not.toHaveBeenCalled()
  })

  test('rejects duplicate surcharge_type rows within the same payload', async () => {
    const res = mockRes()
    await createContract(baseReq({
      surcharges: [{ surcharge_type: 'oxygen_base', amount: 50 }, { surcharge_type: 'oxygen_base', amount: 60 }],
    }), res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'VALIDATION_ERROR' })
  })

  test('returns 404 CLIENT_NOT_FOUND when the client does not exist', async () => {
    Client.findByPk.mockResolvedValue(null)
    const res = mockRes()

    await createContract(baseReq(), res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'CLIENT_NOT_FOUND' })
  })

  test('returns 409 CONTRACT_OVERLAP when an active contract already covers the range', async () => {
    Client.findByPk.mockResolvedValue({ id: 1, name: 'TTSH' })
    PricingContract.findOne.mockResolvedValue({ id: 99 }) // overlapping contract found
    const res = mockRes()

    await createContract(baseReq(), res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'CONTRACT_OVERLAP' })
    expect(PricingContract.create).not.toHaveBeenCalled()
  })

  test('returns 500 INTERNAL_ERROR on an unexpected failure', async () => {
    Client.findByPk.mockResolvedValue({ id: 1 })
    PricingContract.findOne.mockRejectedValue(new Error('db down'))
    const res = mockRes()

    await createContract(baseReq(), res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'INTERNAL_ERROR' })
  })
})

describe('getContractById (GET /api/contracts/:id)', () => {
  test('returns 404 CONTRACT_NOT_FOUND when the contract does not exist', async () => {
    PricingContract.findByPk.mockResolvedValue(null)
    const res = mockRes()

    await getContractById({ params: { id: 999 } }, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(jsonBody(res)).toMatchObject({ code: 'CONTRACT_NOT_FOUND' })
  })

  test('returns 200 with rates, surcharges, and matched_invoice_count excluding unmatched invoices', async () => {
    PricingContract.findByPk.mockResolvedValue({ id: 1, client_id: 1, Client: { name: 'TTSH' }, contract_name: 'FY2027', effective_from: '2027-01-01', effective_to: '2027-12-31', is_active: true })
    PricingRate.findAll.mockResolvedValue([{ id: 1, service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: '850.00' }])
    SurchargeSchedule.findAll.mockResolvedValue([{ id: 1, surcharge_type: 'oxygen_base', amount: '50.00' }])
    Invoice.count.mockResolvedValue(12)
    const res = mockRes()

    await getContractById({ params: { id: 1 } }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(jsonBody(res).data.matched_invoice_count).toBe(12)
    expect(Invoice.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ contract_id: 1 }) })
    )
  })
})

describe('updateContract (PATCH /api/contracts/:id, UC-02)', () => {
  // Computed relative to whenever the suite actually runs (not hardcoded) so
  // "in the past" / "in the future" stay true regardless of what year this runs in.
  function daysFromNow(offset) {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return d.toISOString().slice(0, 10)
  }
  const TEN_DAYS_AGO = daysFromNow(-10)
  const FIVE_DAYS_AGO = daysFromNow(-5)
  const ONE_YEAR_AHEAD = daysFromNow(365)

  function makeContract(overrides = {}) {
    const contract = {
      id: 1, contract_name: 'Old Name', effective_from: TEN_DAYS_AGO, effective_to: ONE_YEAR_AHEAD, is_active: true, updated_at: null,
      ...overrides,
    }
    contract.update = jest.fn(async (updates) => Object.assign(contract, updates, { updated_at: 'MOCK_TIMESTAMP' }))
    return contract
  }

  test('returns 404 CONTRACT_NOT_FOUND when the contract does not exist', async () => {
    PricingContract.findByPk.mockResolvedValue(null)
    const res = mockRes()

    await updateContract({ params: { id: 999 }, body: {} }, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('returns 400 VALIDATION_ERROR when the resulting effective_to is before effective_from', async () => {
    PricingContract.findByPk.mockResolvedValue(makeContract())
    const res = mockRes()

    await updateContract({ params: { id: 1 }, body: { effective_to: daysFromNow(-20) } }, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(jsonBody(res)).toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  test('returns 400 HAS_MATCHED_INVOICES with the count when matched invoices exist and no acknowledgment is sent', async () => {
    PricingContract.findByPk.mockResolvedValue(makeContract())
    Invoice.count.mockResolvedValue(3)
    const res = mockRes()

    await updateContract({ params: { id: 1 }, body: { contract_name: 'New Name' } }, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(jsonBody(res)).toMatchObject({ code: 'HAS_MATCHED_INVOICES', matched_invoice_count: 3 })
  })

  test('proceeds with the edit when acknowledge_matched_invoices=true, even with matched invoices', async () => {
    const contract = makeContract()
    PricingContract.findByPk.mockResolvedValue(contract)
    Invoice.count.mockResolvedValue(3)
    const res = mockRes()

    await updateContract({ params: { id: 1 }, body: { contract_name: 'New Name', acknowledge_matched_invoices: true } }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(contract.update).toHaveBeenCalledWith({ contract_name: 'New Name' })
  })

  test('setting effective_to in the past auto-deactivates the contract (no explicit is_active sent)', async () => {
    // Must stay on/after the contract's effective_from (TEN_DAYS_AGO) to pass the
    // date-range guard, but still before "today" so computeIsActive recomputes false.
    const contract = makeContract()
    PricingContract.findByPk.mockResolvedValue(contract)
    Invoice.count.mockResolvedValue(0)
    const res = mockRes()

    await updateContract({ params: { id: 1 }, body: { effective_to: FIVE_DAYS_AGO } }, res)

    expect(contract.update).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }))
    expect(jsonBody(res).data.is_active).toBe(false)
  })

  test('an explicit is_active in the body wins over the recomputed value', async () => {
    const contract = makeContract()
    PricingContract.findByPk.mockResolvedValue(contract)
    Invoice.count.mockResolvedValue(0)
    const res = mockRes()

    // effective_to stays in the future (would recompute to true) but is_active:false is explicit.
    await updateContract({ params: { id: 1 }, body: { effective_to: ONE_YEAR_AHEAD, is_active: false } }, res)

    expect(contract.update).toHaveBeenCalledWith(expect.objectContaining({ is_active: false }))
  })
})

describe('addRate (POST /api/contracts/:contractId/rates)', () => {
  test('returns 404 CONTRACT_NOT_FOUND when the contract does not exist', async () => {
    PricingContract.findByPk.mockResolvedValue(null)
    const res = mockRes()

    await addRate({ params: { contractId: 999 }, body: {} }, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('returns 409 RATE_DUPLICATE when the same combo already exists on the contract', async () => {
    PricingContract.findByPk.mockResolvedValue({ id: 1 })
    PricingRate.findOne.mockResolvedValue({ id: 5 })
    const res = mockRes()

    await addRate({ params: { contractId: 1 }, body: { service_type: 'mts', transfer_type: 'sg_jb_ground', time_of_day: 'all_hours', base_amount: 1800 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(jsonBody(res)).toMatchObject({ code: 'RATE_DUPLICATE' })
  })

  test('returns 201 with the new rate row on success', async () => {
    PricingContract.findByPk.mockResolvedValue({ id: 1 })
    PricingRate.findOne.mockResolvedValue(null)
    PricingRate.create.mockResolvedValue({ id: 15, contract_id: 1, service_type: 'mts', transfer_type: 'sg_jb_ground', time_of_day: 'all_hours', base_amount: '1800.00' })
    const res = mockRes()

    await addRate({ params: { contractId: 1 }, body: { service_type: 'mts', transfer_type: 'sg_jb_ground', time_of_day: 'all_hours', base_amount: 1800 } }, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(jsonBody(res).data).toMatchObject({ id: 15, base_amount: '1800.00' })
  })
})

describe('updateRate (PUT /api/contracts/:contractId/rates/:rateId)', () => {
  test('returns 404 RATE_NOT_FOUND when no matching row exists on this contract', async () => {
    PricingRate.findOne.mockResolvedValue(null)
    const res = mockRes()

    await updateRate({ params: { contractId: 1, rateId: 999 }, body: { base_amount: 100 } }, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(jsonBody(res)).toMatchObject({ code: 'RATE_NOT_FOUND' })
  })

  test('updates base_amount and returns 200', async () => {
    const rate = { id: 15, contract_id: 1, service_type: 'mts', transfer_type: 'sg_jb_ground', time_of_day: 'all_hours', base_amount: '1800.00' }
    rate.update = jest.fn(async (updates) => Object.assign(rate, updates))
    PricingRate.findOne.mockResolvedValue(rate)
    const res = mockRes()

    await updateRate({ params: { contractId: 1, rateId: 15 }, body: { base_amount: 1900 } }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(jsonBody(res).data.base_amount).toBe(1900)
  })
})

describe('deleteRate (DELETE /api/contracts/:contractId/rates/:rateId)', () => {
  test('returns 404 RATE_NOT_FOUND when no matching row exists', async () => {
    PricingRate.findOne.mockResolvedValue(null)
    const res = mockRes()

    await deleteRate({ params: { contractId: 1, rateId: 999 } }, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('returns 409 RATE_IN_USE when the contract has billed (non-unmatched) invoices', async () => {
    PricingRate.findOne.mockResolvedValue({ id: 15, destroy: jest.fn() })
    Invoice.count.mockResolvedValue(1)
    const res = mockRes()

    await deleteRate({ params: { contractId: 1, rateId: 15 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(jsonBody(res)).toMatchObject({ code: 'RATE_IN_USE' })
  })

  test('deletes the row and returns 200 when no billed invoices exist', async () => {
    const rate = { id: 15, destroy: jest.fn().mockResolvedValue() }
    PricingRate.findOne.mockResolvedValue(rate)
    Invoice.count.mockResolvedValue(0)
    const res = mockRes()

    await deleteRate({ params: { contractId: 1, rateId: 15 } }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(rate.destroy).toHaveBeenCalled()
  })
})

describe('updateSurcharge (PUT /api/contracts/:contractId/surcharges/:surchargeId)', () => {
  test('returns 404 SURCHARGE_NOT_FOUND when no matching row exists', async () => {
    SurchargeSchedule.findOne.mockResolvedValue(null)
    const res = mockRes()

    await updateSurcharge({ params: { contractId: 1, surchargeId: 999 }, body: { amount: 100 } }, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(jsonBody(res)).toMatchObject({ code: 'SURCHARGE_NOT_FOUND' })
  })

  test('updates the amount and returns 200', async () => {
    const surcharge = { id: 5, contract_id: 1, surcharge_type: 'resuscitation', amount: '320.00' }
    surcharge.update = jest.fn(async (updates) => Object.assign(surcharge, updates))
    SurchargeSchedule.findOne.mockResolvedValue(surcharge)
    const res = mockRes()

    await updateSurcharge({ params: { contractId: 1, surchargeId: 5 }, body: { amount: 350 } }, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(jsonBody(res).data.amount).toBe(350)
  })
})
