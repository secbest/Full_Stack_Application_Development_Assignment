const { intakeCreateSchema, intakeConfirmSchema } = require('../../src/validators')

const customerIntake = {
  customer_name: 'John Tan',
  contact_email: 'john.tan@example.com',
  contact_phone: '91234567',
  service_type: 'eas',
  preferred_date: '2026-09-01',
  preferred_time: '10:00',
  pickup_location: 'Changi General Hospital',
  destination: 'Singapore General Hospital',
}

describe('customer intake service-tier ownership', () => {
  test('customer intake is valid without a service tier', async () => {
    await expect(intakeCreateSchema.validate(customerIntake)).resolves.toMatchObject(customerIntake)
  })

  test('quotations confirmation requires a service tier', async () => {
    await expect(intakeConfirmSchema.validate({
      pricing_source: 'one_off_quote',
      quoted_transfer_type: 'one_way_hospital',
      quoted_time_of_day: 'office_hours',
      quoted_base_amount: 650,
    })).rejects.toThrow('Service tier is required')
    await expect(intakeConfirmSchema.validate({
      service_tier: 'advanced',
      pricing_source: 'one_off_quote',
      quoted_transfer_type: 'one_way_hospital',
      quoted_time_of_day: 'office_hours',
      quoted_base_amount: 650,
    })).resolves.toMatchObject({ service_tier: 'advanced', quoted_base_amount: 650 })
  })

  test('one-off pricing requires a positive agreed amount while contract pricing does not accept one', async () => {
    const base = {
      service_tier: 'advanced',
      pricing_source: 'one_off_quote',
      quoted_transfer_type: 'one_way_hospital',
      quoted_time_of_day: 'office_hours',
    }
    await expect(intakeConfirmSchema.validate(base)).rejects.toThrow('Quoted base amount is required')
    await expect(intakeConfirmSchema.validate({ ...base, pricing_source: 'contract', quoted_base_amount: 999 }))
      .resolves.not.toHaveProperty('quoted_base_amount')
  })
})
