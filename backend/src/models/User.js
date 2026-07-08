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
  email:    { type: DataTypes.STRING(255), allowNull: false, unique: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  role:     { type: DataTypes.ENUM(...ROLES), allowNull: false },
}, {
  tableName: 'users',
  underscored: true,
})

module.exports = { User, ROLES, ROLE }
