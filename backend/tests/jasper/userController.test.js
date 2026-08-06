// backend/tests/jasper/userController.test.js
// Controller unit tests: models, bcrypt, and the shared token signer are all mocked,
// so these run without a live database - same pattern as contractController.test.js.
const { Op } = require('sequelize')

jest.mock('../../src/models', () => ({
  User: { findOne: jest.fn(), findByPk: jest.fn(), findAll: jest.fn() },
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
const { updateProfile, updatePassword, listUsers, updateUser, forceLogout, unlockUser } = require('../../src/controllers/userController')

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

  test('revokes other sessions (bumps token_version) and returns a fresh token for the caller', async () => {
    const userInstance = { id: 7, password: 'hashed-old-password', token_version: 4, save: jest.fn().mockResolvedValue() }
    User.findByPk.mockResolvedValue(userInstance)
    bcrypt.compare.mockResolvedValue(true)
    bcrypt.hash.mockResolvedValue('hashed-new-password')

    const req = { user: { sub: 7 }, body: { currentPassword: 'oldpass1', newPassword: 'newpass1' } }
    const res = mockRes()

    await updatePassword(req, res)

    expect(userInstance.token_version).toBe(5)
    expect(signToken).toHaveBeenCalledWith(userInstance)
    expect(jsonBody(res)).toMatchObject({ success: true, data: { token: 'signed.jwt.token' } })
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

describe('listUsers (GET /api/users)', () => {
  test('returns the minimal shape for a non-managing_director caller', async () => {
    User.findAll.mockResolvedValue([{ id: 3, name: 'Ravi Kumar', role: 'field_crew' }])

    const req = { user: { sub: 1, role: 'quotations_specialist' }, query: {} }
    const res = mockRes()
    await listUsers(req, res)

    expect(User.findAll).toHaveBeenCalledWith({
      where: {},
      attributes: ['id', 'name', 'role'],
      order: [['name', 'ASC']],
    })
    expect(jsonBody(res)).toMatchObject({ success: true, data: [{ id: 3, name: 'Ravi Kumar', role: 'field_crew' }] })
  })

  test('returns session/security fields plus a computed is_online for a managing_director caller', async () => {
    const fiveMinutesAgo = new Date(Date.now() - 4 * 60 * 1000)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    User.findAll.mockResolvedValue([
      { id: 3, name: 'Ravi Kumar', email: 'ravi@efar.com.sg', role: 'field_crew', last_login_at: fiveMinutesAgo, last_active_at: fiveMinutesAgo, is_locked: false },
      { id: 4, name: 'Chloe Tan', email: 'chloe@efar.com.sg', role: 'ap_specialist', last_login_at: twoHoursAgo, last_active_at: twoHoursAgo, is_locked: true },
    ])

    const req = { user: { sub: 1, role: 'managing_director' }, query: {} }
    const res = mockRes()
    await listUsers(req, res)

    expect(User.findAll).toHaveBeenCalledWith({
      where: {},
      attributes: ['id', 'name', 'email', 'role', 'last_login_at', 'last_active_at', 'is_locked'],
      order: [['name', 'ASC']],
    })
    expect(jsonBody(res).data).toEqual([
      { id: 3, name: 'Ravi Kumar', email: 'ravi@efar.com.sg', role: 'field_crew', last_login_at: fiveMinutesAgo, last_active_at: fiveMinutesAgo, is_online: true, is_locked: false },
      { id: 4, name: 'Chloe Tan', email: 'chloe@efar.com.sg', role: 'ap_specialist', last_login_at: twoHoursAgo, last_active_at: twoHoursAgo, is_online: false, is_locked: true },
    ])
  })
})

describe('updateUser (PATCH /api/users/:id)', () => {
  test('updates name/email/role and returns the updated user', async () => {
    User.findOne.mockResolvedValue(null)
    const userInstance = { id: 5, name: 'Old Name', email: 'old@efar.com.sg', role: 'quotations_specialist', save: jest.fn().mockResolvedValue() }
    User.findByPk.mockResolvedValue(userInstance)

    const req = { params: { id: 5 }, body: { name: 'New Name', email: 'new@efar.com.sg', role: 'ar_specialist' } }
    const res = mockRes()
    await updateUser(req, res)

    expect(userInstance.name).toBe('New Name')
    expect(userInstance.role).toBe('ar_specialist')
    expect(userInstance.save).toHaveBeenCalled()
    expect(jsonBody(res)).toMatchObject({ success: true, data: { id: 5, name: 'New Name', email: 'new@efar.com.sg', role: 'ar_specialist' } })
  })

  test('rejects with 409 when another user already has the requested email', async () => {
    User.findByPk.mockResolvedValue({ id: 5 })
    User.findOne.mockResolvedValue({ id: 9, email: 'taken@efar.com.sg' })

    const req = { params: { id: 5 }, body: { name: 'New Name', email: 'taken@efar.com.sg', role: 'ar_specialist' } }
    const res = mockRes()
    await updateUser(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'EMAIL_IN_USE' })
  })

  test('returns 404 for an unknown user id', async () => {
    User.findByPk.mockResolvedValue(null)

    const req = { params: { id: 999 }, body: { name: 'X', email: 'x@efar.com.sg', role: 'ar_specialist' } }
    const res = mockRes()
    await updateUser(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'USER_NOT_FOUND' })
  })

  test('increments token_version by 1 when role changes, so the old JWT claim loses authority', async () => {
    User.findOne.mockResolvedValue(null)
    const userInstance = { id: 5, name: 'Old Name', email: 'old@efar.com.sg', role: 'ar_specialist', token_version: 3, save: jest.fn().mockResolvedValue() }
    User.findByPk.mockResolvedValue(userInstance)

    const req = { params: { id: 5 }, body: { name: 'Old Name', email: 'old@efar.com.sg', role: 'managing_director' } }
    await updateUser(req, mockRes())

    expect(userInstance.role).toBe('managing_director')
    expect(userInstance.token_version).toBe(4)
  })

  test('does not increment token_version when the role is unchanged', async () => {
    User.findOne.mockResolvedValue(null)
    const userInstance = { id: 5, name: 'Old Name', email: 'old@efar.com.sg', role: 'ar_specialist', token_version: 3, save: jest.fn().mockResolvedValue() }
    User.findByPk.mockResolvedValue(userInstance)

    const req = { params: { id: 5 }, body: { name: 'New Name', email: 'new@efar.com.sg', role: 'ar_specialist' } }
    await updateUser(req, mockRes())

    expect(userInstance.name).toBe('New Name')
    expect(userInstance.token_version).toBe(3)
  })
})

describe('forceLogout (POST /api/users/:id/force-logout)', () => {
  test('increments token_version', async () => {
    const update = jest.fn().mockResolvedValue()
    User.findByPk.mockResolvedValue({ id: 5, token_version: 2, update })

    const req = { user: { sub: 1 }, params: { id: 5 } }
    const res = mockRes()
    await forceLogout(req, res)

    expect(update).toHaveBeenCalledWith({ token_version: 3 })
    expect(jsonBody(res)).toMatchObject({ success: true })
  })

  test('returns 404 for an unknown user id', async () => {
    User.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await forceLogout({ user: { sub: 1 }, params: { id: 999 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('rejects with 409 CANNOT_FORCE_LOGOUT_SELF when force-logging-out one\'s own account', async () => {
    const req = { user: { sub: 5 }, params: { id: 5 } }
    const res = mockRes()
    await forceLogout(req, res)

    expect(User.findByPk).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(409)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'CANNOT_FORCE_LOGOUT_SELF' })
  })
})

describe('unlockUser (POST /api/users/:id/unlock)', () => {
  test('clears is_locked and resets failed_login_count', async () => {
    const update = jest.fn().mockResolvedValue()
    User.findByPk.mockResolvedValue({ id: 5, is_locked: true, failed_login_count: 5, update })

    const req = { params: { id: 5 } }
    const res = mockRes()
    await unlockUser(req, res)

    expect(update).toHaveBeenCalledWith({ is_locked: false, failed_login_count: 0 })
    expect(jsonBody(res)).toMatchObject({ success: true })
  })

  test('returns 404 for an unknown user id', async () => {
    User.findByPk.mockResolvedValue(null)
    const res = mockRes()
    await unlockUser({ params: { id: 999 } }, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
