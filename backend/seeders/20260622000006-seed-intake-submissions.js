'use strict'

// Foreign key dependencies:
//   reviewed_by -> users.id (Group / shared)
//
// Assumed stub IDs while shared table is not yet built:
//   users: 5 = Camilla Wong (quotations_specialist)
//
// Group A (ids 1-2)  - pending, Camilla has not actioned these yet
// Group B (ids 3-8)  - confirmed, each links to a booking (booking_ids 1-6)
//                      that Jasper's invoice seeds already reference
// Group C (ids 9-10) - rejected, covering the two main rejection reasons
// Group D (ids 11-14)- confirmed, each links to a booking (booking_ids 7-10)
//                      used for the booking-management scenarios

const NOW = new Date().toISOString()

// Helper so each row doesn't repeat boilerplate
const sub = (fields) => ({ ...fields, created_at: fields.created_at || NOW, updated_at: fields.updated_at || NOW })

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('intake_submissions', [

      // -----------------------------------------------------------------------
      // Group A: Pending - sitting in Camilla's intake queue (UC-02)
      // -----------------------------------------------------------------------
      sub({
        // 1 - Standard EAS request from TTSH billing team.
        //     No crew assigned yet; Camilla needs to review.
        reference_number: 'EFAR-2026-00001',
        customer_name: 'Wei Lin Tan',
        organisation: 'Tan Tock Seng Hospital',
        contact_email: 'weiling.tan@ttsh.com.sg',
        contact_phone: '64501234',
        service_type: 'eas',
        service_tier: 'advanced',
        preferred_date: '2026-07-10',
        preferred_time: '14:00',
        pickup_location: 'Tan Tock Seng Hospital, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'Singapore General Hospital, Outram Road, Singapore 169608',
        additional_notes: 'Patient is on supplemental oxygen. Requires monitoring throughout transfer.',
        status: 'pending',
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: '2026-07-08T09:20:00.000Z',
        updated_at: '2026-07-08T09:20:00.000Z',
      }),
      sub({
        // 2 - Event standby request from ABC Corporation for their annual sports day.
        //     Lower urgency; Camilla can process this after the hospital queue.
        reference_number: 'EFAR-2026-00002',
        customer_name: 'Marcus Lim',
        organisation: 'ABC Corporation',
        contact_email: 'marcus.lim@abc-corp.com.sg',
        contact_phone: '65432100',
        service_type: 'event_standby',
        service_tier: 'basic',
        preferred_date: '2026-08-15',
        preferred_time: '08:00',
        pickup_location: 'ABC Corporation HQ, 10 Anson Road, Singapore 079903',
        destination: 'Nearest A&E (if activated)',
        additional_notes: 'Annual company sports day. Approx 200 participants. Request standby from 0800-1700.',
        status: 'pending',
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: '2026-07-09T14:05:00.000Z',
        updated_at: '2026-07-09T14:05:00.000Z',
      }),

      // -----------------------------------------------------------------------
      // Group B: Confirmed - these link to bookings 1-6 (AR billing scenarios)
      // -----------------------------------------------------------------------
      sub({
        // 3 -> booking_id 1 | EAS one-way hospital, office hours | invoice: matched $850
        reference_number: 'EFAR-2026-00003',
        customer_name: 'Dr. Priya Nair',
        organisation: 'Tan Tock Seng Hospital',
        contact_email: 'priya.nair@ttsh.com.sg',
        contact_phone: '64501111',
        service_type: 'eas',
        service_tier: 'advanced',
        preferred_date: '2026-06-10',
        preferred_time: '09:00',
        pickup_location: 'Tan Tock Seng Hospital, Ward 5B, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'National University Hospital, 5 Lower Kent Ridge Road, Singapore 119074',
        additional_notes: null,
        status: 'confirmed',
        rejection_reason: null,
        reviewed_by: 5,
        reviewed_at: '2026-06-08T10:00:00.000Z',
        created_at: '2026-06-07T16:30:00.000Z',
        updated_at: '2026-06-08T10:00:00.000Z',
      }),
      sub({
        // 4 -> booking_id 2 | EAS one-way hospital, non-office hours
        //      Customer selected 'basic'; Camilla upgraded to 'advanced' (UC-05 tier adjustment).
        //      Invoice: adjusted $1080 (oxygen + inconvenience + manual admin)
        reference_number: 'EFAR-2026-00004',
        customer_name: 'Siti Rahimah',
        organisation: 'Tan Tock Seng Hospital',
        contact_email: 'siti.r@ttsh.com.sg',
        contact_phone: '64502222',
        service_type: 'eas',
        service_tier: 'basic',      // customer's original selection (stored here for audit)
        preferred_date: '2026-06-11',
        preferred_time: '22:00',
        pickup_location: 'Tan Tock Seng Hospital, A&E, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'Khoo Teck Puat Hospital, 90 Yishun Central, Singapore 768828',
        additional_notes: 'Patient requiring oxygen support. Floor access at destination.',
        status: 'confirmed',
        rejection_reason: null,
        reviewed_by: 5,
        reviewed_at: '2026-06-10T08:30:00.000Z',
        created_at: '2026-06-09T20:00:00.000Z',
        updated_at: '2026-06-10T08:30:00.000Z',
      }),
      sub({
        // 5 -> booking_id 3 | EAS COVID-19 transport
        //      Invoice: approved $1570 (resuscitation + suction)
        reference_number: 'EFAR-2026-00005',
        customer_name: 'Ahmad Fauzi',
        organisation: 'Tan Tock Seng Hospital',
        contact_email: 'ahmad.fauzi@ttsh.com.sg',
        contact_phone: '64503333',
        service_type: 'eas',
        service_tier: 'critical',
        preferred_date: '2026-06-13',
        preferred_time: '11:00',
        pickup_location: 'Tan Tock Seng Hospital, Isolation Ward, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'National Centre for Infectious Diseases, 16 Jalan Tan Tock Seng, Singapore 308442',
        additional_notes: 'COVID-19 positive patient. Full PPE required.',
        status: 'confirmed',
        rejection_reason: null,
        reviewed_by: 5,
        reviewed_at: '2026-06-12T09:00:00.000Z',
        created_at: '2026-06-11T17:00:00.000Z',
        updated_at: '2026-06-12T09:00:00.000Z',
      }),
      sub({
        // 6 -> booking_id 4 | MTS airport with tarmac + Jurong Island
        //      Invoice: synced_to_xero $1200
        reference_number: 'EFAR-2026-00006',
        customer_name: 'Chen Wei',
        organisation: 'Tan Tock Seng Hospital',
        contact_email: 'chen.wei@ttsh.com.sg',
        contact_phone: '64504444',
        service_type: 'mts',
        service_tier: 'advanced',
        preferred_date: '2026-06-14',
        preferred_time: '07:30',
        pickup_location: 'Changi Airport Terminal 3 Tarmac, Singapore 819663',
        destination: 'Jurong Island Medical Centre, Jurong Island, Singapore',
        additional_notes: 'Repatriation case from inbound flight. Tarmac access required. Jurong Island destination.',
        status: 'confirmed',
        rejection_reason: null,
        reviewed_by: 5,
        reviewed_at: '2026-06-13T11:00:00.000Z',
        created_at: '2026-06-12T22:00:00.000Z',
        updated_at: '2026-06-13T11:00:00.000Z',
      }),
      sub({
        // 7 -> booking_id 5 | EAS one-way hospital, office hours
        //      Invoice: failed Xero sync
        reference_number: 'EFAR-2026-00007',
        customer_name: 'Raj Kumaran',
        organisation: 'Tan Tock Seng Hospital',
        contact_email: 'raj.k@ttsh.com.sg',
        contact_phone: '64505555',
        service_type: 'eas',
        service_tier: 'basic',
        preferred_date: '2026-06-15',
        preferred_time: '08:00',
        pickup_location: 'Tan Tock Seng Hospital, Ward 3A, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'Alexandra Hospital, 378 Alexandra Road, Singapore 159964',
        additional_notes: null,
        status: 'confirmed',
        rejection_reason: null,
        reviewed_by: 5,
        reviewed_at: '2026-06-14T09:00:00.000Z',
        created_at: '2026-06-13T18:00:00.000Z',
        updated_at: '2026-06-14T09:00:00.000Z',
      }),
      sub({
        // 8 -> booking_id 6 | EAS, SingHealth client (expired contract → unmatched invoice)
        reference_number: 'EFAR-2026-00008',
        customer_name: 'Linda Goh',
        organisation: 'SingHealth Group',
        contact_email: 'linda.goh@singhealth.com.sg',
        contact_phone: '63214567',
        service_type: 'eas',
        service_tier: 'advanced',
        preferred_date: '2026-06-16',
        preferred_time: '13:00',
        pickup_location: 'Singapore General Hospital, Outram Road, Singapore 169608',
        destination: 'Changi General Hospital, 2 Simei Street 3, Singapore 529889',
        additional_notes: 'Routine inter-hospital transfer.',
        status: 'confirmed',
        rejection_reason: null,
        reviewed_by: 5,
        reviewed_at: '2026-06-15T10:00:00.000Z',
        created_at: '2026-06-14T15:00:00.000Z',
        updated_at: '2026-06-15T10:00:00.000Z',
      }),

      // -----------------------------------------------------------------------
      // Group C: Rejected - covering the main rejection reasons (UC-04)
      // -----------------------------------------------------------------------
      sub({
        // 9 - Outside service area. No booking was created.
        reference_number: 'EFAR-2026-00009',
        customer_name: 'James Wong',
        organisation: null,
        contact_email: 'james.wong@personal.com',
        contact_phone: '91112222',
        service_type: 'mts',
        service_tier: 'basic',
        preferred_date: '2026-06-20',
        preferred_time: '10:00',
        pickup_location: 'Johor Bahru City Square, Malaysia',
        destination: 'Singapore General Hospital, Outram Road, Singapore 169608',
        additional_notes: null,
        status: 'rejected',
        rejection_reason: 'Pickup location is outside EFAR service area. EFAR covers Singapore territory only. Please contact a Malaysian provider for cross-border transport.',
        reviewed_by: 5,
        reviewed_at: '2026-06-18T14:30:00.000Z',
        created_at: '2026-06-17T11:00:00.000Z',
        updated_at: '2026-06-18T14:30:00.000Z',
      }),
      sub({
        // 10 - No crew available on the requested date.
        //      Camilla can reopen within the time window if capacity frees up (UC-04 alternative flow).
        reference_number: 'EFAR-2026-00010',
        customer_name: 'Nurul Huda',
        organisation: 'Parkway Pantai',
        contact_email: 'nurul.h@parkwaypantai.com',
        contact_phone: '67891011',
        service_type: 'eas',
        service_tier: 'basic',
        preferred_date: '2026-06-28',
        preferred_time: '07:00',
        pickup_location: 'Mount Elizabeth Hospital, 3 Mount Elizabeth, Singapore 228510',
        destination: 'Raffles Hospital, 585 North Bridge Road, Singapore 188770',
        additional_notes: 'Early morning transfer required before 0900.',
        status: 'rejected',
        rejection_reason: 'No crew available on the requested date. Please contact us to arrange an alternative date.',
        reviewed_by: 5,
        reviewed_at: '2026-06-20T09:00:00.000Z',
        created_at: '2026-06-19T17:30:00.000Z',
        updated_at: '2026-06-20T09:00:00.000Z',
      }),

      // -----------------------------------------------------------------------
      // Group D: Confirmed - links to bookings 7-10 (booking management scenarios)
      // -----------------------------------------------------------------------
      sub({
        // 11 -> booking_id 7 | event_standby confirmed, no crew assigned yet (UC-06 scenario)
        reference_number: 'EFAR-2026-00011',
        customer_name: 'Marcus Lim',
        organisation: 'ABC Corporation',
        contact_email: 'marcus.lim@abc-corp.com.sg',
        contact_phone: '65432100',
        service_type: 'event_standby',
        service_tier: 'basic',
        preferred_date: '2026-07-20',
        preferred_time: '08:00',
        pickup_location: 'ABC Corporation HQ, 10 Anson Road, Singapore 079903',
        destination: 'Nearest A&E (if activated)',
        additional_notes: 'Corporate event - approx 150 attendees.',
        status: 'confirmed',
        rejection_reason: null,
        reviewed_by: 5,
        reviewed_at: '2026-07-10T10:00:00.000Z',
        created_at: '2026-07-09T14:05:00.000Z',
        updated_at: '2026-07-10T10:00:00.000Z',
      }),
      sub({
        // 12 -> booking_id 8 | MTS confirmed, crew assigned (ready to dispatch)
        reference_number: 'EFAR-2026-00012',
        customer_name: 'Dr. Priya Nair',
        organisation: 'Tan Tock Seng Hospital',
        contact_email: 'priya.nair@ttsh.com.sg',
        contact_phone: '64501111',
        service_type: 'mts',
        service_tier: 'basic',
        preferred_date: '2026-07-25',
        preferred_time: '10:00',
        pickup_location: 'Tan Tock Seng Hospital, Ward 7C, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'Khoo Teck Puat Hospital, 90 Yishun Central, Singapore 768828',
        additional_notes: 'Stable patient, non-emergency transfer.',
        status: 'confirmed',
        rejection_reason: null,
        reviewed_by: 5,
        reviewed_at: '2026-07-20T09:00:00.000Z',
        created_at: '2026-07-19T11:00:00.000Z',
        updated_at: '2026-07-20T09:00:00.000Z',
      }),
      sub({
        // 13 -> booking_id 9 | workplace_standby in_progress right now (crew on site)
        reference_number: 'EFAR-2026-00013',
        customer_name: 'Darren Chia',
        organisation: 'ABC Corporation',
        contact_email: 'darren.chia@abc-corp.com.sg',
        contact_phone: '65439876',
        service_type: 'workplace_standby',
        service_tier: 'basic',
        preferred_date: '2026-06-22',
        preferred_time: '08:00',
        pickup_location: 'ABC Corporation Warehouse, 30 Tuas Road, Singapore 638492',
        destination: 'Nearest A&E (if activated)',
        additional_notes: 'Warehouse safety audit day. Full-shift standby required.',
        status: 'confirmed',
        rejection_reason: null,
        reviewed_by: 5,
        reviewed_at: '2026-06-20T14:00:00.000Z',
        created_at: '2026-06-19T10:00:00.000Z',
        updated_at: '2026-06-20T14:00:00.000Z',
      }),
      sub({
        // 14 -> booking_id 10 | EAS completed, NO memo submitted yet = revenue leakage alert (UC-09)
        reference_number: 'EFAR-2026-00014',
        customer_name: 'Dr. Priya Nair',
        organisation: 'Tan Tock Seng Hospital',
        contact_email: 'priya.nair@ttsh.com.sg',
        contact_phone: '64501111',
        service_type: 'eas',
        service_tier: 'advanced',
        preferred_date: '2026-06-21',
        preferred_time: '15:30',
        pickup_location: 'Tan Tock Seng Hospital, ICU, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'National Heart Centre, 5 Hospital Drive, Singapore 169609',
        additional_notes: 'Cardiac patient requiring urgent transfer.',
        status: 'confirmed',
        rejection_reason: null,
        reviewed_by: 5,
        reviewed_at: '2026-06-20T16:00:00.000Z',
        created_at: '2026-06-20T11:00:00.000Z',
        updated_at: '2026-06-20T16:00:00.000Z',
      }),
    ])
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('intake_submissions', null, {})
  },
}
