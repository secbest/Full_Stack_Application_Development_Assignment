// signToken() below is exercised unmocked (unlike userController.test.js, which mocks
// utils/token.js entirely), so it reads the real DEV_JWT_SECRET from process.env. Nothing
// else in this test suite loads dotenv, so without this the secret is undefined and
// jwt.sign's second arg fails the expect.any(String) assertion - not a real product bug.
require('dotenv').config()

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'signed.jwt.token'),
  verify: jest.fn(),
}))

const jwt = require('jsonwebtoken')
const { signToken } = require('../../src/utils/token')

describe('signToken', () => {
  beforeEach(() => { jest.clearAllMocks() })

  test('embeds token_version in the JWT payload', () => {
    const user = { id: 7, name: 'Sarah Lim', email: 'sarah@efar.com.sg', role: 'ar_specialist', token_version: 3 }
    signToken(user)

    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: 7, name: 'Sarah Lim', email: 'sarah@efar.com.sg', role: 'ar_specialist', token_version: 3 },
      expect.any(String),
      { expiresIn: '8h' }
    )
  })
})

jest.mock('../../src/models', () => ({
  User: { findByPk: jest.fn() },
}))

const { User } = require('../../src/models')
const { authenticate } = require('../../src/middleware')

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() }
}

describe('authenticate', () => {
  beforeEach(() => { jest.clearAllMocks() })

  test('rejects with 401 TOKEN_REVOKED when the token_version claim does not match the DB value', async () => {
    jwt.verify.mockReturnValue({ sub: 7, role: 'ar_specialist', token_version: 1 })
    User.findByPk.mockResolvedValue({ id: 7, token_version: 2, last_active_at: new Date(), update: jest.fn() })

    const req = { headers: { authorization: 'Bearer sometoken' } }
    const res = mockRes()
    const next = jest.fn()

    await authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'TOKEN_REVOKED' }))
    expect(next).not.toHaveBeenCalled()
  })

  test('calls next() and stamps last_active_at when token_version matches and the stamp is stale', async () => {
    jwt.verify.mockReturnValue({ sub: 7, role: 'ar_specialist', token_version: 2 })
    const update = jest.fn().mockResolvedValue()
    User.findByPk.mockResolvedValue({ id: 7, token_version: 2, last_active_at: new Date(Date.now() - 120_000), update })

    const req = { headers: { authorization: 'Bearer sometoken' } }
    const res = mockRes()
    const next = jest.fn()

    await authenticate(req, res, next)

    expect(update).toHaveBeenCalledWith({ last_active_at: expect.any(Date) })
    expect(req.user).toEqual({ sub: 7, role: 'ar_specialist', token_version: 2 })
    expect(next).toHaveBeenCalled()
  })

  test('skips the last_active_at write when the existing stamp is fresh', async () => {
    jwt.verify.mockReturnValue({ sub: 7, role: 'ar_specialist', token_version: 2 })
    const update = jest.fn()
    User.findByPk.mockResolvedValue({ id: 7, token_version: 2, last_active_at: new Date(), update })

    const req = { headers: { authorization: 'Bearer sometoken' } }
    const next = jest.fn()

    await authenticate(req, mockRes(), next)

    expect(update).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalled()
  })
})
