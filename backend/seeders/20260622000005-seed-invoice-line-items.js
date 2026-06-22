'use strict'

// Foreign key: invoice_id -> invoices.id (Jasper / self)
//
// Line items reflect what the pricing engine would generate from service memo fields.
// invoice_id 6 (unmatched) has no line items - the engine halted before generating any.

const NOW = new Date().toISOString()

const line = (invoice_id, description, quantity, unit_price, amount, is_manual_adjustment = false, created_at = NOW) => ({
  invoice_id,
  description,
  quantity,
  unit_price,
  amount,
  is_manual_adjustment,
  created_at,
  updated_at: created_at,
})

module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert('invoice_line_items', [
      // --- Invoice 1: matched, base rate only ---
      line(1, 'EAS - One-Way Hospital Transfer (Office Hours)', 1, 850.00, 850.00, false, '2026-06-10T09:30:00.000Z'),

      // --- Invoice 2: adjusted - base + two surcharges + manual admin charge ---
      line(2, 'EAS - One-Way Hospital Transfer (Non-Office Hours)', 1, 950.00, 950.00, false, '2026-06-11T22:15:00.000Z'),
      // Oxygen: patient used 15L. Base $50 covers first 10L; 5 extra litres at $1/L = $5.
      // Total oxygen = $50 + $5 = $55, but contract rounds to base minimum here: $50 base is the minimum.
      // Engine generates two line items when usage exceeds 10L.
      line(2, 'Oxygen Charge - Base (first 10L)', 1, 50.00, 50.00, false, '2026-06-11T22:15:00.000Z'),
      line(2, 'Oxygen Charge - Additional (5L @ $1/L)', 5, 1.00, 5.00, false, '2026-06-11T22:15:00.000Z'),
      line(2, 'Inconvenience Fee (Floor/Stair Access)', 1, 50.00, 50.00, false, '2026-06-11T22:15:00.000Z'),
      // Sarah's manual adjustment: hospital administration fee not in contract
      line(2, 'Hospital Administration Fee (Manual Adjustment)', 1, 25.00, 25.00, true, '2026-06-12T10:00:00.000Z'),

      // --- Invoice 3: approved - EAS COVID-19 with resuscitation and suction ---
      line(3, 'EAS - COVID-19 Case Transport', 1, 1200.00, 1200.00, false, '2026-06-13T11:00:00.000Z'),
      line(3, 'Resuscitation Performed', 1, 320.00, 320.00, false, '2026-06-13T11:00:00.000Z'),
      line(3, 'Suction Performed', 1, 50.00, 50.00, false, '2026-06-13T11:00:00.000Z'),

      // --- Invoice 4: synced_to_xero - MTS airport with tarmac + Jurong Island ---
      // Patient weight 95kg triggers heavy lifting. Sarah selected $100 (mid-range) during review.
      line(4, 'MTS - Airport Transfer (With Tarmac Access)', 1, 1050.00, 1050.00, false, '2026-06-14T07:30:00.000Z'),
      line(4, 'Jurong Island Transport Surcharge', 1, 150.00, 150.00, false, '2026-06-14T07:30:00.000Z'),

      // --- Invoice 5: failed Xero push - base rate only, amounts correct ---
      line(5, 'EAS - One-Way Hospital Transfer (Office Hours)', 1, 850.00, 850.00, false, '2026-06-15T08:00:00.000Z'),

      // Invoice 6 (unmatched) has no line items intentionally.
    ])
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('invoice_line_items', null, {})
  },
}
