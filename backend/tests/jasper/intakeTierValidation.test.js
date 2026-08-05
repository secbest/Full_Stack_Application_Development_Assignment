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
    await expect(intakeConfirmSchema.validate({})).rejects.toThrow('Service tier is required')
    await expect(intakeConfirmSchema.validate({ service_tier: 'advanced' })).resolves.toMatchObject({ service_tier: 'advanced' })
  })
})
