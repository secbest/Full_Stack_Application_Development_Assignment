const { registerSchema } = require('../../src/validators')

describe('registerSchema', () => {
  test('accepts an @efar.com.sg email', async () => {
    await expect(
      registerSchema.validate({ name: 'Jasper Tan', email: 'jasper@efar.com.sg', password: 'password1', role: 'ar_specialist' })
    ).resolves.toMatchObject({ email: 'jasper@efar.com.sg' })
  })

  test('rejects a validly-formatted email outside the efar.com.sg domain', async () => {
    await expect(
      registerSchema.validate({ name: 'Jasper Tan', email: 'jasper@gmail.com', password: 'password1', role: 'ar_specialist' })
    ).rejects.toThrow('Email must be an @efar.com.sg address')
  })
})
