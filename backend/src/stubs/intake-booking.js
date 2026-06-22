'use strict'

// In-memory stub data for Customer Intake & Booking Management routes.
// Use this while the real PostgreSQL tables (intake_submissions, bookings, clients, users)
// are not yet available or while Jasper / Liang Yi's FK tables are still being built.
//
// Usage in a route:
//   const { bookings, intakeSubmissions, findBookingById } = require('../stubs/intake-booking')
//   router.get('/bookings', (req, res) => res.json(bookings))
//   router.get('/bookings/:id', (req, res) => {
//     const b = findBookingById(Number(req.params.id))
//     return b ? res.json({ data: b }) : res.status(404).json({ error: 'BOOKING_NOT_FOUND' })
//   })
//
// Booking IDs 1-6 are shared with Jasper's ar-billing.js stub.
// Import both stubs in routes that need cross-feature data:
//   const { invoices } = require('../stubs/ar-billing')
//   const { bookings } = require('../stubs/intake-booking')

// ---------------------------------------------------------------------------
// Shared lookup tables (replace with real Sequelize queries when ready)
// ---------------------------------------------------------------------------

const clients = [
  { id: 1, name: 'Tan Tock Seng Hospital',  contact_email: 'billing@ttsh.com.sg' },
  { id: 2, name: 'ABC Corporation',          contact_email: 'finance@abc-corp.com.sg' },
  { id: 3, name: 'SingHealth Group',         contact_email: 'ap@singhealth.com.sg' },
]

const users = [
  { id: 1, name: 'Sarah Lim',    role: 'ar_specialist' },
  { id: 2, name: 'Doris Tan',    role: 'managing_director' },
  { id: 3, name: 'Ravi Kumar',   role: 'field_crew' },
  { id: 4, name: 'Chloe Ng',     role: 'ap_specialist' },
  { id: 5, name: 'Camilla Wong', role: 'quotations_specialist' },
]

// ---------------------------------------------------------------------------
// intake_submissions
// ---------------------------------------------------------------------------

