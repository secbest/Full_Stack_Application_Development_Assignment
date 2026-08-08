const { Op } = require('sequelize')
const sequelize = require('../config')
const { Booking, Client, User, IntakeSubmission, ServiceMemo, Invoice, InvoiceLineItem, JobMilestone } = require('../models')
const { success, error, notFound, forbidden, internalError } = require('../utils')
const { bookingCrewSchema, bookingRejectSchema } = require('../validators')
const { serializeMilestones } = require('./jobMilestoneController')
const notificationService = require('../services/notificationService')

// Shared with dashboardController - see utils/date.js for why these must not be
// re-derived locally. The previous local copy formatted startOfDay()'s local midnight
// through toISOString(), which put My Jobs' Today/Tomorrow/This Week tabs a day behind.
const { startOfDay, toDateOnly } = require('../utils/date')

// Field Crew "My Jobs" screen - only the current user's assigned bookings.
// try/catch matters here specifically: an uncaught rejection from an async Express
// handler isn't just a failed request, it crashes the entire Node process for every
// user (see the JobMilestone-include regression test below for the incident this
// guards against).
async function listMyJobs(req, res) {
  try {
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
      include: [
        { model: Client, attributes: ['id', 'name'] },
        { model: JobMilestone, attributes: ['milestone_type', 'recorded_at'] },
      ],
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
      // Sequence-sorted (activated first) - the hero card's stepper and the memo
      // wizard's pre-fill both rely on this order, not DB insertion order.
      milestones: serializeMilestones(b.JobMilestones || []),
    })))
  } catch (err) {
    return internalError(res, err)
  }
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
        pricing_source: booking.pricing_source,
        pricing_contract_id: booking.pricing_contract_id,
        quoted_base_amount: booking.quoted_base_amount,
        quoted_transfer_type: booking.quoted_transfer_type,
        quoted_time_of_day: booking.quoted_time_of_day,
        quoted_by: booking.quoted_by,
        quoted_at: booking.quoted_at,
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
  try {
    const booking = await Booking.findByPk(req.params.id, {
      include: [
        { model: Client, attributes: ['id', 'name'] },
        { model: JobMilestone, attributes: ['milestone_type', 'recorded_at'] },
      ],
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
      quoted_transfer_type: booking.quoted_transfer_type,
      scheduled_date: booking.scheduled_date,
      scheduled_time: booking.scheduled_time,
      pickup_location: booking.pickup_location,
      destination: booking.destination,
      status: booking.status,
      milestones: serializeMilestones(booking.JobMilestones || []),
    })
  } catch (err) {
    return internalError(res, err)
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

    const previousCrewId = booking.assigned_crew_id

    let assignedCrewId = null
    if (body.assigned_crew_id !== null) {
      const crew = await User.findOne({ where: { id: body.assigned_crew_id, role: 'field_crew' } })
      if (!crew) return error(res, 'Crew member not found.', 'CREW_NOT_FOUND', 404)
      assignedCrewId = crew.id
    }

    // Status is deliberately untouched here. jobMilestoneController's 'activated' tap
    // is the sole confirmed -> in_progress trigger (see Booking.js's status comment) -
    // assigning crew no longer starts the job on its own, so a job never reads as
    // "in progress" before the crew has actually started it.
    await booking.update({ assigned_crew_id: assignedCrewId })
    await booking.reload({ include: [{ model: User, as: 'assignedCrew', attributes: ['id', 'name'] }] })

    // Notify only on a real change - re-saving the same crew member, or unassigning,
    // is not a new assignment worth interrupting anyone for.
    if (assignedCrewId && assignedCrewId !== previousCrewId) {
      await notificationService.create({
        user_id: assignedCrewId,
        type: 'job_assigned',
        title: 'New job assigned',
        body: `You have been assigned to booking ${booking.reference_number}.`,
        link: '/jobs',
      })
    }

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

// POST /api/bookings/:id/reject - field crew declining a job (current or upcoming) they
// were assigned. Sends it back to Quotations for reassignment rather than leaving it
// stuck on a crew member who can't do it - unassigns the crew, resets status to
// 'confirmed' (so it reappears in Booking List's "unassigned" filter), and wipes any
// milestones already recorded so the next crew starts the job from a clean slate.
async function rejectBooking(req, res) {
  try {
    const body = await bookingRejectSchema.validate(req.body, { abortEarly: false, stripUnknown: true })
    const booking = await Booking.findByPk(req.params.id, {
      include: [{ model: User, as: 'assignedCrew', attributes: ['id', 'name'] }],
    })

    // Same blurred 404 as recordMilestone - "doesn't exist" and "not this crew
    // member's job" are deliberately indistinguishable so booking ids can't be probed.
    const isOwnBooking = booking && (req.user.role !== 'field_crew' || booking.assigned_crew_id === req.user.sub)
    if (!isOwnBooking) {
      return error(res, 'Booking not found or not assigned to this crew member.', 'BOOKING_NOT_FOUND', 404)
    }
    if (!['confirmed', 'in_progress'].includes(booking.status)) {
      return error(res, `This job can no longer be rejected - it is already ${booking.status}.`, 'BOOKING_ALREADY_COMPLETED', 409)
    }

    const rejectingCrewName = booking.assignedCrew?.name || 'Unassigned'
    const rejectionNote = `[Rejected by ${rejectingCrewName} on ${new Date().toISOString().slice(0, 10)}] ${body.reason}`

    await sequelize.transaction(async (t) => {
      await JobMilestone.destroy({ where: { booking_id: booking.id }, transaction: t })
      await booking.update({
        assigned_crew_id: null,
        status: 'confirmed',
        notes: booking.notes ? `${booking.notes}\n${rejectionNote}` : rejectionNote,
      }, { transaction: t })
    })

    const quotationsSpecialists = await User.findAll({ where: { role: 'quotations_specialist' }, attributes: ['id'] })
    await Promise.all(quotationsSpecialists.map((u) => notificationService.create({
      user_id: u.id,
      type: 'job_rejected',
      title: 'Job rejected by field crew',
      body: `${rejectingCrewName} rejected booking ${booking.reference_number}: ${body.reason}`,
      link: '/bookings',
    })))

    return success(res, {
      id: booking.id,
      reference_number: booking.reference_number,
      status: booking.status,
      assigned_crew_id: booking.assigned_crew_id,
    })
  } catch (err) {
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 400)
    return internalError(res, err)
  }
}

