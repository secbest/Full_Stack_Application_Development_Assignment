// Owner: Kwan Hua. Shared money rounding for the pricing engine and the AP rebate calc.
//
// Both previously carried their own `const round2 = (n) => Math.round(n * 100) / 100`.
// That multiply is not safe for currency: binary floating point represents 1.005 as
// slightly LESS than 1.005, so `1.005 * 100` is 100.49999999999999 and Math.round floors
// it to $1.00 when a human (and an auditor) expects $1.01. The error is a cent at a time,
// but it lands in both directions of the ledger - invoice line items and vendor rebates.
//
// Scaling through the decimal STRING form avoids the multiply entirely: JavaScript prints
// the shortest representation that round-trips, so `${1.005}e2` parses as exactly 100.5.

// Halves round away from zero, so -1.005 -> -1.01 rather than Math.round's -1.00. A
// rebate and a credit note should round by the same magnitude rule as a charge.
function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return NaN

  const magnitude = Math.abs(n)
  let scaled = Number(`${magnitude}e2`)
  // Very large or already-exponential inputs stringify to something like "1e+21e2",
  // which parses as NaN. Money here never reaches that range, but fall back rather
  // than silently return NaN.
  if (!Number.isFinite(scaled)) scaled = magnitude * 100

  return (Math.sign(n) || 1) * Math.round(scaled) / 100
}

module.exports = { round2 }