const intakeSubmissions = [
  // --- Group A: Pending (Camilla's active queue) ---
  {
    id: 1, reference_number: 'EFAR-2026-00001',
    customer_name: 'Wei Lin Tan', organisation: 'Tan Tock Seng Hospital',
    contact_email: 'weiling.tan@ttsh.com.sg', contact_phone: '64501234',
    service_type: 'eas', service_tier: 'advanced',
    preferred_date: '2026-07-10', preferred_time: '14:00',
    pickup_location: 'Tan Tock Seng Hospital, Ward 5B, 11 Jalan Tan Tock Seng, Singapore 308433',
    destination: 'National University Hospital, 5 Lower Kent Ridge Road, Singapore 119074',
    additional_notes: 'Patient is on supplemental oxygen. Requires monitoring throughout transfer.',
    status: 'pending', rejection_reason: null, reviewed_by: null, reviewed_at: null,
    created_at: '2026-07-08T09:20:00.000Z', updated_at: '2026-07-08T09:20:00.000Z',
  },
  {
    id: 2, reference_number: 'EFAR-2026-00002',
    customer_name: 'Marcus Lim', organisation: 'ABC Corporation',
    contact_email: 'marcus.lim@abc-corp.com.sg', contact_phone: '65432100',
    service_type: 'event_standby', service_tier: 'basic',
    preferred_date: '2026-08-15', preferred_time: '08:00',
    pickup_location: 'ABC Corporation HQ, 10 Anson Road, Singapore 079903',
    destination: 'Nearest A&E (if activated)',
    additional_notes: 'Annual company sports day. Approx 200 participants. Request standby from 0800-1700.',
    status: 'pending', rejection_reason: null, reviewed_by: null, reviewed_at: null,
    created_at: '2026-07-09T14:05:00.000Z', updated_at: '2026-07-09T14:05:00.000Z',
  },

  // --- Group B: Confirmed (linked to AR billing bookings 1-6) ---
  {
    id: 3, reference_number: 'EFAR-2026-00003',
    customer_name: 'Dr. Priya Nair', organisation: 'Tan Tock Seng Hospital',
    contact_email: 'priya.nair@ttsh.com.sg', contact_phone: '64501111',
    service_type: 'eas', service_tier: 'advanced',
    preferred_date: '2026-06-10', preferred_time: '09:00',
    pickup_location: 'Tan Tock Seng Hospital, Ward 5B, 11 Jalan Tan Tock Seng, Singapore 308433',
    destination: 'National University Hospital, 5 Lower Kent Ridge Road, Singapore 119074',
    additional_notes: null,
    status: 'confirmed', rejection_reason: null, reviewed_by: 5, reviewed_at: '2026-06-08T10:00:00.000Z',
    created_at: '2026-06-07T16:30:00.000Z', updated_at: '2026-06-08T10:00:00.000Z',
  },
  {
    id: 4, reference_number: 'EFAR-2026-00004',
    customer_name: 'Siti Rahimah', organisation: 'Tan Tock Seng Hospital',
    contact_email: 'siti.r@ttsh.com.sg', contact_phone: '64502222',
    service_type: 'eas', service_tier: 'basic', // customer's original - Camilla upgraded to advanced
    preferred_date: '2026-06-11', preferred_time: '22:00',
    pickup_location: 'Tan Tock Seng Hospital, A&E, 11 Jalan Tan Tock Seng, Singapore 308433',
    destination: 'Khoo Teck Puat Hospital, 90 Yishun Central, Singapore 768828',
    additional_notes: 'Patient requiring oxygen support. Floor access at destination.',
    status: 'confirmed', rejection_reason: null, reviewed_by: 5, reviewed_at: '2026-06-10T08:30:00.000Z',
    created_at: '2026-06-09T20:00:00.000Z', updated_at: '2026-06-10T08:30:00.000Z',
  },
  {
    id: 5, reference_number: 'EFAR-2026-00005',
    customer_name: 'Ahmad Fauzi', organisation: 'Tan Tock Seng Hospital',
    contact_email: 'ahmad.fauzi@ttsh.com.sg', contact_phone: '64503333',
    service_type: 'eas', service_tier: 'critical',
    preferred_date: '2026-06-13', preferred_time: '11:00',
    pickup_location: 'Tan Tock Seng Hospital, Isolation Ward, 11 Jalan Tan Tock Seng, Singapore 308433',
    destination: 'National Centre for Infectious Diseases, 16 Jalan Tan Tock Seng, Singapore 308442',
    additional_notes: 'COVID-19 positive patient. Full PPE required.',
    status: 'confirmed', rejection_reason: null, reviewed_by: 5, reviewed_at: '2026-06-12T09:00:00.000Z',
    created_at: '2026-06-11T17:00:00.000Z', updated_at: '2026-06-12T09:00:00.000Z',
  },
  {
    id: 6, reference_number: 'EFAR-2026-00006',
    customer_name: 'Chen Wei', organisation: 'Tan Tock Seng Hospital',
    contact_email: 'chen.wei@ttsh.com.sg', contact_phone: '64504444',
    service_type: 'mts', service_tier: 'advanced',
    preferred_date: '2026-06-14', preferred_time: '07:30',
    pickup_location: 'Changi Airport Terminal 3 Tarmac, Singapore 819663',
    destination: 'Jurong Island Medical Centre, Jurong Island, Singapore',
    additional_notes: 'Repatriation case from inbound flight. Tarmac access required. Jurong Island destination.',
    status: 'confirmed', rejection_reason: null, reviewed_by: 5, reviewed_at: '2026-06-13T11:00:00.000Z',
    created_at: '2026-06-12T22:00:00.000Z', updated_at: '2026-06-13T11:00:00.000Z',
  },
  {
    id: 7, reference_number: 'EFAR-2026-00007',
    customer_name: 'Raj Kumaran', organisation: 'Tan Tock Seng Hospital',
    contact_email: 'raj.k@ttsh.com.sg', contact_phone: '64505555',
    service_type: 'eas', service_tier: 'basic',
    preferred_date: '2026-06-15', preferred_time: '08:00',
    pickup_location: 'Tan Tock Seng Hospital, Ward 3A, 11 Jalan Tan Tock Seng, Singapore 308433',
    destination: 'Alexandra Hospital, 378 Alexandra Road, Singapore 159964',
    additional_notes: null,
    status: 'confirmed', rejection_reason: null, reviewed_by: 5, reviewed_at: '2026-06-14T09:00:00.000Z',
    created_at: '2026-06-13T18:00:00.000Z', updated_at: '2026-06-14T09:00:00.000Z',
  },
  {
    id: 8, reference_number: 'EFAR-2026-00008',
    customer_name: 'Linda Goh', organisation: 'SingHealth Group',
    contact_email: 'linda.goh@singhealth.com.sg', contact_phone: '63214567',
    service_type: 'eas', service_tier: 'advanced',
    preferred_date: '2026-06-16', preferred_time: '13:00',
    pickup_location: 'Singapore General Hospital, Outram Road, Singapore 169608',
    destination: 'Changi General Hospital, 2 Simei Street 3, Singapore 529889',
    additional_notes: 'Routine inter-hospital transfer.',
    status: 'confirmed', rejection_reason: null, reviewed_by: 5, reviewed_at: '2026-06-15T10:00:00.000Z',
    created_at: '2026-06-14T15:00:00.000Z', updated_at: '2026-06-15T10:00:00.000Z',
  },

  // --- Group C: Rejected ---
  {
    id: 9, reference_number: 'EFAR-2026-00009',
    customer_name: 'James Wong', organisation: null,
    contact_email: 'james.wong@personal.com', contact_phone: '91112222',
    service_type: 'mts', service_tier: 'basic',
    preferred_date: '2026-06-20', preferred_time: '10:00',
    pickup_location: 'Johor Bahru City Square, Malaysia',
    destination: 'Singapore General Hospital, Outram Road, Singapore 169608',
    additional_notes: null,
    status: 'rejected',
    rejection_reason: 'Pickup location is outside EFAR service area. EFAR covers Singapore territory only.',
    reviewed_by: 5, reviewed_at: '2026-06-18T14:30:00.000Z',
    created_at: '2026-06-17T11:00:00.000Z', updated_at: '2026-06-18T14:30:00.000Z',
  },
  {
    id: 10, reference_number: 'EFAR-2026-00010',
    customer_name: 'Nurul Huda', organisation: 'Parkway Pantai',
    contact_email: 'nurul.h@parkwaypantai.com', contact_phone: '67891011',
    service_type: 'eas', service_tier: 'basic',
    preferred_date: '2026-06-28', preferred_time: '07:00',
    pickup_location: 'Mount Elizabeth Hospital, 3 Mount Elizabeth, Singapore 228510',
    destination: 'Raffles Hospital, 585 North Bridge Road, Singapore 188770',
    additional_notes: 'Early morning transfer required before 0900.',
    status: 'rejected',
    rejection_reason: 'No crew available on the requested date. Please contact us to arrange an alternative date.',
    reviewed_by: 5, reviewed_at: '2026-06-20T09:00:00.000Z',
    created_at: '2026-06-19T17:30:00.000Z', updated_at: '2026-06-20T09:00:00.000Z',
  },

  // --- Group D: Confirmed (linked to booking management bookings 7-10) ---
  {
    id: 11, reference_number: 'EFAR-2026-00011',
    customer_name: 'Marcus Lim', organisation: 'ABC Corporation',
    contact_email: 'marcus.lim@abc-corp.com.sg', contact_phone: '65432100',
    service_type: 'event_standby', service_tier: 'basic',
    preferred_date: '2026-07-20', preferred_time: '08:00',
    pickup_location: 'ABC Corporation HQ, 10 Anson Road, Singapore 079903',
    destination: 'Nearest A&E (if activated)',
    additional_notes: 'Corporate event - approx 150 attendees.',
    status: 'confirmed', rejection_reason: null, reviewed_by: 5, reviewed_at: '2026-07-10T10:00:00.000Z',
    created_at: '2026-07-09T14:05:00.000Z', updated_at: '2026-07-10T10:00:00.000Z',
  },
  {
    id: 12, reference_number: 'EFAR-2026-00012',
    customer_name: 'Dr. Priya Nair', organisation: 'Tan Tock Seng Hospital',
    contact_email: 'priya.nair@ttsh.com.sg', contact_phone: '64501111',
    service_type: 'mts', service_tier: 'basic',
    preferred_date: '2026-07-25', preferred_time: '10:00',
    pickup_location: 'Tan Tock Seng Hospital, Ward 7C, 11 Jalan Tan Tock Seng, Singapore 308433',
    destination: 'Khoo Teck Puat Hospital, 90 Yishun Central, Singapore 768828',
    additional_notes: 'Stable patient, non-emergency transfer.',
    status: 'confirmed', rejection_reason: null, reviewed_by: 5, reviewed_at: '2026-07-20T09:00:00.000Z',
    created_at: '2026-07-19T11:00:00.000Z', updated_at: '2026-07-20T09:00:00.000Z',
  },
  {
    id: 13, reference_number: 'EFAR-2026-00013',
    customer_name: 'Darren Chia', organisation: 'ABC Corporation',
    contact_email: 'darren.chia@abc-corp.com.sg', contact_phone: '65439876',
    service_type: 'workplace_standby', service_tier: 'basic',
    preferred_date: '2026-06-22', preferred_time: '08:00',
    pickup_location: 'ABC Corporation Warehouse, 30 Tuas Road, Singapore 638492',
    destination: 'Nearest A&E (if activated)',
    additional_notes: 'Warehouse safety audit day. Full-shift standby required.',
    status: 'confirmed', rejection_reason: null, reviewed_by: 5, reviewed_at: '2026-06-20T14:00:00.000Z',
    created_at: '2026-06-19T10:00:00.000Z', updated_at: '2026-06-20T14:00:00.000Z',
  },
  {
    id: 14, reference_number: 'EFAR-2026-00014',
    customer_name: 'Dr. Priya Nair', organisation: 'Tan Tock Seng Hospital',
    contact_email: 'priya.nair@ttsh.com.sg', contact_phone: '64501111',
    service_type: 'eas', service_tier: 'advanced',
    preferred_date: '2026-06-21', preferred_time: '15:30',
    pickup_location: 'Tan Tock Seng Hospital, ICU, 11 Jalan Tan Tock Seng, Singapore 308433',
    destination: 'National Heart Centre, 5 Hospital Drive, Singapore 169609',
    additional_notes: 'Cardiac patient requiring urgent transfer.',
    status: 'confirmed', rejection_reason: null, reviewed_by: 5, reviewed_at: '2026-06-20T16:00:00.000Z',
    created_at: '2026-06-20T11:00:00.000Z', updated_at: '2026-06-20T16:00:00.000Z',
  },
]

