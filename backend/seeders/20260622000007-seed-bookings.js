'use strict'

// Foreign key dependencies:
//   intake_submission_id -> intake_submissions.id  (Zheng Bao / self - seeded in 00006)
//   client_id            -> clients.id             (Group / shared)
//   created_by           -> users.id               (Group / shared)
//   assigned_crew_id     -> users.id               (Group / shared)
//
// Stub IDs:
//   clients: 1=TTSH, 2=ABC Corp, 3=SingHealth (expired contract)
//   users:   1=Sarah (ar_specialist), 3=Ravi Kumar (field_crew), 5=Camilla (quotations_specialist)
//
// IMPORTANT: booking_ids 1-6 are already referenced by Jasper's invoice seeds
// (20260622000004). The client_id, service_type, and dates here must stay
// consistent with what the invoice seed data was designed against.
//
// Booking 4 is 'invoiced' because its invoice reached 'synced_to_xero'.
// Bookings 1-3, 5-6 remain 'completed' (invoices are in progress but not fully synced).
//
// Bookings 7-10 cover the booking management scenarios (no invoice references yet).

const NOW = new Date().toISOString()

const booking = (fields) => ({
  ...fields,
  created_at: fields.created_at || NOW,
  updated_at: fields.updated_at || NOW,
})

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('bookings', [

      // -----------------------------------------------------------------------
      // Bookings 1-6: AR billing scenarios (must match Jasper's invoice seeds)
      // -----------------------------------------------------------------------
      booking({
        // 1 | EAS one-way hospital, office hours | invoice: matched $850
        reference_number: 'BKG-2026-00001',
        intake_submission_id: 3,
        client_id: 1,
        created_by: 5,
        assigned_crew_id: 3,
        service_type: 'eas',
        service_tier: 'advanced',
        original_service_tier: null,    // Camilla confirmed the customer's tier as-is
        scheduled_date: '2026-06-10',
        scheduled_time: '09:00',
        pickup_location: 'Tan Tock Seng Hospital, Ward 5B, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'National University Hospital, 5 Lower Kent Ridge Road, Singapore 119074',
        status: 'completed',
        notes: null,
        created_at: '2026-06-08T10:00:00.000Z',
        updated_at: '2026-06-10T11:30:00.000Z',
      }),
      booking({
        // 2 | EAS one-way hospital, non-office hours | invoice: adjusted $1080
        //     Camilla upgraded tier: customer sent 'basic', confirmed as 'advanced'
        reference_number: 'BKG-2026-00002',
        intake_submission_id: 4,
        client_id: 1,
        created_by: 5,
        assigned_crew_id: 3,
        service_type: 'eas',
        service_tier: 'advanced',
        original_service_tier: 'basic', // audit trail: customer originally selected basic (UC-05)
        scheduled_date: '2026-06-11',
        scheduled_time: '22:00',
        pickup_location: 'Tan Tock Seng Hospital, A&E, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'Khoo Teck Puat Hospital, 90 Yishun Central, Singapore 768828',
        status: 'completed',
        notes: 'Tier upgraded from Basic to Advanced at review - patient condition warranted monitoring.',
        created_at: '2026-06-10T08:30:00.000Z',
        updated_at: '2026-06-11T23:45:00.000Z',
      }),
      booking({
        // 3 | EAS COVID-19 | invoice: approved $1570 (resuscitation + suction)
        reference_number: 'BKG-2026-00003',
        intake_submission_id: 5,
        client_id: 1,
        created_by: 5,
        assigned_crew_id: 3,
        service_type: 'eas',
        service_tier: 'critical',
        original_service_tier: null,
        scheduled_date: '2026-06-13',
        scheduled_time: '11:00',
        pickup_location: 'Tan Tock Seng Hospital, Isolation Ward, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'National Centre for Infectious Diseases, 16 Jalan Tan Tock Seng, Singapore 308442',
        status: 'completed',
        notes: 'COVID-19 positive patient. Full PPE protocol activated.',
        created_at: '2026-06-12T09:00:00.000Z',
        updated_at: '2026-06-13T14:00:00.000Z',
      }),
      booking({
        // 4 | MTS airport with tarmac + Jurong Island | invoice: synced_to_xero $1200
        //     This is the only booking in 'invoiced' status - full lifecycle complete.
        reference_number: 'BKG-2026-00004',
        intake_submission_id: 6,
        client_id: 1,
        created_by: 5,
        assigned_crew_id: 3,
        service_type: 'mts',
        service_tier: 'advanced',
        original_service_tier: null,
        scheduled_date: '2026-06-14',
        scheduled_time: '07:30',
        pickup_location: 'Changi Airport Terminal 3 Tarmac, Singapore 819663',
        destination: 'Jurong Island Medical Centre, Jurong Island, Singapore',
        status: 'invoiced',            // terminal state - invoice is synced_to_xero
        notes: 'Repatriation case. Tarmac access pass pre-arranged with airport ops.',
        created_at: '2026-06-13T11:00:00.000Z',
        updated_at: '2026-06-14T09:45:00.000Z',
      }),
      booking({
        // 5 | EAS one-way hospital, office hours | invoice: failed Xero sync
        //     Booking remains 'completed' - Xero failure does not change booking status.
        reference_number: 'BKG-2026-00005',
        intake_submission_id: 7,
        client_id: 1,
        created_by: 5,
        assigned_crew_id: 3,
        service_type: 'eas',
        service_tier: 'basic',
        original_service_tier: null,
        scheduled_date: '2026-06-15',
        scheduled_time: '08:00',
        pickup_location: 'Tan Tock Seng Hospital, Ward 3A, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'Alexandra Hospital, 378 Alexandra Road, Singapore 159964',
        status: 'completed',
        notes: null,
        created_at: '2026-06-14T09:00:00.000Z',
        updated_at: '2026-06-15T10:30:00.000Z',
      }),
      booking({
        // 6 | EAS one-way hospital | SingHealth (expired contract) | invoice: unmatched
        //     client_id=3 to match Jasper's invoice seed (expired contract scenario).
        reference_number: 'BKG-2026-00006',
        intake_submission_id: 8,
        client_id: 3,
        created_by: 5,
        assigned_crew_id: 3,
        service_type: 'eas',
        service_tier: 'advanced',
        original_service_tier: null,
        scheduled_date: '2026-06-16',
        scheduled_time: '13:00',
        pickup_location: 'Singapore General Hospital, Outram Road, Singapore 169608',
        destination: 'Changi General Hospital, 2 Simei Street 3, Singapore 529889',
        status: 'completed',
        notes: null,
        created_at: '2026-06-15T10:00:00.000Z',
        updated_at: '2026-06-16T15:00:00.000Z',
      }),

      // -----------------------------------------------------------------------
      // Bookings 7-10: Booking management scenarios
      // -----------------------------------------------------------------------
      booking({
        // 7 | event_standby | ABC Corp | confirmed, NO crew assigned yet (UC-06)
        //     Tests: Camilla's crew assignment flow; empty crew list alert
        reference_number: 'BKG-2026-00007',
        intake_submission_id: 11,
        client_id: 2,
        created_by: 5,
        assigned_crew_id: null,        // no crew assigned - Camilla must assign before dispatch
        service_type: 'event_standby',
        service_tier: 'basic',
        original_service_tier: null,
        scheduled_date: '2026-07-20',
        scheduled_time: '08:00',
        pickup_location: 'ABC Corporation HQ, 10 Anson Road, Singapore 079903',
        destination: 'Nearest A&E (if activated)',
        status: 'confirmed',
        notes: 'Corporate event. 150 attendees. Standby from 0800-1700.',
        created_at: '2026-07-10T10:00:00.000Z',
        updated_at: '2026-07-10T10:00:00.000Z',
      }),
      booking({
        // 8 | MTS | TTSH | confirmed WITH crew assigned (ready to dispatch)
        //     Tests: reassignment flow; crew change log; UC-06 happy path
        reference_number: 'BKG-2026-00008',
        intake_submission_id: 12,
        client_id: 1,
        created_by: 5,
        assigned_crew_id: 3,           // Ravi Kumar assigned and ready
        service_type: 'mts',
        service_tier: 'basic',
        original_service_tier: null,
        scheduled_date: '2026-07-25',
        scheduled_time: '10:00',
        pickup_location: 'Tan Tock Seng Hospital, Ward 7C, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'Khoo Teck Puat Hospital, 90 Yishun Central, Singapore 768828',
        status: 'confirmed',
        notes: 'Stable non-emergency transfer. Crew briefed.',
        created_at: '2026-07-20T09:00:00.000Z',
        updated_at: '2026-07-21T11:00:00.000Z',
      }),
      booking({
        // 9 | workplace_standby | ABC Corp | in_progress (crew on site right now)
        //     Tests: the confirmed→in_progress transition; PATCH /bookings/:id/status endpoint
        reference_number: 'BKG-2026-00009',
        intake_submission_id: 13,
        client_id: 2,
        created_by: 5,
        assigned_crew_id: 3,
        service_type: 'workplace_standby',
        service_tier: 'basic',
        original_service_tier: null,
        scheduled_date: '2026-06-22',
        scheduled_time: '08:00',
        pickup_location: 'ABC Corporation Warehouse, 30 Tuas Road, Singapore 638492',
        destination: 'Nearest A&E (if activated)',
        status: 'in_progress',         // crew activated on-site; field memo not yet submitted
        notes: 'Warehouse safety audit day. Full-shift standby.',
        created_at: '2026-06-20T14:00:00.000Z',
        updated_at: '2026-06-22T08:10:00.000Z',
      }),
      booking({
        // 10 | EAS | TTSH | completed, NO memo submitted yet = REVENUE LEAKAGE ALERT
        //      Job ended > 4 hours ago (threshold), crew has not submitted field memo.
        //      Tests: UC-09 revenue leakage alert; memo_pending_hours highlight in UC-07 list;
        //             Sarah's "Link Memo" action (in case memo is orphaned)
        reference_number: 'BKG-2026-00010',
        intake_submission_id: 14,
        client_id: 1,
        created_by: 5,
        assigned_crew_id: 3,
        service_type: 'eas',
        service_tier: 'advanced',
        original_service_tier: null,
        scheduled_date: '2026-06-21',
        scheduled_time: '15:30',
        pickup_location: 'Tan Tock Seng Hospital, ICU, 11 Jalan Tan Tock Seng, Singapore 308433',
        destination: 'National Heart Centre, 5 Hospital Drive, Singapore 169609',
        status: 'completed',           // set to completed but no service_memos record exists
        notes: 'Cardiac patient urgent transfer. Completed on site ~1730.',
        created_at: '2026-06-20T16:00:00.000Z',
        updated_at: '2026-06-21T17:35:00.000Z',
      }),
    ])
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('bookings', null, {})
  },
}
