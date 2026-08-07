const { GeocodedLocation } = require('../models')

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

// Fixed "home base" pin for crew who aren't on an active job (available/off_duty).
const HQ_ADDRESS = '1 Raffles Place, Singapore 048616'

function getApiKey() {
  if (!process.env.GOOGLE_GEOCODING_API_KEY) {
    const err = new Error('GOOGLE_GEOCODING_API_KEY is not configured.')
    err.code = 'GEOCODING_CONFIG_MISSING'
    throw err
  }
  return process.env.GOOGLE_GEOCODING_API_KEY
}

// Cache-first: the fleet tracker polls every 30s and most addresses (HQ, and any
// in-progress booking's pickup/destination) repeat across polls, so re-geocoding the
// same address text on every request would burn API quota for no new information.
async function geocodeAddress(addressText) {
  const cached = await GeocodedLocation.findOne({ where: { address_text: addressText } })
  if (cached) return { lat: Number(cached.lat), lng: Number(cached.lng) }

  const url = `${GEOCODE_URL}?${new URLSearchParams({ address: addressText, key: getApiKey() })}`
  const resp = await fetch(url)
  const body = await resp.json()

  if (body.status !== 'OK' || !body.results?.length) {
    const err = new Error(`Geocoding failed for "${addressText}": ${body.status}`)
    err.code = 'GEOCODING_FAILED'
    throw err
  }

  const { lat, lng } = body.results[0].geometry.location
  try {
    await GeocodedLocation.create({ address_text: addressText, lat, lng, geocoded_at: new Date() })
  } catch (err) {
    // A concurrent poll already cached the same address between our findOne and create -
    // the row exists either way, so this isn't a real failure.
    if (err.name !== 'SequelizeUniqueConstraintError') throw err
  }
  return { lat, lng }
}

module.exports = { geocodeAddress, HQ_ADDRESS }
