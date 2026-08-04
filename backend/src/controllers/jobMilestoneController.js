// Owner: Jasper (Wave 2 field ops - client feedback item 1, interim review 17 Jul 2026).
// POST /api/bookings/:id/milestone - the crew taps a button as each job stage happens
// and the server timestamps it. Replaces end-of-day hand-typed times, which EFAR called
// out as the source of pricing errors and revenue leakage.
const sequelize = require('../config')
const { Booking, JobMilestone } = require('../models')
const { created, error, internalError } = require('../utils')

// Field reality is strictly sequential (a crew cannot arrive at the destination before
// going en route), and the memo wizard derives job start/end from these rows - so the
// order is enforced here rather than trusted to the UI.
const MILESTONE_SEQUENCE = ['activated', 'arrived_at_location', 'en_route', 'arrived_at_destination', 'job_completed']

const bySequence = (a, b) =>
  MILESTONE_SEQUENCE.indexOf(a.milestone_type) - MILESTONE_SEQUENCE.indexOf(b.milestone_type)

function serializeMilestones(rows) {
  return [...rows].sort(bySequence).map((m) => ({
    milestone_type: m.milestone_type,
    recorded_at: m.recorded_at,
  }))
}

async function recordMilestone(req, res) {
  try {
    const booking = await Booking.findByPk(req.params.id)

    // Same blurred 404 as createServiceMemo - "doesn't exist" and "not this crew
    // member's job" are deliberately indistinguishable so booking ids can't be probed.
    const isOwnBooking = booking && (req.user.role !== 'field_crew' || booking.assigned_crew_id === req.user.sub)
    if (!isOwnBooking) {
      return error(res, 'Booking not found or not assigned to this crew member.', 'BOOKING_NOT_FOUND', 404)
    }

    if (!['confirmed', 'in_progress'].includes(booking.status)) {
      return error(res, `Milestones can no longer be recorded - this job is already ${booking.status}.`, 'BOOKING_ALREADY_COMPLETED', 409)
    }

    const { milestone_type } = req.body
    const existing = await JobMilestone.findAll({ where: { booking_id: booking.id } })
    const recorded = new Set(existing.map((m) => m.milestone_type))

    if (recorded.has(milestone_type)) {
      return error(res, 'This milestone has already been recorded for this job.', 'MILESTONE_ALREADY_RECORDED', 409)
    }

    const position = MILESTONE_SEQUENCE.indexOf(milestone_type)
    const missingEarlier = MILESTONE_SEQUENCE.slice(0, position).filter((t) => !recorded.has(t))
    if (missingEarlier.length > 0) {
      return error(res, `Milestones must be recorded in order - record ${missingEarlier[0]} first.`, 'MILESTONE_OUT_OF_ORDER', 409)
    }

    await sequelize.transaction(async (t) => {
      await JobMilestone.create(
        {
          booking_id: booking.id,
          milestone_type,
          recorded_at: new Date(), // server time - the tap IS the event
          recorded_by: req.user.sub,
        },
        { transaction: t }
      )
      // 'activated' is the real "start job" trigger: it moves a confirmed booking to
      // in_progress (previously this only happened as a side effect of crew assignment).
      if (milestone_type === 'activated' && booking.status === 'confirmed') {
        await booking.update({ status: 'in_progress' }, { transaction: t })
      }
    })

    const milestones = await JobMilestone.findAll({ where: { booking_id: booking.id } })
    return created(res, {
      booking_id: booking.id,
      status: booking.status,
      milestones: serializeMilestones(milestones),
    })
  } catch (err) {
    return internalError(res, err)
  }
}

module.exports = { recordMilestone, MILESTONE_SEQUENCE, serializeMilestones }
