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
| 27 | contracts.test.js | `computeIsActive()` future vs. past end date | Returns `true`/`false` based on whether `effective_to` has lapsed |
| 28 | contracts.test.js | `createContract()` duplicate rate rows in one payload | 409 `RATE_DUPLICATE` before any DB call |
| 29 | contracts.test.js | `createContract()` duplicate surcharge_type rows in one payload | 400 `VALIDATION_ERROR` before any DB call |
| 30 | contracts.test.js | `createContract()` unknown client_id | 404 `CLIENT_NOT_FOUND` |
| 31 | contracts.test.js | `createContract()` overlapping active contract for the same client | 409 `CONTRACT_OVERLAP`, no contract row created |
| 32 | contracts.test.js | `createContract()` happy path with rates + surcharges | 201, rates/surcharges echoed back, `warning: null` |
| 33 | contracts.test.js | `createContract()` with zero rates | 201 with a non-null `warning` about un-priceable jobs |
| 34 | contracts.test.js | `updateContract()` unknown id | 404 `CONTRACT_NOT_FOUND` |
| 35 | contracts.test.js | `updateContract()` `effective_to` before `effective_from` | 400 `VALIDATION_ERROR` |
| 36 | contracts.test.js | `updateContract()` matched invoices exist, no acknowledgment | 400 `HAS_MATCHED_INVOICES` with `matched_invoice_count` |
| 37 | contracts.test.js | `updateContract()` matched invoices exist + `acknowledge_matched_invoices: true` | 200, edit proceeds |
| 38 | contracts.test.js | `updateContract()` explicit `is_active` override | Explicit value always wins over the recomputed one |
| 39 | contracts.test.js | `updateContract()` end date moved into the past, no explicit `is_active` | Auto-deactivates (`is_active: false`) |
| 40 | contracts.test.js | `addRate()` unknown contract id | 404 `CONTRACT_NOT_FOUND` |
| 41 | contracts.test.js | `addRate()` duplicate (service_type, transfer_type, time_of_day) | 409 `RATE_DUPLICATE` |
| 42 | contracts.test.js | `addRate()` happy path | 201 with the new rate row |
| 43 | contracts.test.js | `deleteRate()` unknown rate id on this contract | 404 `RATE_NOT_FOUND` |
| 44 | contracts.test.js | `deleteRate()` contract has billing history | 409 `RATE_IN_USE`, no delete |
| 45 | contracts.test.js | `deleteRate()` contract has no billing history | 200, row destroyed |
| 46 | contracts.test.js | `updateSurcharge()` unknown surcharge id on this contract | 404 `SURCHARGE_NOT_FOUND` |
| 47 | contracts.test.js | `updateSurcharge()` happy path | 200, amount updated |
| 48 | invoices.test.js | `addLineItem()` unknown invoice id | 404 |
| 49 | invoices.test.js | `addLineItem()` invoice `approved`/`synced_to_xero` | 409 `INVOICE_LOCKED` |
| 50 | invoices.test.js | `addLineItem()` blank description or non-positive qty/price | 400 `VALIDATION_ERROR` |
| 51 | invoices.test.js | `addLineItem()` happy path on a `matched` invoice | 201, invoice flips to `adjusted`, subtotal recalculated |
| 52 | invoices.test.js | `updateLineItem()` negative quantity | 400 `VALIDATION_ERROR` |
| 53 | invoices.test.js | `updateLineItem()` unknown item id on this invoice | 404 |
| 54 | invoices.test.js | `updateLineItem()` happy path | `amount` recomputed as `qty * unit_price`, invoice re-totaled |
| 55 | invoices.test.js | `deleteLineItem()` engine-generated item (`is_manual_adjustment: false`) | 403 `SYSTEM_LINE_ITEM` |
| 56 | invoices.test.js | `deleteLineItem()` manual item | 200, deleted + totals recalculated |
| 57 | invoices.test.js | `batchApprove()` empty/non-array `invoice_ids` | 400 `VALIDATION_ERROR` |
| 58 | invoices.test.js | `batchApprove()` Xero not connected | 503 `XERO_NOT_CONNECTED` |
| 59 | invoices.test.js | `batchApprove()` mixed eligible/ineligible invoices | Ineligible ids skipped, eligible ones approved + synced |
| 60 | invoices.test.js | `batchApprove()` Xero push fails for one invoice | Invoice marked `failed`, AR specialist notified |
| 61 | invoices.test.js | `retryXero()` unknown invoice id | 404 |
| 62 | invoices.test.js | `retryXero()` invoice not `failed` | 409 `INVOICE_NOT_FAILED` |
| 63 | invoices.test.js | `retryXero()` Xero not connected | 503 `XERO_NOT_CONNECTED` |
| 64 | invoices.test.js | `retryXero()` Xero rejects the retried push | 502 `XERO_SYNC_ERROR` |
| 65 | invoices.test.js | `retryXero()` happy path | 200, invoice -> `synced_to_xero` with a Xero id |
| 66 | memo-review.test.js | `approveMemo()` unknown memo id | 404 |
| 67 | memo-review.test.js | `approveMemo()` memo not `submitted` | 409 `MEMO_ALREADY_REVIEWED` |
| 68 | memo-review.test.js | `approveMemo()` invoice already exists for this memo | 409 `MEMO_ALREADY_REVIEWED` |
| 69 | memo-review.test.js | `approveMemo()` client has no active contract | 422 `NO_ACTIVE_CONTRACT`, `unmatched` invoice with `contract_id: null` |
| 70 | memo-review.test.js | `approveMemo()` active contract but no matching rate | 422 `NO_MATCHING_RATE`, `unmatched` invoice with the contract id set |
| 71 | memo-review.test.js | `approveMemo()` happy path | 200, `matched` invoice with line items, memo -> `reviewed` |
| 72 | memo-review.test.js | `returnMemo()` missing/blank note | 400 `VALIDATION_ERROR` |
| 73 | memo-review.test.js | `returnMemo()` unknown memo id | 404 |
| 74 | memo-review.test.js | `returnMemo()` linked invoice already `approved`/`synced_to_xero` | 409 `MEMO_ALREADY_INVOICED` |
| 75 | memo-review.test.js | `returnMemo()` happy path | Memo -> `submitted` with `ar_note`, crew notified |
| 76 | vendor-invoices.test.js | `uploadVendorInvoice()` no file attached | 400 `INVALID_FILE_TYPE` |
| 77 | vendor-invoices.test.js | `updateVendorInvoice()` unknown id | 404 |
| 78 | vendor-invoices.test.js | `updateVendorInvoice()` invoice not in an editable status | 409 `INVALID_STATUS` |
| 79 | vendor-invoices.test.js | `updateVendorInvoice()` non-positive `extracted_total` | 400 `INVALID_TOTAL` |
| 80 | vendor-invoices.test.js | `updateVendorInvoice()` `extracted_total` change | Rebate + verified total recalculated |
| 81 | vendor-invoices.test.js | `updateVendorInvoice()` duplicate vendor+invoice_number | 409 `DUPLICATE_INVOICE` |
| 82 | vendor-invoices.test.js | `approveVendorInvoice()` unknown id | 404 |
| 83 | vendor-invoices.test.js | `approveVendorInvoice()` not `pending_review` | 409 `INVALID_STATUS` |
| 84 | vendor-invoices.test.js | `approveVendorInvoice()` `extracted_total` not set | 409 `MISSING_TOTAL` |
| 85 | vendor-invoices.test.js | `approveVendorInvoice()` duplicate approved/synced invoice exists | 409 `DUPLICATE_INVOICE` |
| 86 | vendor-invoices.test.js | `approveVendorInvoice()` Xero not connected | 503 `XERO_NOT_CONNECTED` |
| 87 | vendor-invoices.test.js | `approveVendorInvoice()` happy path | 200, invoice -> `synced_to_xero` with a Xero bill id |
| 88 | vendor-invoices.test.js | `approveVendorInvoice()` Xero push fails | 200 with `status: 'failed'`, no bill id |
| 89 | vendor-invoices.test.js | `rejectVendorInvoice()` missing `rejection_reason` | 400 `MISSING_REASON` |
| 90 | vendor-invoices.test.js | `rejectVendorInvoice()` invoice not in an editable status | 409 `INVALID_STATUS` |
| 91 | vendor-invoices.test.js | `rejectVendorInvoice()` happy path | 200, invoice -> `rejected` with the reason stored |
| 92 | vendor-invoice-items.test.js | `updateVendorInvoiceItem()` unknown item id | 404 |
| 93 | vendor-invoice-items.test.js | `updateVendorInvoiceItem()` parent invoice not editable | 409 `INVALID_STATUS` |
| 94 | vendor-invoice-items.test.js | `updateVendorInvoiceItem()` client supplies a false `amount` | Amount derived from quantity × unit price |
| 95 | vendor-invoice-items.test.js | `updateVendorInvoiceItem()` changes unit price | Line and parent totals recomputed |
| 96 | vendor-invoice-items.test.js | `updateVendorInvoiceItem()` amount change | Parent `extracted_total`/rebate recomputed from all line items |
| 97 | vendor-invoice-items.test.js | `createVendorInvoiceItem()` unknown/locked parent | 404 or 409; no item created |
| 98 | vendor-invoice-items.test.js | Add a manual line after OCR failure | Server-derived amount; totals recalculated; status becomes `pending_review`; audit recorded |
| 99 | vendor-invoice-items.test.js | Delete a line from an editable invoice | Item deleted; remaining totals recalculated; audit recorded |
| 100 | vendor-invoice-items.test.js | Delete the final line | Totals become zero and invoice remains `pending_review` for approval validation to block |

_Not covered by unit tests: `uploadVendorInvoice`'s Cloudinary/Gemini OCR happy path and
`reextractVendorInvoice` (both require mocking `fetch`/Cloudinary/OCR I/O rather than pure
DB + logic branches) - these are exercised manually via the AP Invoice Review screen instead._
