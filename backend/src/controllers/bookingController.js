// Minimal read-only booking endpoints to unblock the Field Crew "My Jobs" screen.
// Zheng Bao owns full booking management (create, confirm, reject, crew assignment) -
// these two read routes should be reconciled with his bookingRoutes.js once it lands;
// they deliberately only cover what Liang Yi's UC-01 job queue needs in the meantime.
const { Op } = require('sequelize')
const { Booking, Client } = require('../models')
const { success, notFound, forbidden } = require('../utils')

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
function toDateOnly(date) {
  return date.toISOString().slice(0, 10)
}

async function listMyJobs(req, res) {
  const { date_filter } = req.query // 'today' | 'tomorrow' | 'this_week' | undefined (all upcoming)
  const where = { assigned_crew_id: req.user.sub }

  const today = startOfDay(new Date())
  if (date_filter === 'today') {
    where.scheduled_date = toDateOnly(today)
  } else if (date_filter === 'tomorrow') {
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    where.scheduled_date = toDateOnly(tomorrow)
  } else if (date_filter === 'this_week') {
    const endOfWeek = new Date(today)
    endOfWeek.setDate(today.getDate() + (6 - today.getDay()))
    where.scheduled_date = { [Op.between]: [toDateOnly(today), toDateOnly(endOfWeek)] }
  }

  const bookings = await Booking.findAll({
    where,
    include: [{ model: Client, attributes: ['id', 'name'] }],
    order: [['scheduled_date', 'ASC'], ['scheduled_time', 'ASC']],
  })

  return success(res, bookings.map((b) => ({
    id: b.id,
    reference_number: b.reference_number,
    client: b.Client ? { id: b.Client.id, name: b.Client.name } : null,
    service_type: b.service_type,
    service_tier: b.service_tier,
    scheduled_date: b.scheduled_date,
    scheduled_time: b.scheduled_time,
    pickup_location: b.pickup_location,
    destination: b.destination,
    status: b.status,
  })))
}

async function getBookingById(req, res) {
  const booking = await Booking.findByPk(req.params.id, {
    include: [{ model: Client, attributes: ['id', 'name'] }],
  })
  if (!booking) return notFound(res, 'Booking not found.')
  if (req.user.role === 'field_crew' && booking.assigned_crew_id !== req.user.sub) {
    return forbidden(res, 'This booking is not assigned to you.')
  }

  return success(res, {
    id: booking.id,
    reference_number: booking.reference_number,
    client: booking.Client ? { id: booking.Client.id, name: booking.Client.name } : null,
    service_type: booking.service_type,
    service_tier: booking.service_tier,
    scheduled_date: booking.scheduled_date,
    scheduled_time: booking.scheduled_time,
    pickup_location: booking.pickup_location,
    destination: booking.destination,
    status: booking.status,
  })
}

module.exports = { listMyJobs, getBookingById }
