jest.mock('../../src/models', () => ({
  User: { findOne: jest.fn() },
}))
jest.mock('../../src/utils/token', () => ({
  signToken: jest.fn(() => 'signed.jwt.token'),
}))
jest.mock('bcryptjs', () => ({ compare: jest.fn() }))

const bcrypt = require('bcryptjs')
const { User } = require('../../src/models')
const { login } = require('../../src/controllers/authController')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}
function jsonBody(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => { jest.clearAllMocks() })

describe('login lockout', () => {
  test('rejects a locked account with 403 ACCOUNT_LOCKED even with the correct password', async () => {
    User.findOne.mockResolvedValue({ id: 7, email: 'sarah@efar.com.sg', password: 'hash', is_locked: true, failed_login_count: 5 })

    const req = { body: { email: 'sarah@efar.com.sg', password: 'correct-password' } }
    const res = mockRes()
    await login(req, res)

    expect(bcrypt.compare).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
    expect(jsonBody(res)).toMatchObject({ success: false, code: 'ACCOUNT_LOCKED' })
  })

  test('increments failed_login_count on a wrong password without locking below the threshold', async () => {
    const update = jest.fn().mockResolvedValue()
    User.findOne.mockResolvedValue({ id: 7, email: 'sarah@efar.com.sg', password: 'hash', is_locked: false, failed_login_count: 2, update })
    bcrypt.compare.mockResolvedValue(false)

    const req = { body: { email: 'sarah@efar.com.sg', password: 'wrong' } }
    await login(req, mockRes())

    expect(update).toHaveBeenCalledWith({ failed_login_count: 3, is_locked: false })
  })

  test('locks the account on the 5th consecutive failed attempt', async () => {
    const update = jest.fn().mockResolvedValue()
    User.findOne.mockResolvedValue({ id: 7, email: 'sarah@efar.com.sg', password: 'hash', is_locked: false, failed_login_count: 4, update })
    bcrypt.compare.mockResolvedValue(false)

    const req = { body: { email: 'sarah@efar.com.sg', password: 'wrong' } }
    await login(req, mockRes())

    expect(update).toHaveBeenCalledWith({ failed_login_count: 5, is_locked: true })
  })

  test('resets failed_login_count and stamps last_login_at/last_active_at on success', async () => {
    const update = jest.fn().mockResolvedValue()
    const user = { id: 7, name: 'Sarah Lim', email: 'sarah@efar.com.sg', role: 'ar_specialist', password: 'hash', is_locked: false, failed_login_count: 2, token_version: 0, update }
    User.findOne.mockResolvedValue(user)
    bcrypt.compare.mockResolvedValue(true)

    const req = { body: { email: 'sarah@efar.com.sg', password: 'correct-password' } }
    const res = mockRes()
    await login(req, res)

    expect(update).toHaveBeenCalledWith({ failed_login_count: 0, last_login_at: expect.any(Date), last_active_at: expect.any(Date) })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(jsonBody(res)).toMatchObject({ success: true, data: { token: 'signed.jwt.token' } })
  })
})