// Only invoiced bookings can be deleted - by that stage Xero holds the master copy of
// the invoice, so removing the local operational record just clears completed clutter
// from the Bookings table. XeroSyncLog rows are deliberately left untouched: they're
// the last local breadcrumb that a sync happened, even after the booking/invoice/memo
// detail behind it is gone, and deleting them here has no effect on Xero itself anyway.
async function deleteBooking(req, res) {
  try {
    const booking = await Booking.findByPk(req.params.id)
    if (!booking) return notFound(res, 'Booking not found.')
    if (booking.status !== 'invoiced') {
      return error(res, 'Only invoiced bookings can be deleted.', 'BOOKING_NOT_INVOICED', 409)
    }

    await sequelize.transaction(async (t) => {
      const invoice = await Invoice.findOne({ where: { booking_id: booking.id }, transaction: t })
      if (invoice) {
        await InvoiceLineItem.destroy({ where: { invoice_id: invoice.id }, transaction: t })
        await invoice.destroy({ transaction: t })
      }
      await ServiceMemo.destroy({ where: { booking_id: booking.id }, transaction: t })
      await JobMilestone.destroy({ where: { booking_id: booking.id }, transaction: t })
      await booking.destroy({ transaction: t })
    })

    return success(res, { id: booking.id, reference_number: booking.reference_number })
  } catch (err) {
    return internalError(res, err)
  }
}

module.exports = { listMyJobs, listBookings, getBookingById, updateBookingCrew, rejectBooking, deleteBooking }
