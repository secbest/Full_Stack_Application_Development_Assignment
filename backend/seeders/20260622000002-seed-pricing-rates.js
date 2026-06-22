'use strict'

// Foreign key: contract_id -> pricing_contracts.id
//   contract_id 1 = TTSH (hospital) - full rate matrix
//   contract_id 2 = ABC Corp (event/workplace) - narrow rate matrix
//   contract_id 3 = SingHealth (expired) - intentionally has NO rows to test
//                   the "no matching rate" branch in the pricing engine (UC-04)

const NOW = new Date().toISOString()

// Helper so each row doesn't repeat the boilerplate
const rate = (contract_id, service_type, transfer_type, time_of_day, base_amount) => ({
  contract_id,
  service_type,
  transfer_type,
  time_of_day,
  base_amount,
  created_at: NOW,
  updated_at: NOW,
})

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('pricing_rates', [
      // --- Contract 1: TTSH - EAS rates ---
      // EAS one-way hospital has two time-of-day rows (office vs non-office)
      rate(1, 'eas', 'one_way_hospital',   'office_hours',     850.00),
      rate(1, 'eas', 'one_way_hospital',   'non_office_hours', 950.00),
      rate(1, 'eas', 'two_way_hospital',   'all_hours',       1500.00),
      rate(1, 'eas', 'covid_19',           'all_hours',       1200.00),
      rate(1, 'eas', 'imh_psychiatric',    'all_hours',       1100.00),
      rate(1, 'eas', 'airport_no_tarmac',  'all_hours',       1050.00),
      rate(1, 'eas', 'airport_with_tarmac','all_hours',       1250.00),
      rate(1, 'eas', 'air_evacuation',     'all_hours',       5000.00),

      // --- Contract 1: TTSH - MTS rates ---
      rate(1, 'mts', 'one_way_hospital',   'office_hours',     550.00),
      rate(1, 'mts', 'one_way_hospital',   'non_office_hours', 650.00),
      rate(1, 'mts', 'two_way_hospital',   'all_hours',        900.00),
      rate(1, 'mts', 'airport_no_tarmac',  'all_hours',        900.00),
      rate(1, 'mts', 'airport_with_tarmac','all_hours',       1050.00),
      rate(1, 'mts', 'sg_jb_ground',       'all_hours',       1800.00),

      // --- Contract 2: ABC Corp - event and workplace standby ---
      // event_standby: one-way hospital only (all other transfers not in scope)
      rate(2, 'event_standby',    'one_way_hospital', 'office_hours',     700.00),
      rate(2, 'event_standby',    'one_way_hospital', 'non_office_hours', 800.00),
      // workplace_standby: rate applies regardless of time
      rate(2, 'workplace_standby','one_way_hospital', 'all_hours',        750.00),

      // Contract 3 intentionally has no rows - expired contract with no usable rates.
      // The pricing engine must return status='unmatched' for any job linked to client 3.
    ])
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('pricing_rates', null, {})
  },
}
