const { DataTypes } = require('sequelize')
const sequelize = require('../config')

// Owner: Jasper (Wave 2 field ops - client feedback item 1, interim review 17 Jul 2026).
// One row per live milestone tap on a job. Crews record each of the five stages the
// moment it happens instead of typing times at end of day - pricing depends on these
// times ("the pricing is very dependent on the time that we pick up the patients").
// recorded_at is always server time: the tap itself is the event being captured, so
// the client never supplies a timestamp (no backdating).
// Sequence: activated -> arrived_at_location -> en_route -> arrived_at_destination
// -> job_completed (enforced in jobMilestoneController, not here).
const JobMilestone = sequelize.define('JobMilestone', {
  id:         { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  booking_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'bookings', key: 'id' } },
  milestone_type: {
    type: DataTypes.ENUM('activated', 'arrived_at_location', 'en_route', 'arrived_at_destination', 'job_completed'),
    allowNull: false,
  },
  recorded_at: { type: DataTypes.DATE, allowNull: false },
  recorded_by: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'users', key: 'id' } },
}, {
  tableName: 'job_milestones',
  underscored: true,
  indexes: [{ unique: true, fields: ['booking_id', 'milestone_type'] }],
})

module.exports = JobMilestone
