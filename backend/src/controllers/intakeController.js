const { Op } = require('sequelize')
const { IntakeSubmission, Booking, Client, User } = require('../models')
const { success, created, error, notFound } = require('../utils')
const { intakeCreateSchema, intakeConfirmSchema, intakeRejectSchema } = require('../validators')
const notificationService = require('../services/notificationService')

function buildReference(prefix, nextNumber) {
  return `${prefix}-${String(nextNumber).padStart(5, '0')}`
}

// Derives the next sequence number from the highest existing reference_number's
// numeric suffix, not from the row's id. Seeded/manually-inserted rows can leave a
// gap between id and reference_number (e.g. id 8 holding "EFAR-2026-00010" while id 7
// holds "EFAR-2026-00009") - deriving from id then collides with an already-used
// reference_number and every subsequent submission 500s on a unique constraint violation.
async function nextReferenceNumber(Model, prefix) {
  const last = await Model.findOne({
    where: { reference_number: { [Op.like]: `${prefix}-%` } },
    order: [['reference_number', 'DESC']],
  })
  if (!last) return 1
  const match = last.reference_number.match(/(\d+)$/)
  return match ? parseInt(match[1], 10) + 1 : 1
}

async function createIntake(req, res) {
  try {
    const body = await intakeCreateSchema.validate(req.body, { abortEarly: false, stripUnknown: true })
    const existing = await IntakeSubmission.findOne({
      where: {
        contact_email: body.contact_email,
        preferred_date: body.preferred_date,
        pickup_location: body.pickup_location,
        created_at: { [Op.gte]: new Date(Date.now() - 10 * 60 * 1000) },
      },
    })
    if (existing) {
      return error(res, 'A similar intake submission was received recently.', 'DUPLICATE_SUBMISSION', 409)
    }

    const nextNumber = await nextReferenceNumber(IntakeSubmission, 'EFAR-2026')
    const intake = await IntakeSubmission.create({
      reference_number: buildReference('EFAR-2026', nextNumber),
      status: 'pending',
      customer_name: body.customer_name,
      organisation: body.organisation || null,
      contact_email: body.contact_email,
      contact_phone: body.contact_phone,
      service_type: body.service_type,
      service_tier: null,
      preferred_date: body.preferred_date,
      preferred_time: body.preferred_time,
      pickup_location: body.pickup_location,
      destination: body.destination,
      additional_notes: body.additional_notes || null,
    })

    // Non-fatal and isolated from the outer catch on purpose: the intake above is
    // already committed, and this is a public, unauthenticated form - a failure here
    // (e.g. the specialist lookup itself throwing) must never turn a successful
    // submission into a 500 for the customer. The Intake Queue is the reliable fallback.
    try {
      const quotationsSpecialists = await User.findAll({ where: { role: 'quotations_specialist' } })
      await Promise.all(quotationsSpecialists.map((specialist) =>
        notificationService.create({
          user_id: specialist.id,
          type: 'new_intake_submission',
          title: 'New service request received',
          body: `${intake.customer_name} submitted a new request (${intake.reference_number}).`,
          link: '/intake-queue',
        })
      ))
    } catch (notifyErr) {
      console.error('[createIntake] Failed to notify Quotations Specialists:', notifyErr.message)
    }

    return created(res, {
      id: intake.id,
      reference_number: intake.reference_number,
      status: intake.status,
      message: 'Your request has been received. Our team will be in touch shortly.',
      created_at: intake.createdAt,
    })
  } catch (err) {
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 400)
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

async function listIntakes(req, res) {
  try {
    const { status = 'pending', service_type, service_tier, search, page = 1, limit = 20 } = req.query
    const where = {}
    if (status) where.status = status
    if (service_type) where.service_type = service_type
    if (service_tier) where.service_tier = service_tier
    if (search) {
      where[Op.or] = [
        { customer_name: { [Op.iLike]: `%${search}%` } },
        { reference_number: { [Op.iLike]: `%${search}%` } },
      ]
    }

    const offset = (Number(page) - 1) * Number(limit)
    const { rows, count } = await IntakeSubmission.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset,
    })

    return success(res, {
      data: rows.map((item) => ({
        id: item.id,
        reference_number: item.reference_number,
        customer_name: item.customer_name,
        organisation: item.organisation,
        contact_email: item.contact_email,
        contact_phone: item.contact_phone,
        service_type: item.service_type,
        service_tier: item.service_tier,
        preferred_date: item.preferred_date,
        preferred_time: item.preferred_time,
        pickup_location: item.pickup_location,
        destination: item.destination,
        additional_notes: item.additional_notes,
        status: item.status,
        rejection_reason: item.rejection_reason,
        reviewed_by: item.reviewed_by,
        reviewed_at: item.reviewed_at,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      })),
      meta: { total: count, page: Number(page), limit: Number(limit) },
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

async function getIntakeById(req, res) {
  try {
    const intake = await IntakeSubmission.findByPk(req.params.id)
    if (!intake) return notFound(res, 'Intake submission not found.')
    return success(res, {
      id: intake.id,
      reference_number: intake.reference_number,
      customer_name: intake.customer_name,
      organisation: intake.organisation,
      contact_email: intake.contact_email,
      contact_phone: intake.contact_phone,
      service_type: intake.service_type,
      service_tier: intake.service_tier,
      preferred_date: intake.preferred_date,
      preferred_time: intake.preferred_time,
      pickup_location: intake.pickup_location,
      destination: intake.destination,
      additional_notes: intake.additional_notes,
      status: intake.status,
      rejection_reason: intake.rejection_reason,
      reviewed_by: intake.reviewed_by,
      reviewed_at: intake.reviewed_at,
      created_at: intake.createdAt,
      updated_at: intake.updatedAt,
    })
  } catch (err) {
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

async function confirmIntake(req, res) {
  try {
    const intake = await IntakeSubmission.findByPk(req.params.id)
    if (!intake) return notFound(res, 'Intake submission not found.')
    if (intake.status !== 'pending') return error(res, 'Intake has already been actioned.', 'ALREADY_ACTIONED', 409)

    const body = await intakeConfirmSchema.validate(req.body, { abortEarly: false, stripUnknown: true })

    const clientName = intake.organisation || intake.customer_name
    const clientEmail = intake.contact_email
    const [client] = await Client.findOrCreate({
      where: { contact_email: clientEmail },
      defaults: { name: clientName, contact_email: clientEmail, contact_phone: intake.contact_phone },
    })

    const nextBookingNumber = await nextReferenceNumber(Booking, 'BKG-2026')
    const booking = await Booking.create({
      reference_number: buildReference('BKG-2026', nextBookingNumber),
      intake_submission_id: intake.id,
      client_id: client.id,
      created_by: req.user.sub,
      service_type: intake.service_type,
      service_tier: body.service_tier,
      original_service_tier: intake.service_tier && body.service_tier !== intake.service_tier ? intake.service_tier : null,
      scheduled_date: body.scheduled_date || intake.preferred_date,
      scheduled_time: body.scheduled_time || intake.preferred_time,
      pickup_location: body.pickup_location || intake.pickup_location,
      destination: body.destination || intake.destination,
      status: 'confirmed',
      notes: body.notes || null,
    })

    await intake.update({ status: 'confirmed', reviewed_by: req.user.sub, reviewed_at: new Date() })

    return created(res, {
      id: booking.id,
      reference_number: booking.reference_number,
      intake_submission_id: booking.intake_submission_id,
      status: booking.status,
      scheduled_date: booking.scheduled_date,
      scheduled_time: booking.scheduled_time,
    })
  } catch (err) {
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 400)
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

async function rejectIntake(req, res) {
  try {
    const intake = await IntakeSubmission.findByPk(req.params.id)
    if (!intake) return notFound(res, 'Intake submission not found.')
    if (intake.status !== 'pending') return error(res, 'Intake has already been actioned.', 'ALREADY_ACTIONED', 409)

    const body = await intakeRejectSchema.validate(req.body, { abortEarly: false, stripUnknown: true })
    await intake.update({ status: 'rejected', rejection_reason: body.rejection_reason, reviewed_by: req.user.sub, reviewed_at: new Date() })

    return success(res, { id: intake.id, reference_number: intake.reference_number, status: intake.status })
  } catch (err) {
    if (err.name === 'ValidationError') return error(res, err.errors.join(', '), 'VALIDATION_ERROR', 400)
    return error(res, err.message, 'INTERNAL_ERROR', 500)
  }
}

module.exports = { createIntake, listIntakes, getIntakeById, confirmIntake, rejectIntake }
