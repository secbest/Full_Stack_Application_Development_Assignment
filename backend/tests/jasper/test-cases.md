# Backend Test Cases - Jasper

_List all test cases below before submission. Include what is being tested and the expected outcome._

| # | Test File | What is Tested | Expected Outcome |
|---|-----------|---------------|-----------------|
| 1 | contractValidators.test.js | Yup schemas in `contractValidators.js` used by `contractRoutes.js`'s `validate()` middleware: create/update contract, list-query, rate, and surcharge schemas | Valid bodies pass and defaults apply (`rates`/`surcharges` default to `[]`, `page`/`limit` default to 1/20, `acknowledge_matched_invoices` defaults to `false`); missing/invalid fields, bad date formats, `effective_to` before `effective_from`, out-of-range `limit`/`page`, and negative amounts are all rejected with the exact documented messages |
| 2 | contractController.test.js | `contractController.js` (`listContracts`, `createContract`, `getContractById`, `updateContract`, `addRate`, `updateRate`, `deleteRate`, `updateSurcharge`) with Sequelize models/transaction mocked, real `utils` response helpers | Every documented status/code is produced: `RATE_DUPLICATE`/`VALIDATION_ERROR` for duplicate rows within one create payload, `CLIENT_NOT_FOUND`, `CONTRACT_OVERLAP` (transaction rolled back, no create), the "no pricing rules" warning on a zero-rate create, `CONTRACT_NOT_FOUND`, `HAS_MATCHED_INVOICES` with count (bypassed when acknowledged), `is_active` auto-recompute on a past `effective_to` (explicit `is_active` always wins), `RATE_NOT_FOUND`/`RATE_IN_USE` on delete, `SURCHARGE_NOT_FOUND`, and a generic `INTERNAL_ERROR` 500 on unexpected failures |
