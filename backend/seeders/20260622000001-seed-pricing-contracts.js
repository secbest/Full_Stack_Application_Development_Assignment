'use strict'

// Foreign key dependencies (owned by other team members):
//   client_id  -> clients.id  (Group / shared table)
//   created_by -> users.id    (Group / shared table)
//
// Assumed stub IDs while teammates build their tables:
//   clients: 1 = Tan Tock Seng Hospital, 2 = ABC Corporation, 3 = SingHealth Group
//   users:   1 = Sarah (AR Specialist)

const NOW = new Date().toISOString()

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('pricing_contracts', [
      {
        // Contract 1 - active hospital contract (covers most pricing_rates seed data)
        client_id: 1,
        created_by: 1,
        contract_name: 'Tan Tock Seng Hospital - FY2026 Service Agreement',
        effective_from: '2026-01-01',
        effective_to: '2026-12-31',
        is_active: true,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        // Contract 2 - active corporate / event client (narrower rate table)
        client_id: 2,
        created_by: 1,
        contract_name: 'ABC Corporation - Event & Workplace Standby 2026',
        effective_from: '2026-06-01',
        effective_to: '2026-12-31',
        is_active: true,
        created_at: NOW,
        updated_at: NOW,
      },
      {
        // Contract 3 - expired contract (is_active=false); tests that the
        // pricing engine ignores expired contracts and flags invoices as unmatched
        client_id: 3,
        created_by: 1,
        contract_name: 'SingHealth Group - FY2025 Service Agreement',
        effective_from: '2025-01-01',
        effective_to: '2025-12-31',
        is_active: false,
        created_at: NOW,
        updated_at: NOW,
      },
    ])
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('pricing_contracts', null, {})
  },
}
