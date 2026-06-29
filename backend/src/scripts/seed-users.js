// Seeds the five demo users into Supabase (one per role).
// Uses findOrCreate - safe to run multiple times; will not duplicate rows.
//
// All demo accounts share the same password: Efar@2026
//
// Usage:  node src/scripts/seed-users.js
require('dotenv').config()
const bcrypt = require('bcryptjs')
const sequelize = require('../config')
const { User } = require('../models')

const DEMO_PASSWORD = 'Efar@2026'

const DEMO_USERS = [
  { name: 'Doris Tan',    email: 'doris@efar.com.sg',   role: 'managing_director' },
  { name: 'Sarah Lim',    email: 'sarah@efar.com.sg',   role: 'ar_specialist' },
  { name: 'Chloe Tan',    email: 'chloe@efar.com.sg',   role: 'ap_specialist' },
  { name: 'Camilla Wong', email: 'camilla@efar.com.sg', role: 'quotations_specialist' },
  { name: 'Ravi Kumar',   email: 'ravi@efar.com.sg',    role: 'field_crew' },
]

async function main() {
  try {
    console.log('[seed-users] Connecting to Supabase...')
    await sequelize.authenticate()
    console.log('[seed-users] Connected.')

    const hash = await bcrypt.hash(DEMO_PASSWORD, 12)

    for (const u of DEMO_USERS) {
      const [, created] = await User.findOrCreate({
        where: { email: u.email },
        defaults: { name: u.name, email: u.email, password: hash, role: u.role },
      })
      const tag = created ? '  Created' : 'Skipped (exists)'
      console.log(`[seed-users] ${tag}: ${u.email}  (${u.role})`)
    }

    console.log('\n[seed-users] Done. Login with any account using password: Efar@2026')
  } catch (err) {
    console.error('[seed-users] Failed:', err.message)
    process.exit(1)
  } finally {
    await sequelize.close()
  }
}

main()
