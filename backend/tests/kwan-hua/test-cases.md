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
