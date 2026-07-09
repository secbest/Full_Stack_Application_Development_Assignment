// Jasper - Pricing Contracts (Wave 2B). Pure Yup schema tests, no mocking needed -
// these mirror the exact enums/messages contractRoutes.js's `validate()` middleware
// checks requests against before a request ever reaches contractController.
const {
  createContractSchema,
  updateContractSchema,
  listContractsQuerySchema,
  addRateSchema,
  updateRateSchema,
  updateSurchargeSchema,
} = require('../../src/validators/contractValidators')

function validBody(overrides = {}) {
  return {
    client_id: 1,
    contract_name: 'TTSH - FY2027 Service Agreement',
    effective_from: '2027-01-01',
    effective_to: '2027-12-31',
    ...overrides,
  }
}

describe('createContractSchema (UC-01)', () => {
  test('accepts a valid body with no rates/surcharges, defaulting both to []', async () => {
    const result = await createContractSchema.validate(validBody())
    expect(result.rates).toEqual([])
    expect(result.surcharges).toEqual([])
  })

  test('accepts a valid body with rates and surcharges', async () => {
    await expect(createContractSchema.validate(validBody({
      rates: [{ service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: 850 }],
      surcharges: [{ surcharge_type: 'oxygen_base', amount: 50 }],
    }))).resolves.toBeTruthy()
  })

  test('rejects a missing contract_name', async () => {
    const { contract_name, ...body } = validBody()
    await expect(createContractSchema.validate(body)).rejects.toThrow('contract_name is required')
  })

  test('rejects a non-positive client_id', async () => {
    await expect(createContractSchema.validate(validBody({ client_id: -1 }))).rejects.toThrow()
  })

  test('rejects effective_to before effective_from', async () => {
    await expect(
      createContractSchema.validate(validBody({ effective_from: '2027-06-01', effective_to: '2027-01-01' }))
    ).rejects.toThrow('effective_to must be on or after effective_from.')
  })

  test('rejects effective_to equal to effective_from is allowed (single-day contract)', async () => {
    await expect(
      createContractSchema.validate(validBody({ effective_from: '2027-06-01', effective_to: '2027-06-01' }))
    ).resolves.toBeTruthy()
  })

  test('rejects a date not in YYYY-MM-DD format', async () => {
    await expect(createContractSchema.validate(validBody({ effective_from: '01/01/2027' }))).rejects.toThrow(
      'effective_from must be in YYYY-MM-DD format'
    )
  })

  test('rejects an invalid rate row nested in rates[]', async () => {
    await expect(
      createContractSchema.validate(validBody({
        rates: [{ service_type: 'not_a_real_type', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: 850 }],
      }))
    ).rejects.toThrow(/service_type must be one of/)
  })

  test('rejects a negative rate base_amount', async () => {
    await expect(
      createContractSchema.validate(validBody({
        rates: [{ service_type: 'eas', transfer_type: 'one_way_hospital', time_of_day: 'office_hours', base_amount: -1 }],
      }))
    ).rejects.toThrow('base_amount must be a positive number')
  })

  test('rejects a negative surcharge amount', async () => {
    await expect(
      createContractSchema.validate(validBody({ surcharges: [{ surcharge_type: 'oxygen_base', amount: -1 }] }))
    ).rejects.toThrow('amount cannot be negative')
  })

  test('accepts a surcharge amount of exactly 0', async () => {
    await expect(
      createContractSchema.validate(validBody({ surcharges: [{ surcharge_type: 'oxygen_base', amount: 0 }] }))
    ).resolves.toBeTruthy()
  })
})

describe('updateContractSchema (UC-02)', () => {
  test('accepts an empty body - every field is optional for a partial PATCH', async () => {
    await expect(updateContractSchema.validate({})).resolves.toBeTruthy()
  })

  test('defaults acknowledge_matched_invoices to false when omitted', async () => {
    const result = await updateContractSchema.validate({})
    expect(result.acknowledge_matched_invoices).toBe(false)
  })

  test('accepts acknowledge_matched_invoices=true alongside a date change', async () => {
    const result = await updateContractSchema.validate({ effective_to: '2026-09-30', acknowledge_matched_invoices: true })
    expect(result.acknowledge_matched_invoices).toBe(true)
  })

  test('rejects a malformed effective_to date', async () => {
    await expect(updateContractSchema.validate({ effective_to: 'not-a-date' })).rejects.toThrow(
      'effective_to must be in YYYY-MM-DD format'
    )
  })

  test('rejects a non-boolean is_active', async () => {
    await expect(updateContractSchema.validate({ is_active: 'yes' })).rejects.toThrow()
  })
})

describe('listContractsQuerySchema', () => {
  test('defaults page to 1 and limit to 20 when omitted', async () => {
    const result = await listContractsQuerySchema.validate({})
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
  })

  test('rejects a limit above 100', async () => {
    await expect(listContractsQuerySchema.validate({ limit: 101 })).rejects.toThrow()
  })

  test('rejects a page below 1', async () => {
    await expect(listContractsQuerySchema.validate({ page: 0 })).rejects.toThrow()
  })
})

describe('addRateSchema (POST rates)', () => {
  test('accepts a valid rate row', async () => {
    await expect(
      addRateSchema.validate({ service_type: 'mts', transfer_type: 'sg_jb_ground', time_of_day: 'all_hours', base_amount: 1800 })
    ).resolves.toBeTruthy()
  })

  test('rejects a missing time_of_day', async () => {
    await expect(
      addRateSchema.validate({ service_type: 'mts', transfer_type: 'sg_jb_ground', base_amount: 1800 })
    ).rejects.toThrow('time_of_day is required')
  })
})

describe('updateRateSchema (PUT rates/:rateId)', () => {
  test('rejects a zero base_amount (must be positive, not just non-negative)', async () => {
    await expect(updateRateSchema.validate({ base_amount: 0 })).rejects.toThrow('base_amount must be a positive number')
  })

  test('accepts a positive base_amount', async () => {
    await expect(updateRateSchema.validate({ base_amount: 1900 })).resolves.toBeTruthy()
  })
})

describe('updateSurchargeSchema (PUT surcharges/:surchargeId)', () => {
  test('accepts amount=0 (min(0), unlike rates which require positive())', async () => {
    await expect(updateSurchargeSchema.validate({ amount: 0 })).resolves.toBeTruthy()
  })

  test('rejects a negative amount', async () => {
    await expect(updateSurchargeSchema.validate({ amount: -5 })).rejects.toThrow('amount cannot be negative')
  })

  test('rejects a missing amount', async () => {
    await expect(updateSurchargeSchema.validate({})).rejects.toThrow('amount is required')
  })
})
