// Owner: Kwan Hua (Wave 3 takeover of the AR stream).
//
// Resolves the surcharge schedule the pricing engine should price a memo against.
//
// Why this exists: surcharges are NOT negotiated per client. EFAR's published pricing
// table lists one rate card for oxygen, inconvenience, disposables, resuscitation,
// suction, waiting time, heavy lifting and Jurong Island; only the base transport rates
// differ per contract. The engine previously read surcharges straight from
// surcharge_schedules WHERE contract_id = <contract>, which meant:
//
//   - a booking priced by one-off quotation (pricing_contract_id NULL) got an empty
//     schedule, so EVERY recorded charge came back unpriced and every invoice warned; and
//   - a contract with a partial schedule silently lost the surcharges it did not list.
//
// Both are revenue leakage of exactly the kind this platform exists to stop.
//
// Resolution order: contract row -> global default (contract_id NULL) -> unpriced.
// A contract row overrides the published rate for that one surcharge type, which is what
// a negotiated schedule genuinely is. A type absent from BOTH is still reported unpriced,
// so a genuinely unknown charge is never invented.

const { SurchargeSchedule } = require('../models')

// EFAR's published rate card, transcribed from the pricing table in the project brief.
// Seeded into surcharge_schedules as contract_id NULL rows by
// scripts/migrate-default-surcharges.js. Kept here as the canonical source so the seed
// and any future re-seed cannot drift from one another.
const PUBLISHED_SURCHARGE_RATES = [
  { surcharge_type: 'oxygen_base',            amount: 50.00 },  // "Use of Oxygen: S$50.00 - minimum charge"
  { surcharge_type: 'oxygen_per_litre',       amount: 1.00 },   // "From 10 litres onwards - $1/litre"
  { surcharge_type: 'inconvenience_fee',      amount: 50.00 },  // Chargeable per floor / no lift landing
  { surcharge_type: 'disposables_base',       amount: 20.00 },  // "Usage of Disposables $20 (Min)"
  { surcharge_type: 'resuscitation',          amount: 320.00 },
  { surcharge_type: 'suction',                amount: 50.00 },
  { surcharge_type: 'waiting_time_per_30min', amount: 30.00 },  // "Waiting Time (every 30mins)"
  { surcharge_type: 'heavy_lifting_min',      amount: 50.00 },  // "Heavy Lifting (90kg and Above) $50 - $150"
  { surcharge_type: 'heavy_lifting_max',      amount: 150.00 },
  { surcharge_type: 'jurong_island_min',      amount: 150.00 }, // "Surcharge for transport to/fro Jurong Island"
  { surcharge_type: 'jurong_island_max',      amount: 200.00 }, // $150 office hours / $200 non-office hours
]

// Deliberately NOT in the published table, so deliberately NOT defaulted:
//   - overtime_per_hour: no published rate; contracts that charge it must set their own.
//   - cancellation: the table says "100% Upon Activation", a rule rather than a flat
//     amount, so it cannot be represented as a single default figure.
// Both stay unpriced unless a contract prices them, which is the correct, visible outcome.

/**
 * Loads the effective surcharge rows for a contract, with global defaults filled in
 * underneath. Returns plain { surcharge_type, amount } rows in the shape
 * pricingService.toSurchargeMap expects.
 *
 * @param {number|null} contractId - null/undefined for a one-off quote with no contract.
 * @param {object} [options]
 * @param {object} [options.transaction] - optional Sequelize transaction.
 */
async function resolveSurchargeRows(contractId, { transaction } = {}) {
  const globals = await SurchargeSchedule.findAll({
    where: { contract_id: null },
    attributes: ['surcharge_type', 'amount'],
    transaction,
  })

  if (!contractId) return globals.map(toPlainRow)

  const contractRows = await SurchargeSchedule.findAll({
    where: { contract_id: contractId },
    attributes: ['surcharge_type', 'amount'],
    transaction,
  })

  // Contract rows win. Building the map global-first and overwriting means a contract
  // that prices only two surcharges still inherits the published rate for the rest,
  // instead of dropping them the way the old contract-only query did.
  const byType = new Map()
  for (const row of globals) byType.set(row.surcharge_type, toPlainRow(row))
  for (const row of contractRows) byType.set(row.surcharge_type, toPlainRow(row))
  return [...byType.values()]
}

function toPlainRow(row) {
  return { surcharge_type: row.surcharge_type, amount: Number(row.amount) }
}

module.exports = { resolveSurchargeRows, PUBLISHED_SURCHARGE_RATES }
