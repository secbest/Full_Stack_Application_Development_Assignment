const { DataTypes } = require('sequelize')
const sequelize = require('../config')

const ROLES = ['managing_director', 'ar_specialist', 'ap_specialist', 'quotations_specialist', 'field_crew']

// Named constants for the same values, for call sites that authorise a specific role
// (e.g. authorise(ROLE.AR_SPECIALIST)) rather than retyping the raw string. This
// doesn't make a typo impossible (ROLE.AR_SPECALIST would just silently evaluate to
// undefined, not throw) - the real benefit is IDE autocomplete: selecting a property
// from a known list is far less error-prone than freehand-typing the same string
// literal nine times across route files, where a mistyped string previously produced
// a route nobody could ever authorise into with no error anywhere.
const ROLE = {
  MANAGING_DIRECTOR: 'managing_director',
  AR_SPECIALIST: 'ar_specialist',
  AP_SPECIALIST: 'ap_specialist',
  QUOTATIONS_SPECIALIST: 'quotations_specialist',
  FIELD_CREW: 'field_crew',
}

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false,
  },
  name:     { type: DataTypes.STRING(100), allowNull: false },
  // Normalised to lowercase on every write so "Ravi@efar.com.sg" and "ravi@efar.com.sg"
  // are the same account - the unique constraint and login lookup are both case-sensitive
  // in Postgres otherwise.
  email:    {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    set(value) {
      this.setDataValue('email', typeof value === 'string' ? value.trim().toLowerCase() : value)
    },
  },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role:     { type: DataTypes.ENUM(...ROLES), allowNull: false },
  // Bumped by POST /users/:id/force-logout. Embedded in every JWT (see utils/token.js);
  // authenticate() rejects a token whose token_version doesn't match the current value,
  // so bumping this invalidates every session already issued for this user.
  token_version:      { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  last_login_at:      { type: DataTypes.DATE, allowNull: true },
  // Stamped by authenticate() (throttled - see middleware/index.js). "Currently Online"
  // on the Accounts Management screen means this is within the last 5 minutes.
  last_active_at:     { type: DataTypes.DATE, allowNull: true },
  failed_login_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  is_locked:           { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, {
  tableName: 'users',
  underscored: true,
})

module.exports = { User, ROLES, ROLE }
