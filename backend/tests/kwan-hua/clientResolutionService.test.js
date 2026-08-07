// Owner: Kwan Hua.
// Covers the intake -> client identity fix. Matching on contact_email alone let a booking
// for one organisation be billed to another whenever an email was reused.

jest.mock('../../src/models', () => ({
  Client: { findOne: jest.fn(), findOrCreate: jest.fn(), create: jest.fn() },
}))

const { Op } = require('sequelize')
const { Client } = require('../../src/models')
const { resolveClientForIntake, normaliseName } = require('../../src/services/clientResolutionService')

// Op.iLike is a Symbol key, so the pattern is unreachable via JSON.stringify.
const iLikePattern = () => Client.findOne.mock.calls[0][0].where.name[Op.iLike]

function intake(overrides = {}) {
  return {
    organisation: 'NUS',
    customer_name: 'John Tan',
    contact_email: 'shared@example.com',
    contact_phone: '91234567',
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('resolveClientForIntake - organisation bookings', () => {
  test('matches an existing client on organisation name, not on the reused email', async () => {
    Client.findOne.mockResolvedValue({ id: 12, name: 'NUS' })

    const result = await resolveClientForIntake(intake({ contact_email: 'jastkc8@gmail.com' }))

    // The exact reported bug: confirming an intake for "NUS" while reusing an email
    // already on file for "Nanyang Poly" produced a booking billed to Nanyang Poly.
    expect(result.client.id).toBe(12)
    expect(result.matchedBy).toBe('organisation')
    expect(Client.findOrCreate).not.toHaveBeenCalled()
    expect(Client.create).not.toHaveBeenCalled()
  })

  test('creates a new client when the organisation is not on file, even if the email is', async () => {
    Client.findOne.mockResolvedValue(null)
    Client.create.mockResolvedValue({ id: 30, name: 'NUS' })

    const result = await resolveClientForIntake(intake())

    expect(Client.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'NUS', contact_email: 'shared@example.com' }),
      expect.anything()
    )
    expect(result.created).toBe(true)
  })

  test('matches case- and whitespace-insensitively without wildcard leakage', async () => {
    Client.findOne.mockResolvedValue({ id: 12, name: 'NUS' })

    await resolveClientForIntake(intake({ organisation: '  nus  ' }))

    // Normalised to 'nus' - iLike with no wildcards is a case-insensitive equality test.
    expect(iLikePattern()).toBe('nus')
  })

  test('escapes % and _ so an organisation name cannot act as a wildcard', async () => {
    Client.findOne.mockResolvedValue(null)
    Client.create.mockResolvedValue({ id: 31 })

    await resolveClientForIntake(intake({ organisation: '100% Health_Care' }))

    // Unescaped, '%' and '_' would match far more rows than intended.
    expect(iLikePattern()).toBe('100\\% Health\\_Care')
  })
})

describe('resolveClientForIntake - individual bookings', () => {
  test('falls back to contact_email when there is no organisation', async () => {
    Client.findOrCreate.mockResolvedValue([{ id: 7 }, false])

    const result = await resolveClientForIntake(intake({ organisation: null }))

    // Email remains the correct identity when there is no company to identify.
    expect(Client.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { contact_email: 'shared@example.com' } })
    )
    expect(result.matchedBy).toBe('contact_email')
    expect(Client.findOne).not.toHaveBeenCalled()
  })

  test('treats a blank/whitespace organisation as absent', async () => {
    Client.findOrCreate.mockResolvedValue([{ id: 7 }, true])

    const result = await resolveClientForIntake(intake({ organisation: '   ' }))

    expect(Client.findOrCreate).toHaveBeenCalled()
    expect(result.matchedBy).toBe('created')
  })

  test('names an individual client from customer_name', async () => {
    Client.findOrCreate.mockResolvedValue([{ id: 8 }, true])

    await resolveClientForIntake(intake({ organisation: null, customer_name: 'John  Tan' }))

    expect(Client.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ defaults: expect.objectContaining({ name: 'John Tan' }) })
    )
  })
})

describe('normaliseName', () => {
  test('trims and collapses internal whitespace', () => {
    expect(normaliseName('  Nanyang   Poly  ')).toBe('Nanyang Poly')
  })

  test('returns an empty string for null/undefined', () => {
    expect(normaliseName(null)).toBe('')
    expect(normaliseName(undefined)).toBe('')
  })
})
