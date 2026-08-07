jest.mock('../../src/models', () => ({
  GeocodedLocation: { findOne: jest.fn(), create: jest.fn() },
}))

const { GeocodedLocation } = require('../../src/models')
const { geocodeAddress } = require('../../src/services/geocodingService')

const ORIGINAL_ENV = process.env.GOOGLE_GEOCODING_API_KEY
const ORIGINAL_FETCH = global.fetch

beforeEach(() => {
  jest.clearAllMocks()
  process.env.GOOGLE_GEOCODING_API_KEY = 'test-key'
})

afterAll(() => {
  process.env.GOOGLE_GEOCODING_API_KEY = ORIGINAL_ENV
  global.fetch = ORIGINAL_FETCH
})

describe('geocodeAddress', () => {
  test('returns the cached lat/lng without calling the Geocoding API when the address was already geocoded', async () => {
    GeocodedLocation.findOne.mockResolvedValue({ lat: '1.290300', lng: '103.851800' })
    global.fetch = jest.fn()

    const result = await geocodeAddress('1 Raffles Place, Singapore')

    expect(result).toEqual({ lat: 1.2903, lng: 103.8518 })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(GeocodedLocation.create).not.toHaveBeenCalled()
  })

  test('calls the Geocoding API and caches the result on a cache miss', async () => {
    GeocodedLocation.findOne.mockResolvedValue(null)
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({
        status: 'OK',
        results: [{ geometry: { location: { lat: 1.35, lng: 103.82 } } }],
      }),
    })

    const result = await geocodeAddress('180 Ang Mo Kio Ave 8, Singapore')

    expect(result).toEqual({ lat: 1.35, lng: 103.82 })
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(GeocodedLocation.create).toHaveBeenCalledWith({
      address_text: '180 Ang Mo Kio Ave 8, Singapore',
      lat: 1.35,
      lng: 103.82,
      geocoded_at: expect.any(Date),
    })
  })

  test('throws when the Geocoding API returns a non-OK status', async () => {
    GeocodedLocation.findOne.mockResolvedValue(null)
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ status: 'ZERO_RESULTS', results: [] }),
    })

    await expect(geocodeAddress('not a real address')).rejects.toThrow('Geocoding failed')
  })

  test('throws a config error when GOOGLE_GEOCODING_API_KEY is not set', async () => {
    delete process.env.GOOGLE_GEOCODING_API_KEY
    GeocodedLocation.findOne.mockResolvedValue(null)
    global.fetch = jest.fn()

    await expect(geocodeAddress('somewhere')).rejects.toThrow('GOOGLE_GEOCODING_API_KEY')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('does not throw when create races another concurrent geocode of the same address', async () => {
    GeocodedLocation.findOne.mockResolvedValue(null)
    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({
        status: 'OK',
        results: [{ geometry: { location: { lat: 1.29, lng: 103.85 } } }],
      }),
    })
    const raceErr = new Error('duplicate key')
    raceErr.name = 'SequelizeUniqueConstraintError'
    GeocodedLocation.create.mockRejectedValue(raceErr)

    const result = await geocodeAddress('EFAR HQ')

    expect(result).toEqual({ lat: 1.29, lng: 103.85 })
  })
})
