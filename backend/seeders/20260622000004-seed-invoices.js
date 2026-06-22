'use strict'

// Foreign key dependencies (owned by other team members):
//   memo_id     -> service_memos.id  (Liang Yi)
//   booking_id  -> bookings.id       (Zheng Bao)
//   client_id   -> clients.id        (Group / shared)
//   contract_id -> pricing_contracts.id (Jasper / self)
//   approved_by -> users.id          (Group / shared)
//
// Stub IDs assumed while teammate tables don't exist yet:
//   service_memos:  1-6  (one per scenario below)
//   bookings:       1-6  (one per scenario below)
//   clients:        1 = TTSH, 2 = ABC Corp, 3 = SingHealth (expired)
//   users:          1 = Sarah (AR Specialist)
//
// Each record below exercises one distinct branch of the invoice status flow or pricing logic.

const NOW = new Date().toISOString()

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('invoices', [
      {
        // Invoice 1: clean match, base rate only, no surcharges (EAS one-way hospital, office hours)
        // Status: matched - Sarah has not reviewed yet
        memo_id: 1,
        booking_id: 1,
        client_id: 1,
        contract_id: 1,
        approved_by: null,
        subtotal: 850.00,
        tax_amount: 0.00,
        total_amount: 850.00,
        status: 'matched',
        xero_invoice_id: null,
        approved_at: null,
        created_at: '2026-06-10T09:30:00.000Z',
        updated_at: '2026-06-10T09:30:00.000Z',
      },
      {
        // Invoice 2: base rate (EAS, non-office hours) + oxygen surcharge + inconvenience fee
        // Sarah added a manual admin charge on top - status is 'adjusted'
        memo_id: 2,
        booking_id: 2,
        client_id: 1,
        contract_id: 1,
        approved_by: null,
        subtotal: 1080.00, // $950 base + $50 oxygen + $50 inconvenience + $30 manual admin
        tax_amount: 0.00,
        total_amount: 1080.00,
        status: 'adjusted',
        xero_invoice_id: null,
        approved_at: null,
        created_at: '2026-06-11T22:15:00.000Z',
        updated_at: '2026-06-12T10:00:00.000Z',
      },
      {
        // Invoice 3: EAS COVID-19 with resuscitation and suction - high-value invoice
        // Status: approved by Sarah, pending Xero push
        memo_id: 3,
        booking_id: 3,
        client_id: 1,
        contract_id: 1,
        approved_by: 1,
        subtotal: 1570.00, // $1200 base + $320 resuscitation + $50 suction
        tax_amount: 0.00,
        total_amount: 1570.00,
        status: 'approved',
        xero_invoice_id: null,
        approved_at: '2026-06-13T14:00:00.000Z',
        created_at: '2026-06-13T11:00:00.000Z',
        updated_at: '2026-06-13T14:00:00.000Z',
      },
      {
        // Invoice 4: MTS airport with tarmac + Jurong Island surcharge - successfully pushed to Xero
        // Status: synced_to_xero - represents the happy-path terminal state
        memo_id: 4,
        booking_id: 4,
        client_id: 1,
        contract_id: 1,
        approved_by: 1,
        subtotal: 1200.00, // $1050 base + $150 Jurong Island (min rate applied)
        tax_amount: 0.00,
        total_amount: 1200.00,
        status: 'synced_to_xero',
        xero_invoice_id: 'INV-XR-20260614-0041',
        approved_at: '2026-06-14T09:00:00.000Z',
        created_at: '2026-06-14T07:30:00.000Z',
        updated_at: '2026-06-14T09:45:00.000Z',
      },
      {
        // Invoice 5: EAS one-way hospital, office hours - Xero rejected the payload
        // (e.g. contact code not found in Xero chart of accounts)
        // Status: failed - Sarah can retry from the sync panel (UC-07 error branch)
        memo_id: 5,
        booking_id: 5,
        client_id: 1,
        contract_id: 1,
        approved_by: 1,
        subtotal: 850.00,
        tax_amount: 0.00,
        total_amount: 850.00,
        status: 'failed',
        xero_invoice_id: null,
        approved_at: '2026-06-15T10:00:00.000Z',
        created_at: '2026-06-15T08:00:00.000Z',
        updated_at: '2026-06-15T10:15:00.000Z',
      },
      {
        // Invoice 6: SingHealth client whose contract expired in 2025.
        // No active contract exists - pricing engine sets status 'unmatched'.
        // Sarah must create/reactivate a contract before this can be rematched (UC-04 error branch).
        memo_id: 6,
        booking_id: 6,
        client_id: 3,
        contract_id: 3, // the expired contract; referenced for audit trail only
        approved_by: null,
        subtotal: 0.00,
        tax_amount: 0.00,
        total_amount: 0.00,
        status: 'unmatched',
        xero_invoice_id: null,
        approved_at: null,
        created_at: '2026-06-16T13:00:00.000Z',
        updated_at: '2026-06-16T13:00:00.000Z',
      },
    ])
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('invoices', null, {})
  },
}
