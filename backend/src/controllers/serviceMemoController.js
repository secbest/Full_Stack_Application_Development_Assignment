const { Op } = require('sequelize')
const sequelize = require('../config')
const { ServiceMemo, MemoSignature, Booking, User } = require('../models')
const { success, created, error, notFound, forbidden } = require('../utils')
const cloudinaryService = require('../services/cloudinaryService')
const notificationService = require('../services/notificationService')

async function uploadSignature(req, res) {
  try {
    const result = await cloudinaryService.uploadBuffer(req.file.buffer, { folder: 'signatures' })
    return success(res, { signature_image_url: result.secure_url })
  } catch (err) {
    return error(res, 'Failed to upload signature to storage. Please retry.', 'CLOUDINARY_UPLOAD_FAILED', 502)
  }
}

async function uploadHospitalStamp(req, res) {
  try {
    const result = await cloudinaryService.uploadBuffer(req.file.buffer, { folder: 'hospital-stamps' })
    return success(res, { hospital_stamp_image_url: result.secure_url })
  } catch (err) {
    return error(res, 'Failed to upload hospital stamp to storage. Please retry.', 'CLOUDINARY_UPLOAD_FAILED', 502)
  }
}

function serializeMemo(memo, signature) {
  return {
    id: memo.id,
    booking_id: memo.booking_id,
    submitted_by: memo.submitted_by,
    status: memo.status,
    job_start_time: memo.job_start_time,
    job_end_time: memo.job_end_time,
    overtime_hours: memo.overtime_hours,
    evacuation_floors: memo.evacuation_floors,
    patient_name: memo.patient_name,
    hospital_destination: memo.hospital_destination,
    service_type: memo.service_type,
    transfer_type: memo.transfer_type,
    is_office_hours: memo.is_office_hours,
    oxygen_litres_used: memo.oxygen_litres_used,
    has_inconvenience_fee: memo.has_inconvenience_fee,
    disposables_used: memo.disposables_used,
    resuscitation_performed: memo.resuscitation_performed,
    suction_performed: memo.suction_performed,
    waiting_time_minutes: memo.waiting_time_minutes,
    patient_weight_kg: memo.patient_weight_kg,
    is_jurong_island: memo.is_jurong_island,
    additional_charges_notes: memo.additional_charges_notes,
    hospital_stamp_image_url: memo.hospital_stamp_image_url,
    signature: {
      id: signature.id,
      signer_name: signature.signer_name,
      signature_image_url: signature.signature_image_url,
      signed_at: signature.signed_at,
      is_waived: signature.is_waived,
      waiver_reason: signature.waiver_reason,
    },
    created_at: memo.createdAt,
  }
}

// Submits the completed field memo (UC-01 through UC-05) as a single atomic transaction:
// create the memo, create its signature, and advance the parent booking to 'completed'.
// All three writes succeed together or none do - a partial memo (e.g. saved but the booking
// status didn't advance) would be worse than a clean failure the crew member can retry.
async function createServiceMemo(req, res) {
  const body = req.body
  const booking = await Booking.findByPk(body.booking_id)

  // Same 404 for "doesn't exist" and "not this crew member's job" - deliberately not
  // distinguishing the two so a crew member can't probe which booking IDs exist.
  const isOwnBooking = booking && (req.user.role !== 'field_crew' || booking.assigned_crew_id === req.user.sub)
  if (!isOwnBooking) {
    return error(res, 'Booking not found or not assigned to this crew member.', 'BOOKING_NOT_FOUND', 404)
  }

  if (booking.status === 'invoiced') {
    return error(res, 'This booking has already been invoiced. Contact AR if a correction is required.', 'BOOKING_ALREADY_INVOICED', 409)
  }

  const existingMemo = await ServiceMemo.findOne({ where: { booking_id: body.booking_id } })
  if (existingMemo) {
    return error(res, 'A memo has already been submitted for this booking. Contact AR if a correction is needed.', 'MEMO_ALREADY_EXISTS', 409)
  }

  let memo
  let signature
  try {
    await sequelize.transaction(async (t) => {
      memo = await ServiceMemo.create(
        {
          booking_id: body.booking_id,
          submitted_by: req.user.sub,
          job_start_time: body.job_start_time,
          job_end_time: body.job_end_time,
          overtime_hours: body.overtime_hours,
          evacuation_floors: body.evacuation_floors,
          patient_name: body.patient_name,
          hospital_destination: body.hospital_destination,
          additional_charges_notes: body.additional_charges_notes,
          hospital_stamp_image_url: body.hospital_stamp_image_url,
          service_type: body.service_type,
          transfer_type: body.transfer_type,
          is_office_hours: body.is_office_hours,
          oxygen_litres_used: body.oxygen_litres_used,
          has_inconvenience_fee: body.has_inconvenience_fee,
          disposables_used: body.disposables_used,
          resuscitation_performed: body.resuscitation_performed,
          suction_performed: body.suction_performed,
          waiting_time_minutes: body.waiting_time_minutes,
          patient_weight_kg: body.patient_weight_kg,
          is_jurong_island: body.is_jurong_island,
          status: 'submitted',
        },
        { transaction: t }
      )

      signature = await MemoSignature.create(
        {
          memo_id: memo.id,
          signer_name: body.signature.signer_name,
          signature_image_url: body.signature.signature_image_url,
          signed_at: body.signature.signed_at,
          is_waived: body.signature.is_waived,
          waiver_reason: body.signature.waiver_reason,
        },
        { transaction: t }
      )

      await booking.update({ status: 'completed' }, { transaction: t })
    })
  } catch (err) {
    return error(res, 'Failed to submit service memo.', 'INTERNAL_ERROR', 500)
  }

  // Non-fatal by design (UC-05 edge case) - the memo above is already committed even if
  // this notification fails. The AR Specialist's review queue is the reliable fallback.
  const arSpecialist = await User.findOne({ where: { role: 'ar_specialist' } })
  if (arSpecialist) {
    await notificationService.create({
      user_id: arSpecialist.id,
      type: 'memo_submitted',
      title: 'New service memo ready for review',
      // Manpower-only standby memos (client feedback item 4) have no patient - fall
      // back to the booking reference so the notification still identifies the job.
      body: `Memo for booking #${booking.id} (${memo.patient_name || booking.reference_number}) is awaiting review.`,
      link: `/memos/${memo.id}`,
    })
  }

  return created(res, serializeMemo(memo, signature))
}

