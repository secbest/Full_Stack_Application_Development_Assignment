// backend/tests/jasper/authRoutes.test.js
// POST /auth/register accepts an arbitrary `role` in the body, so a fully public
// registration endpoint would let anyone self-register as managing_director and then
// use that token against every other MD-only route this branch adds (Accounts
// Management, force-logout, unlock, etc). This test asserts the route wiring itself -
// authenticate + authorise(managing_director) in front of validate/register - rather
// than spinning up a full app + supertest integration harness, matching this test
// suite's controller/middleware-mock style rather than introducing a new one.
//
// Mock variable names below must start with "mock" (case-insensitive) - that's the
// escape hatch Jest's out-of-scope-variable check for jest.mock() factories requires.

const mockAuthenticate = function mockAuthenticate() {}
const mockAuthoriseReturn = function mockAuthoriseReturn() {}
const mockAuthorise = jest.fn(() => mockAuthoriseReturn)
const mockValidateReturn = function mockValidateReturn() {}
const mockValidate = jest.fn(() => mockValidateReturn)

jest.mock('../../src/middleware', () => ({
  authenticate: mockAuthenticate,
  authorise: mockAuthorise,
  validate: mockValidate,
}))

jest.mock('../../src/models', () => ({
  ROLE: { MANAGING_DIRECTOR: 'managing_director' },
}))

jest.mock('../../src/controllers/authController', () => ({
  register: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
}))

const authRoutes = require('../../src/routes/authRoutes')

describe('authRoutes - POST /register', () => {
  test('is gated behind authenticate + authorise(managing_director), ahead of the existing validate/register handlers', () => {
    expect(mockAuthorise).toHaveBeenCalledWith('managing_director')

    const layer = authRoutes.stack.find((l) => l.route && l.route.path === '/register')
    expect(layer).toBeDefined()

    const handlers = layer.route.stack.map((s) => s.handle)
    expect(handlers[0]).toBe(mockAuthenticate)
    expect(handlers[1]).toBe(mockAuthoriseReturn)
    expect(handlers[2]).toBe(mockValidateReturn)
  })
})
