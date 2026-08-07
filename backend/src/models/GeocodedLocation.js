const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// Owner: Jasper (Live Fleet Tracker). Caches Google Geocoding API lookups keyed by the
// exact address text so the same booking pickup_location/destination (or the fixed
// EFAR HQ address) isn't re-geocoded on every 30s fleet-tracker poll.
const GeocodedLocation = sequelize.define('GeocodedLocation', {
  id:           { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  address_text: { type: DataTypes.TEXT, allowNull: false, unique: true },
  lat:          { type: DataTypes.DECIMAL(9, 6), allowNull: false },
  lng:          { type: DataTypes.DECIMAL(9, 6), allowNull: false },
  geocoded_at:  { type: DataTypes.DATE, allowNull: false },
}, {
  tableName: 'geocoded_locations',
  underscored: true,
})

module.exports = GeocodedLocation
