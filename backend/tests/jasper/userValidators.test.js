const { updateProfileSchema, updatePasswordSchema } = require('../../src/validators/userValidators')

describe('updateProfileSchema', () => {
  test('accepts a valid name and an @efar.com.sg email', async () => {
    await expect(
      updateProfileSchema.validate({ name: 'Jasper Tan', email: 'jasper@efar.com.sg' })
    ).resolves.toEqual({ name: 'Jasper Tan', email: 'jasper@efar.com.sg' })
  })

  test('accepts an @efar.com.sg email regardless of case', async () => {
    await expect(
      updateProfileSchema.validate({ name: 'Jasper Tan', email: 'jasper@EFAR.COM.SG' })
    ).resolves.toEqual({ name: 'Jasper Tan', email: 'jasper@EFAR.COM.SG' })
  })

  test('rejects a missing name', async () => {
    await expect(
      updateProfileSchema.validate({ email: 'jasper@efar.com.sg' })
    ).rejects.toThrow('Name is required')
  })

  test('rejects an invalid email', async () => {
    await expect(
      updateProfileSchema.validate({ name: 'Jasper Tan', email: 'not-an-email' })
    ).rejects.toThrow('Must be a valid email')
  })

  test('rejects a validly-formatted email outside the efar.com.sg domain', async () => {
    await expect(
      updateProfileSchema.validate({ name: 'Jasper Tan', email: 'jasper@gmail.com' })
    ).rejects.toThrow('Email must be an @efar.com.sg address')
  })
})

describe('updatePasswordSchema', () => {
  test('accepts a valid current + new password pair', async () => {
    await expect(
      updatePasswordSchema.validate({ currentPassword: 'oldpass1', newPassword: 'newpass1' })
    ).resolves.toEqual({ currentPassword: 'oldpass1', newPassword: 'newpass1' })
  })

  test('rejects a new password shorter than 8 characters', async () => {
    await expect(
      updatePasswordSchema.validate({ currentPassword: 'oldpass1', newPassword: 'short' })
    ).rejects.toThrow('Password must be at least 8 characters')
  })

  test('rejects a missing current password', async () => {
    await expect(
      updatePasswordSchema.validate({ newPassword: 'newpass1' })
    ).rejects.toThrow('Current password is required')
  })
})