// ---------------------------------------------------------------------------
// bookings
// ---------------------------------------------------------------------------

const bookings = [
  // --- Bookings 1-6: AR billing scenarios (booking_ids shared with ar-billing.js) ---
  {
    id: 1, reference_number: 'BKG-2026-00001',
    intake_submission_id: 3, client_id: 1, created_by: 5, assigned_crew_id: 3,
    service_type: 'eas', service_tier: 'advanced', original_service_tier: null,
    scheduled_date: '2026-06-10', scheduled_time: '09:00',
    pickup_location: 'Tan Tock Seng Hospital, Ward 5B, 11 Jalan Tan Tock Seng, Singapore 308433',
    destination: 'National University Hospital, 5 Lower Kent Ridge Road, Singapore 119074',
    status: 'completed', notes: null,
    created_at: '2026-06-08T10:00:00.000Z', updated_at: '2026-06-10T11:30:00.000Z',
  },
  {
    id: 2, reference_number: 'BKG-2026-00002',
    intake_submission_id: 4, client_id: 1, created_by: 5, assigned_crew_id: 3,
    service_type: 'eas', service_tier: 'advanced', original_service_tier: 'basic',
    scheduled_date: '2026-06-11', scheduled_time: '22:00',
    pickup_location: 'Tan Tock Seng Hospital, A&E, 11 Jalan Tan Tock Seng, Singapore 308433',
    destination: 'Khoo Teck Puat Hospital, 90 Yishun Central, Singapore 768828',
    status: 'completed', notes: 'Tier upgraded from Basic to Advanced at review.',
    created_at: '2026-06-10T08:30:00.000Z', updated_at: '2026-06-11T23:45:00.000Z',
  },
  {
    id: 3, reference_number: 'BKG-2026-00003',
    intake_submission_id: 5, client_id: 1, created_by: 5, assigned_crew_id: 3,
    service_type: 'eas', service_tier: 'critical', original_service_tier: null,
    scheduled_date: '2026-06-13', scheduled_time: '11:00',
    pickup_location: 'Tan Tock Seng Hospital, Isolation Ward, 11 Jalan Tan Tock Seng, Singapore 308433',
    destination: 'National Centre for Infectious Diseases, 16 Jalan Tan Tock Seng, Singapore 308442',
    status: 'completed', notes: 'COVID-19 positive patient. Full PPE protocol activated.',
    created_at: '2026-06-12T09:00:00.000Z', updated_at: '2026-06-13T14:00:00.000Z',
  },
  {
    id: 4, reference_number: 'BKG-2026-00004',
    intake_submission_id: 6, client_id: 1, created_by: 5, assigned_crew_id: 3,
    service_type: 'mts', service_tier: 'advanced', original_service_tier: null,
    scheduled_date: '2026-06-14', scheduled_time: '07:30',
    pickup_location: 'Changi Airport Terminal 3 Tarmac, Singapore 819663',
    destination: 'Jurong Island Medical Centre, Jurong Island, Singapore',
    status: 'invoiced', notes: 'Repatriation case. Tarmac access pass pre-arranged with airport ops.',
    created_at: '2026-06-13T11:00:00.000Z', updated_at: '2026-06-14T09:45:00.000Z',
  },
  {
    id: 5, reference_number: 'BKG-2026-00005',
    intake_submission_id: 7, client_id: 1, created_by: 5, assigned_crew_id: 3,
    service_type: 'eas', service_tier: 'basic', original_service_tier: null,
    scheduled_date: '2026-06-15', scheduled_time: '08:00',
    pickup_location: 'Tan Tock Seng Hospital, Ward 3A, 11 Jalan Tan Tock Seng, Singapore 308433',
    destination: 'Alexandra Hospital, 378 Alexandra Road, Singapore 159964',
    status: 'completed', notes: null,
    created_at: '2026-06-14T09:00:00.000Z', updated_at: '2026-06-15T10:30:00.000Z',
  },
  {
    id: 6, reference_number: 'BKG-2026-00006',
    intake_submission_id: 8, client_id: 3, created_by: 5, assigned_crew_id: 3,
    service_type: 'eas', service_tier: 'advanced', original_service_tier: null,
    scheduled_date: '2026-06-16', scheduled_time: '13:00',
    pickup_location: 'Singapore General Hospital, Outram Road, Singapore 169608',
    destination: 'Changi General Hospital, 2 Simei Street 3, Singapore 529889',
    status: 'completed', notes: null,
    created_at: '2026-06-15T10:00:00.000Z', updated_at: '2026-06-16T15:00:00.000Z',
  },

  // --- Bookings 7-10: Booking management scenarios ---
  {
    id: 7, reference_number: 'BKG-2026-00007',
    intake_submission_id: 11, client_id: 2, created_by: 5,
    assigned_crew_id: null,  // no crew yet - triggers UC-06 crew assignment flow
    service_type: 'event_standby', service_tier: 'basic', original_service_tier: null,
    scheduled_date: '2026-07-20', scheduled_time: '08:00',
    pickup_location: 'ABC Corporation HQ, 10 Anson Road, Singapore 079903',
    destination: 'Nearest A&E (if activated)',
    status: 'confirmed', notes: 'Corporate event. 150 attendees. Standby 0800-1700.',
    created_at: '2026-07-10T10:00:00.000Z', updated_at: '2026-07-10T10:00:00.000Z',
  },
  {
    id: 8, reference_number: 'BKG-2026-00008',
    intake_submission_id: 12, client_id: 1, created_by: 5, assigned_crew_id: 3,
    service_type: 'mts', service_tier: 'basic', original_service_tier: null,
    scheduled_date: '2026-07-25', scheduled_time: '10:00',
    pickup_location: 'Tan Tock Seng Hospital, Ward 7C, 11 Jalan Tan Tock Seng, Singapore 308433',
    destination: 'Khoo Teck Puat Hospital, 90 Yishun Central, Singapore 768828',
    status: 'confirmed', notes: 'Stable non-emergency transfer. Crew briefed.',
    created_at: '2026-07-20T09:00:00.000Z', updated_at: '2026-07-21T11:00:00.000Z',
  },
  {
    id: 9, reference_number: 'BKG-2026-00009',
    intake_submission_id: 13, client_id: 2, created_by: 5, assigned_crew_id: 3,
    service_type: 'workplace_standby', service_tier: 'basic', original_service_tier: null,
    scheduled_date: '2026-06-22', scheduled_time: '08:00',
    pickup_location: 'ABC Corporation Warehouse, 30 Tuas Road, Singapore 638492',
    destination: 'Nearest A&E (if activated)',
    status: 'in_progress', notes: 'Warehouse safety audit day. Full-shift standby.',
    created_at: '2026-06-20T14:00:00.000Z', updated_at: '2026-06-22T08:10:00.000Z',
  },
  {
    id: 10, reference_number: 'BKG-2026-00010',
    intake_submission_id: 14, client_id: 1, created_by: 5, assigned_crew_id: 3,
    service_type: 'eas', service_tier: 'advanced', original_service_tier: null,
    scheduled_date: '2026-06-21', scheduled_time: '15:30',
    pickup_location: 'Tan Tock Seng Hospital, ICU, 11 Jalan Tan Tock Seng, Singapore 308433',
    destination: 'National Heart Centre, 5 Hospital Drive, Singapore 169609',
    status: 'completed', notes: 'Cardiac patient urgent transfer. Completed on site ~1730.',
    // No service_memo linked - this is the REVENUE LEAKAGE scenario.
    // memo_pending_hours = hours since updated_at, should exceed the 4-hour alert threshold.
    created_at: '2026-06-20T16:00:00.000Z', updated_at: '2026-06-21T17:35:00.000Z',
  },
]

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const findIntakeById = (id) =>
  intakeSubmissions.find((s) => s.id === id) || null

