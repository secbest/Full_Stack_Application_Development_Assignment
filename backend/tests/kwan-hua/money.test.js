// Cents-safe money rounding (src/utils/money.js).
//
// Both the pricing engine and the AP rebate calculation previously carried their own
// `Math.round(n * 100) / 100`. That multiply is not safe for currency: binary floating
// point stores 1.005 as slightly less than 1.005, so 1.005 * 100 is 100.49999999999999 and
// Math.round floors it to $1.00 where a human expects $1.01.
const { round2 } = require('../../src/utils/money')

describe('round2 (cents-safe money rounding)', () => {
  test('rounds a half cent up rather than down', () => {
    // The exact case the old implementation got wrong.
    expect(round2(1.005)).toBe(1.01)
    expect(round2(2.345)).toBe(2.35)
    expect(round2(8.615)).toBe(8.62)
  })

  test('leaves values just below a half cent alone', () => {
    expect(round2(1.0049)).toBe(1.0)
    expect(round2(2.344)).toBe(2.34)
  })

  test('rounds halves away from zero, so a credit rounds by the same magnitude as a charge', () => {
    // Math.round(-100.5) is -100 (it rounds toward +Infinity), which would round a -1.005
    // rebate to -1.00 while rounding a +1.005 charge to +1.01.
    expect(round2(-1.005)).toBe(-1.01)
    expect(round2(-2.345)).toBe(-2.35)
  })

  test('passes through values already at cent precision', () => {
    expect(round2(0)).toBe(0)
    expect(round2(19.99)).toBe(19.99)
    expect(round2(1200)).toBe(1200)
  })

  test('accepts numeric strings, as Sequelize DECIMAL columns return', () => {
    expect(round2('1.005')).toBe(1.01)
    expect(round2('450.00')).toBe(450)
  })

  test('returns NaN for non-numeric input rather than a misleading number', () => {
    expect(round2('abc')).toBeNaN()
    expect(round2(null)).toBe(0) // Number(null) is 0, which is a real coercion, not garbage
    expect(round2(undefined)).toBeNaN()
    expect(round2(Infinity)).toBeNaN()
  })

  test('stays finite for values large enough to break the string-exponent path', () => {
    // `${1e21}e2` parses as NaN, so there is a multiply fallback. Money never reaches this
    // range, but returning NaN would be worse than a slightly imprecise large number.
    expect(Number.isFinite(round2(1e21))).toBe(true)
  })
})
