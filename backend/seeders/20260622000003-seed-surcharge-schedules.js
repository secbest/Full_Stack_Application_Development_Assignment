'use strict'

// Foreign key: contract_id -> pricing_contracts.id
// Each active contract gets a full set of 12 surcharge rows at EFAR's published default rates.
// Contract 3 (expired SingHealth) is given no surcharges - consistent with having no rates.

const NOW = new Date().toISOString()

const surcharge = (contract_id, surcharge_type, amount) => ({
  contract_id,
  surcharge_type,
  amount,
  created_at: NOW,
  updated_at: NOW,
})

// Full 12-row schedule at published default rates
const defaultSchedule = (contract_id) => [
  surcharge(contract_id, 'oxygen_base',            50.00),
  surcharge(contract_id, 'oxygen_per_litre',         1.00),
  surcharge(contract_id, 'inconvenience_fee',        50.00),
  surcharge(contract_id, 'disposables_base',         20.00),
  surcharge(contract_id, 'resuscitation',           320.00),
  surcharge(contract_id, 'suction',                  50.00),
  surcharge(contract_id, 'waiting_time_per_30min',   30.00),
  surcharge(contract_id, 'heavy_lifting_min',         50.00),
  surcharge(contract_id, 'heavy_lifting_max',        150.00),
  surcharge(contract_id, 'jurong_island_min',        150.00),
  surcharge(contract_id, 'jurong_island_max',        200.00),
  surcharge(contract_id, 'cancellation',            100.00),
]

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('surcharge_schedules', [
      // Contract 1 (TTSH) - full schedule at default rates
      ...defaultSchedule(1),

      // Contract 2 (ABC Corp) - full schedule but with a negotiated cancellation waiver (50%)
      // and a slightly higher Jurong Island max to reflect their site locations
      surcharge(2, 'oxygen_base',            50.00),
      surcharge(2, 'oxygen_per_litre',         1.00),
      surcharge(2, 'inconvenience_fee',        50.00),
      surcharge(2, 'disposables_base',         20.00),
      surcharge(2, 'resuscitation',           320.00),
      surcharge(2, 'suction',                  50.00),
      surcharge(2, 'waiting_time_per_30min',   30.00),
      surcharge(2, 'heavy_lifting_min',         50.00),
      surcharge(2, 'heavy_lifting_max',        150.00),
      surcharge(2, 'jurong_island_min',        150.00),
      surcharge(2, 'jurong_island_max',        220.00), // negotiated higher max
      surcharge(2, 'cancellation',             50.00),  // negotiated 50% cancellation
    ])
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('surcharge_schedules', null, {})
  },
}
