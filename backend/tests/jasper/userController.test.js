// backend/tests/jasper/userController.test.js
// Controller unit tests: models, bcrypt, and the shared token signer are all mocked,
// so these run without a live database - same pattern as contractController.test.js.
const { Op } = require('sequelize')

jest.mock('../../src/models', () => ({
  User: { findOne: jest.fn(), findByPk: jest.fn() },
}))
jest.mock('../../src/utils/token', () => ({
  signToken: jest.fn(() => 'signed.jwt.token'),
}))
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}))

const bcrypt = require('bcryptjs')
const { User } = require('../../src/models')
const { signToken } = require('../../src/utils/token')
const { updateProfile, updatePassword } = require('../../src/controllers/userController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => {
  jest.clearAllMocks()
})

let consoleErrorSpy
beforeAll(() => { consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}) })
afterAll(() => { consoleErrorSpy.mockRestore() })

describe('updateProfile (PATCH /api/users/me)', () => {
  test('updates name/email and returns a re-signed token', async () => {
    User.findOne.mockResolvedValue(null)
    const userInstance = { id: 7, name: 'Old Name', email: 'old@efar.com', role: 'ar_specialist', save: jest.fn().mockResolvedValue() }
    User.findByPk.mockResolvedValue(userInstance)

    const req = { user: { sub: 7 }, body: { name: 'New Name', email: 'new@efar.com' } }
    const res = mockRes()

    await updateProfile(req, res)

    expect(userInstance.name).toBe('New Name')
    expect(userInstance.email).toBe('new@efar.com')
    expect(userInstance.save).toHaveBeenCalled()
    expect(signToken).toHaveBeenCalledWith(userInstance)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(jsonBody(res)).toMatchObject({
      success: true,
      data: { token: 'signed.jwt.token', user: { id: 7, name: 'New Name', email: 'new@efar.com', role: 'ar_specialist' } },
    })
  })

  test('rejects with 409 when another user already has the requested email', async () => {
    User.findOne.mockResolvedValue({ id: 99, email: 'taken@efar.com' })

    const req = { user: { sub: 7 }, body: { name: 'New Name', email: 'taken@efar.com' } }
    const res = mockRes()

    await updateProfile(req, res)

    expect(User.findByPk).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(409)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'EMAIL_IN_USE' })
  })

  test('excludes the current user from the email conflict check', async () => {
    User.findOne.mockResolvedValue(null)
    const userInstance = { id: 7, name: 'Old Name', email: 'old@efar.com', role: 'ar_specialist', save: jest.fn().mockResolvedValue() }
    User.findByPk.mockResolvedValue(userInstance)

    const req = { user: { sub: 7 }, body: { name: 'Old Name', email: 'old@efar.com' } }
    await updateProfile(req, mockRes())

    expect(User.findOne).toHaveBeenCalledWith({
      where: { email: 'old@efar.com', id: { [Op.ne]: 7 } },
    })
  })
})

describe('updatePassword (PATCH /api/users/me/password)', () => {
  test('updates the password when the current password is correct', async () => {
    const userInstance = { id: 7, password: 'hashed-old-password', save: jest.fn().mockResolvedValue() }
    User.findByPk.mockResolvedValue(userInstance)
    bcrypt.compare.mockResolvedValue(true)
    bcrypt.hash.mockResolvedValue('hashed-new-password')

    const req = { user: { sub: 7 }, body: { currentPassword: 'oldpass1', newPassword: 'newpass1' } }
    const res = mockRes()

    await updatePassword(req, res)

    expect(bcrypt.compare).toHaveBeenCalledWith('oldpass1', 'hashed-old-password')
    expect(bcrypt.hash).toHaveBeenCalledWith('newpass1', 12)
    expect(userInstance.password).toBe('hashed-new-password')
    expect(userInstance.save).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(jsonBody(res)).toMatchObject({ success: true })
  })

  test('rejects with 401 when the current password is wrong', async () => {
    const userInstance = { id: 7, password: 'hashed-old-password', save: jest.fn() }
    User.findByPk.mockResolvedValue(userInstance)
    bcrypt.compare.mockResolvedValue(false)

    const req = { user: { sub: 7 }, body: { currentPassword: 'wrongpass', newPassword: 'newpass1' } }
    const res = mockRes()

    await updatePassword(req, res)

    expect(userInstance.save).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'INVALID_CREDENTIALS' })
  })
})