// AR Specialists and the Managing Director see everything (scoped by query filters);
// field crew are hard-scoped to their own submissions regardless of what they pass in
// submitted_by, except that an explicit mismatched submitted_by is rejected outright
// rather than silently overridden, so the client gets an unambiguous signal it asked
// for something it isn't allowed to see.
async function listServiceMemos(req, res) {
  const { status, booking_id, submitted_by, date_from, date_to, page, limit } = req.query

  if (req.user.role === 'field_crew' && submitted_by && Number(submitted_by) !== req.user.sub) {
    return forbidden(res, 'Field crew can only filter by their own submitted memos.')
  }

  const where = {}
  if (status) where.status = status
  if (booking_id) where.booking_id = booking_id
  if (req.user.role === 'field_crew') {
    where.submitted_by = req.user.sub
  } else if (submitted_by) {
    where.submitted_by = submitted_by
  }
  if (date_from || date_to) {
    where.created_at = {}
    if (date_from) where.created_at[Op.gte] = date_from
    if (date_to) where.created_at[Op.lte] = date_to
  }

  const { rows, count } = await ServiceMemo.findAndCountAll({
    where,
    include: [{ model: User, as: 'submittedBy', attributes: ['id', 'name'] }],
    limit,
    offset: (page - 1) * limit,
    order: [['created_at', 'DESC']],
  })

  return success(res, {
    data: rows.map((memo) => ({
      id: memo.id,
      booking_id: memo.booking_id,
      submitted_by: memo.submittedBy ? { id: memo.submittedBy.id, name: memo.submittedBy.name } : null,
      patient_name: memo.patient_name,
      hospital_destination: memo.hospital_destination,
      service_type: memo.service_type,
      status: memo.status,
      has_hospital_stamp: !!memo.hospital_stamp_image_url,
      created_at: memo.createdAt,
    })),
    pagination: {
      page,
      limit,
      total: count,
      total_pages: count === 0 ? 0 : Math.ceil(count / limit),
    },
  })
}

async function getServiceMemoById(req, res) {
  const memo = await ServiceMemo.findByPk(req.params.id, {
    include: [
      { model: User, as: 'submittedBy', attributes: ['id', 'name'] },
      { model: User, as: 'reviewedBy', attributes: ['id', 'name'] },
      { model: MemoSignature },
    ],
  })
  if (!memo) return notFound(res, 'Service memo not found.')

  if (req.user.role === 'field_crew' && memo.submitted_by !== req.user.sub) {
    return forbidden(res, 'You do not have permission to view this service memo.')
  }

  return success(res, {
    id: memo.id,
    booking_id: memo.booking_id,
    submitted_by: memo.submittedBy ? { id: memo.submittedBy.id, name: memo.submittedBy.name } : null,
    reviewed_by: memo.reviewedBy ? { id: memo.reviewedBy.id, name: memo.reviewedBy.name } : null,
    status: memo.status,
    job_start_time: memo.job_start_time,
    job_end_time: memo.job_end_time,
    overtime_hours: memo.overtime_hours,
    evacuation_floors: memo.evacuation_floors,
    patient_name: memo.patient_name,
    hospital_destination: memo.hospital_destination,
    service_type: memo.service_type,
    transfer_type: memo.transfer_type,
    is_office_hours: memo.is_office_hours,
    oxygen_litres_used: memo.oxygen_litres_used,
    has_inconvenience_fee: memo.has_inconvenience_fee,
    disposables_used: memo.disposables_used,
    resuscitation_performed: memo.resuscitation_performed,
    suction_performed: memo.suction_performed,
    waiting_time_minutes: memo.waiting_time_minutes,
    patient_weight_kg: memo.patient_weight_kg,
    is_jurong_island: memo.is_jurong_island,
    additional_charges_notes: memo.additional_charges_notes,
    hospital_stamp_image_url: memo.hospital_stamp_image_url,
    signatures: memo.MemoSignatures.map((s) => ({
      id: s.id,
      signer_name: s.signer_name,
      signature_image_url: s.signature_image_url,
      signed_at: s.signed_at,
      is_waived: s.is_waived,
      waiver_reason: s.waiver_reason,
    })),
    created_at: memo.createdAt,
    updated_at: memo.updatedAt,
  })
}

module.exports = {
  uploadSignature,
  uploadHospitalStamp,
  createServiceMemo,
  listServiceMemos,
  getServiceMemoById,
}