const findBookingById = (id) =>
  bookings.find((b) => b.id === id) || null

const findIntakeByReferenceNumber = (ref) =>
  intakeSubmissions.find((s) => s.reference_number === ref) || null

const findBookingByReferenceNumber = (ref) =>
  bookings.find((b) => b.reference_number === ref) || null

const findClientById = (id) =>
  clients.find((c) => c.id === id) || null

const findUserById = (id) =>
  users.find((u) => u.id === id) || null

// Returns all pending intakes (Camilla's queue)
const getPendingIntakes = () =>
  intakeSubmissions.filter((s) => s.status === 'pending')

// Returns bookings filtered by status
const getBookingsByStatus = (status) =>
  bookings.filter((b) => b.status === status)

// Returns bookings that have been 'completed' for more than `thresholdHours`
// with no linked service_memo - the revenue leakage set.
// In the stub we cannot query service_memos (Liang Yi's table), so we hardcode
// booking id 10 as the known leakage record. Replace with a real join when ready.
const getRevenueLeakageAlerts = (thresholdHours = 4) => {
  const KNOWN_LEAKAGE_BOOKING_IDS = [10]
  return bookings.filter((b) => {
    if (!KNOWN_LEAKAGE_BOOKING_IDS.includes(b.id)) return false
    const hoursSinceUpdate = (Date.now() - new Date(b.updated_at).getTime()) / 3_600_000
    return b.status === 'completed' && hoursSinceUpdate >= thresholdHours
  })
}

