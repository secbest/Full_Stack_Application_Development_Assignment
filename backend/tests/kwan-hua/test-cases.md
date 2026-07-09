# Backend Test Cases - Kwan Hua

_List all test cases below before submission. Include what is being tested and the expected outcome._

| # | Test File | What is Tested | Expected Outcome |
|---|-----------|---------------|-----------------|
| 1 | xero.test.js | `calculateRebate()` with the default 1% rebate on a known total | Returns `rebate_amount = 18.40`, `verified_total = 1821.60` for a $1840 invoice |
| 2 | xero.test.js | `calculateRebate()` with a custom rebate percentage | Returns `rebate_amount = 25.00`, `verified_total = 975.00` for $1000 at 2.5% |
| 3 | xero.test.js | `calculateRebate()` when `extracted_total` is not yet known (OCR incomplete) | Returns `{ rebateAmount: null, verifiedTotal: null }` instead of throwing |
| 4 | xero.test.js | `calculateRebate()` rounding behaviour | Rounds the rebate amount to 2 decimal places |
| 5 | xero.test.js | `xeroService.getAuthorizationUrl()` when `XERO_CLIENT_ID`/`XERO_REDIRECT_URI` are missing | Throws an error with `code: 'XERO_CONFIG_MISSING'` |
| 6 | xero.test.js | `xeroService.getAuthorizationUrl()` with valid env config | Returns a `login.xero.com` URL containing the correct `client_id`, `redirect_uri`, and `accounting.transactions` scope |
| 7 | xero.test.js | `xeroService.getAuthorizationUrl()` called twice in a row | Generates a different `state` CSRF token each time |
| 8 | xero.test.js | `xeroService.consumeState()` on a freshly issued state | Validates once then returns `false` on reuse (single-use CSRF token) |
| 9 | xero.test.js | `xeroService.consumeState()` on an unknown/empty state | Returns `false` |
| 10 | xero.test.js | `xeroService.isSimulation()` default and explicit values | Defaults to `true`; only `XERO_SIMULATION="false"` turns it off |
| 11 | xero.test.js | `xeroService.computeRetryAvailable()` (UC-08 retry rule) | `true` only when status `failed`, `attempt_count < 3`, and Xero connected; `false` otherwise |
| 12 | xero.test.js | `xeroService.encryptToken()`/`decryptToken()` round-trip | Ciphertext is `iv:tag:ciphertext`, excludes the plaintext, and decrypts back to the original |
| 13 | xero.test.js | `xeroService.encryptToken()` with an invalid encryption key | Throws an error with `code: 'XERO_CONFIG_MISSING'` |
| 14 | xero.test.js | `xeroService.pushBill()` in simulation mode | Resolves `{ ok: true, xeroRecordId }` with a generated record id |
| 15 | pricing.test.js | `selectBaseRate()` time-of-day preference | Picks office/non-office row when present, falls back to `all_hours`, returns null when no rate |
| 16 | pricing.test.js | `computeInvoiceLineItems()` base rate only | One line item equal to the base rate; subtotal matches |
| 17 | pricing.test.js | `computeInvoiceLineItems()` non-office-hours selection | Uses the higher non-office-hours base rate |
| 18 | pricing.test.js | `computeInvoiceLineItems()` oxygen over 10L | Adds oxygen base + per-litre line for litres beyond 10 |
| 19 | pricing.test.js | `computeInvoiceLineItems()` oxygen <=10L | Adds only the oxygen base charge, no per-litre line |
| 20 | pricing.test.js | `computeInvoiceLineItems()` waiting time blocks | Charges per completed 30-min block (65 min -> 2 blocks); under 30 min -> no charge |
| 21 | pricing.test.js | `computeInvoiceLineItems()` heavy lifting threshold | Applies at exactly 90 kg, not below |
| 22 | pricing.test.js | `computeInvoiceLineItems()` multiple stacked surcharges | Sums all applicable surcharges into the subtotal |
| 23 | pricing.test.js | `computeInvoiceLineItems()` skips unpriced surcharges | Surcharge types absent from the contract are not charged |
| 24 | pricing.test.js | `computeInvoiceLineItems()` no matching rate | Returns `matched: false` with no line items (controller marks invoice `unmatched`) |
| 25 | pricing.test.js | `computeInvoiceLineItems()` manual-adjustment flag | Every engine-generated line item has `is_manual_adjustment: false` |
| 26 | pricing.test.js | `toSurchargeMap()` | Reduces surcharge rows to a `type -> amount` numeric map |
