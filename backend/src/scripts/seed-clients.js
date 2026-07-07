// Seeds demo client records into Supabase.
// Uses findOrCreate - safe to run multiple times; will not duplicate rows.
//
// Usage:  node src/scripts/seed-clients.js
require('dotenv').config()
const sequelize = require('../config')
const Client = require('../models/Client')

const DEMO_CLIENTS = [
  {
    // Matches the organisation on the seeded intake submissions (see seed-intakes.js)
    // so seed-bookings.js can link confirmed bookings to a real client record.
    name: 'Tan Tock Seng Hospital',
    contact_email: 'ops@ttsh.com.sg',
    contact_phone: '+65 6357 7000',
    billing_address: '11 Jalan Tan Tock Seng, Singapore 308433',
  },
  {
    name: 'ABC Corporation',
    contact_email: 'admin@abc-corp.com.sg',
    contact_phone: '+65 6224 1000',
    billing_address: '10 Anson Road, Singapore 079903',
  },
  {
    name: 'Raffles Medical Group',
    contact_email: 'ops@rafflesmedical.com.sg',
    contact_phone: '+65 6311 1111',
    billing_address: '585 North Bridge Road, Raffles Hospital, Singapore 188770',
  },
  {
    name: 'Marina Bay Sands Expo',
    contact_email: 'events@marinabaysands.com',
    contact_phone: '+65 6688 8888',
    billing_address: '10 Bayfront Avenue, Singapore 018956',
  },
  {
    name: 'ST Engineering Ltd',
    contact_email: 'safety@stengg.com',
    contact_phone: '+65 6722 1818',
    billing_address: '1 Ang Mo Kio Electronics Park Road, Singapore 567710',
  },
  {
    name: 'Jurong Island Industrial Corp',
    contact_email: 'hse@jiic.com.sg',
    contact_phone: '+65 6560 6560',
    billing_address: '31 Jurong Island Highway, Singapore 627831',
  },
  {
    name: 'Singapore Sports Hub',
    contact_email: 'operations@sportshuborg.sg',
    contact_phone: '+65 6333 5000',
    billing_address: '1 Stadium Drive, Singapore 397629',
  },
]

async function main() {
  try {
    console.log('[seed-clients] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[seed-clients] Connected.')

    for (const c of DEMO_CLIENTS) {
      const [, created] = await Client.findOrCreate({
        where: { contact_email: c.contact_email },
        defaults: c,
      })
      const tag = created ? '  Created' : 'Skipped (exists)'
      console.log(`[seed-clients] ${tag}: ${c.name}`)
    }

    console.log('\n[seed-clients] Done.')
  } catch (err) {
    console.error('[seed-clients] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