// Simulates the confirm-intake flow: returns the booking that would be created.
// Use when stub-testing POST /api/intake/:id/confirm without a real DB.
const simulateConfirm = (intakeId, { service_tier, scheduled_date, scheduled_time, pickup_location, destination, notes }) => {
  const intake = findIntakeById(intakeId)
  if (!intake) return { error: 'SUBMISSION_NOT_FOUND' }
  if (intake.status !== 'pending') return { error: 'ALREADY_ACTIONED' }
  const tierChanged = service_tier !== intake.service_tier
  return {
    intake: { ...intake, status: 'confirmed', reviewed_by: 5, reviewed_at: new Date().toISOString() },
    booking: {
      id: bookings.length + 1,
      reference_number: `BKG-2026-${String(bookings.length + 1).padStart(5, '0')}`,
      intake_submission_id: intakeId,
      client_id: null, // looked up from clients table at runtime
      created_by: 5,
      assigned_crew_id: null,
      service_type: intake.service_type,
      service_tier,
      original_service_tier: tierChanged ? intake.service_tier : null,
      scheduled_date: scheduled_date || intake.preferred_date,
      scheduled_time: scheduled_time || intake.preferred_time,
      pickup_location: pickup_location || intake.pickup_location,
      destination: destination || intake.destination,
      status: 'confirmed',
      notes: notes || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }
}

// ---------------------------------------------------------------------------
// Valid status transitions (mirrors PATCH /api/bookings/:id/status enforcement)
// ---------------------------------------------------------------------------
const STATUS_TRANSITIONS = {
  confirmed:   ['in_progress', 'completed'],  // completed allowed for Camilla manual close
  in_progress: ['completed'],
  completed:   ['invoiced'],
  invoiced:    [],                            // terminal state
}

const isValidTransition = (from, to) =>
  (STATUS_TRANSITIONS[from] || []).includes(to)

module.exports = {
  clients,
  users,
  intakeSubmissions,
  bookings,
  findIntakeById,
  findIntakeByReferenceNumber,
  findBookingById,
  findBookingByReferenceNumber,
  findClientById,
  findUserById,
  getPendingIntakes,
  getBookingsByStatus,
  getRevenueLeakageAlerts,
  simulateConfirm,
  isValidTransition,
  STATUS_TRANSITIONS,
}
