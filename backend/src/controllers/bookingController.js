const { Op } = require('sequelize')
const { Booking, Client, User, IntakeSubmission, ServiceMemo, Invoice } = require('../models')
const { success, error, notFound, forbidden } = require('../utils')
const { bookingCrewSchema } = require('../validators')

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
function toDateOnly(date) {
  return date.toISOString().slice(0, 10)
}

// Field Crew "My Jobs" screen - only the current user's assigned bookings.
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

// Quotations Specialist / AR / MD booking list with filters and pagination.
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
      include: [
        { model: Client, attributes: ['name'] },
        { model: User, as: 'assignedCrew', attributes: ['id', 'name'] },
        { model: User, as: 'createdBy', attributes: ['id', 'name'] },
        { model: IntakeSubmission, attributes: ['reference_number'] },
        { model: ServiceMemo, attributes: ['id', 'status'] },
        { model: Invoice, attributes: ['id', 'status'] },
      ],
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset,
      distinct: true,
    })

    return success(res, {
      data: rows.map((booking) => ({
        id: booking.id,
        reference_number: booking.reference_number,
        intake_submission_id: booking.intake_submission_id,
        intake_reference: booking.IntakeSubmission?.reference_number || null,
        client_name: booking.Client?.name || null,
        service_type: booking.service_type,
        service_tier: booking.service_tier,
        original_service_tier: booking.original_service_tier,
        scheduled_date: booking.scheduled_date,
        scheduled_time: booking.scheduled_time,
        pickup_location: booking.pickup_location,
        destination: booking.destination,
        notes: booking.notes,
        assigned_crew_name: booking.assignedCrew?.name || null,
        created_by: booking.created_by,
        created_by_name: booking.createdBy?.name || null,
        status: booking.status,
        has_memo: !!booking.ServiceMemo,
        memo_status: booking.ServiceMemo?.status || null,
        has_invoice: !!booking.Invoice,
        invoice_status: booking.Invoice?.status || null,
        memo_pending_hours: null,
        created_at: booking.createdAt,
      })),
      meta: { total: count, page: Number(page), limit: Number(limit) },
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

// Single booking detail. Field crew may only view their own assigned booking
// (used by the Memo Wizard's Booking Summary panel, which expects `client: {id, name}`).
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

    const updates = { assigned_crew_id: assignedCrewId }
    // Assigning crew to a still-'confirmed' booking is what kicks off the job - there's
    // no separate "Start Job" action for the field crew yet, so this is the one real
    // trigger for the confirmed -> in_progress transition (see Booking.js status comment).
    if (assignedCrewId && booking.status === 'confirmed') {
      updates.status = 'in_progress'
    }
    await booking.update(updates)
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

module.exports = { listMyJobs, listBookings, getBookingById, updateBookingCrew }
