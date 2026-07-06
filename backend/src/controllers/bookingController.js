const { Op } = require('sequelize')
const { Booking, Client, User } = require('../models')
const { success, error, notFound } = require('../utils')
const { bookingCrewSchema } = require('../validators')

async function listBookings(req, res) {
  try {
    const { status, service_type, service_tier, client_id, assigned_crew_id, from_date, to_date, search, page = 1, limit = 20 } = req.query
    const where = {}
    if (status) where.status = status
    if (service_type) where.service_type = service_type
    if (service_tier) where.service_tier = service_tier
    if (client_id) where.client_id = client_id
    if (assigned_crew_id) where.assigned_crew_id = assigned_crew_id
    if (from_date || to_date) where.scheduled_date = {}
    if (from_date) where.scheduled_date[Op.gte] = from_date
    if (to_date) where.scheduled_date[Op.lte] = to_date
    if (search) {
      where[Op.or] = [
        { reference_number: { [Op.iLike]: `%${search}%` } },
        { '$Client.name$': { [Op.iLike]: `%${search}%` } },
      ]
    }

    const offset = (Number(page) - 1) * Number(limit)
    const { rows, count } = await Booking.findAndCountAll({
      where,
      include: [{ model: Client, attributes: ['name'] }, { model: User, as: 'assignedCrew', attributes: ['id', 'name'] }],
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset,
      distinct: true,
    })

    return success(res, {
      data: rows.map((booking) => ({
        id: booking.id,
        reference_number: booking.reference_number,
        client_name: booking.Client?.name || null,
        service_type: booking.service_type,
        service_tier: booking.service_tier,
        scheduled_date: booking.scheduled_date,
        scheduled_time: booking.scheduled_time,
        assigned_crew_name: booking.assignedCrew?.name || null,
        status: booking.status,
        has_memo: false,
        has_invoice: false,
        memo_pending_hours: null,
        created_at: booking.createdAt,
      })),
      meta: { total: count, page: Number(page), limit: Number(limit) },
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

async function getBookingById(req, res) {
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: [
        { model: Client, attributes: ['id', 'name'] },
        { model: User, as: 'assignedCrew', attributes: ['id', 'name'] },
      ],
    })
    if (!booking) return notFound(res, 'Booking not found.')
    return success(res, {
      id: booking.id,
      reference_number: booking.reference_number,
      intake_submission_id: booking.intake_submission_id,
      client_id: booking.client_id,
      client_name: booking.Client?.name || null,
      service_type: booking.service_type,
      service_tier: booking.service_tier,
      original_service_tier: booking.original_service_tier,
      scheduled_date: booking.scheduled_date,
      scheduled_time: booking.scheduled_time,
      pickup_location: booking.pickup_location,
      destination: booking.destination,
      assigned_crew_id: booking.assigned_crew_id,
      assigned_crew_name: booking.assignedCrew?.name || null,
      status: booking.status,
      notes: booking.notes,
      created_by: booking.created_by,
      created_at: booking.createdAt,
      updated_at: booking.updatedAt,
      linked_memo: null,
      linked_invoice: null,
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

async function updateBookingCrew(req, res) {
  try {
    const body = await bookingCrewSchema.validate(req.body, { abortEarly: false, stripUnknown: true })
    const booking = await Booking.findByPk(req.params.id, {
      include: [{ model: User, as: 'assignedCrew', attributes: ['id', 'name'] }],
    })
    if (!booking) return notFound(res, 'Booking not found.')
    if (['completed', 'invoiced'].includes(booking.status)) {
      return error(res, 'Crew reassignment is not allowed for completed or invoiced bookings.', 'BOOKING_COMPLETED', 409)
    }

    let assignedCrewId = null
    if (body.assigned_crew_id !== null) {
      const crew = await User.findOne({ where: { id: body.assigned_crew_id, role: 'field_crew' } })
      if (!crew) return error(res, 'Crew member not found.', 'CREW_NOT_FOUND', 404)
      assignedCrewId = crew.id
    }

    await booking.update({ assigned_crew_id: assignedCrewId })
    await booking.reload({ include: [{ model: User, as: 'assignedCrew', attributes: ['id', 'name'] }] })

    return success(res, {
      id: booking.id,
      reference_number: booking.reference_number,
      assigned_crew_id: booking.assigned_crew_id,
      assigned_crew_name: booking.assignedCrew?.name || null,
      status: booking.status,
    })
  } catch (err) {
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 400)
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

module.exports = { listBookings, getBookingById, updateBookingCrew }
