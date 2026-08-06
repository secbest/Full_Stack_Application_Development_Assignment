// Owner: Zheng Bao - Bookings table delete action
// (backend/src/controllers/bookingController.js).
//
// listBookings/getBookingById/updateBookingCrew are exercised elsewhere (jasper's
// bookingCrewNotification/bookingMilestonesInclude tests). This file covers the new
// deleteBooking action: only an invoiced booking may be deleted, and doing so must
// clean up its Service Memo, Invoice (+ line items), and job milestones in one
// transaction - while deliberately leaving XeroSyncLog rows alone, since they're the
// last local trace that a sync happened even after the rest of the record is gone.
jest.mock('../../src/models', () => ({
  Booking: { findByPk: jest.fn() },
  Client: {},
  User: {},
  IntakeSubmission: {},
  ServiceMemo: { destroy: jest.fn() },
  Invoice: { findOne: jest.fn() },
  InvoiceLineItem: { destroy: jest.fn() },
  JobMilestone: { destroy: jest.fn() },
}))
jest.mock('../../src/config', () => ({
  transaction: jest.fn((cb) => cb({})),
}))

const { Booking, ServiceMemo, Invoice, InvoiceLineItem, JobMilestone } = require('../../src/models')
const { deleteBooking } = require('../../src/controllers/bookingController')

function mockRes() {
  const res = {}
  res.status = jest.fn().mockReturnValue(res)
  res.json = jest.fn().mockReturnValue(res)
  return res
}
function payload(res) {
  return res.json.mock.calls[0][0]
}

beforeEach(() => {
  jest.clearAllMocks()
  Invoice.findOne.mockResolvedValue(null)
})

describe('deleteBooking', () => {
  test('404s when the booking does not exist', async () => {
    Booking.findByPk.mockResolvedValue(null)

    const res = mockRes()
    await deleteBooking({ params: { id: 999 } }, res)

    expect(res.status).toHaveBeenCalledWith(404)
  })

  test('409s BOOKING_NOT_INVOICED for a confirmed booking, and does not delete it', async () => {
    const booking = { id: 7, status: 'confirmed', destroy: jest.fn() }
    Booking.findByPk.mockResolvedValue(booking)

    const res = mockRes()
    await deleteBooking({ params: { id: 7 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(payload(res)).toMatchObject({ code: 'BOOKING_NOT_INVOICED' })
    expect(booking.destroy).not.toHaveBeenCalled()
  })

  test('409s BOOKING_NOT_INVOICED for an in_progress booking', async () => {
    Booking.findByPk.mockResolvedValue({ id: 7, status: 'in_progress', destroy: jest.fn() })

    const res = mockRes()
    await deleteBooking({ params: { id: 7 } }, res)

    expect(res.status).toHaveBeenCalledWith(409)
  })

  test('deletes an invoiced booking with no linked invoice row (edge case) without erroring', async () => {
    const booking = { id: 7, reference_number: 'BKG-2026-00007', status: 'invoiced', destroy: jest.fn().mockResolvedValue(true) }
    Booking.findByPk.mockResolvedValue(booking)
    Invoice.findOne.mockResolvedValue(null)

    const res = mockRes()
    await deleteBooking({ params: { id: 7 } }, res)

    expect(InvoiceLineItem.destroy).not.toHaveBeenCalled()
    expect(ServiceMemo.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { booking_id: 7 } }))
    expect(JobMilestone.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { booking_id: 7 } }))
    expect(booking.destroy).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(payload(res).data).toEqual({ id: 7, reference_number: 'BKG-2026-00007' })
  })

  test('deletes an invoiced booking and its invoice line items, memo, and milestones', async () => {
    const booking = { id: 9, reference_number: 'BKG-2026-00009', status: 'invoiced', destroy: jest.fn().mockResolvedValue(true) }
    const invoice = { id: 55, destroy: jest.fn().mockResolvedValue(true) }
    Booking.findByPk.mockResolvedValue(booking)
    Invoice.findOne.mockResolvedValue(invoice)

    const res = mockRes()
    await deleteBooking({ params: { id: 9 } }, res)

    expect(Invoice.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { booking_id: 9 } }))
    expect(InvoiceLineItem.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { invoice_id: 55 } }))
    expect(invoice.destroy).toHaveBeenCalled()
    expect(ServiceMemo.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { booking_id: 9 } }))
    expect(JobMilestone.destroy).toHaveBeenCalledWith(expect.objectContaining({ where: { booking_id: 9 } }))
    expect(booking.destroy).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
