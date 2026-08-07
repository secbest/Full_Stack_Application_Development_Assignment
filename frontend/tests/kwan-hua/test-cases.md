# Frontend Test Cases - Kwan Hua

_List all test cases below before submission. Include what is being tested and the expected outcome._

Covers the AR stream (memo review, invoices, pricing contracts - Wave 3 takeover) and the
AP/Xero stream (vendor invoices, OCR review, Xero connection and sync status - Wave 1B/3).

Run with `npm test` from `frontend/`.

| # | Test File | What is Tested | Expected Outcome |
|---|-----------|---------------|-----------------|
| 1 | ServiceMemoListPage.test.jsx | Stat cards against memos aged 0.5h / 3h / 26h | Awaiting Review counts all 3; Overdue (>4h) counts 1; Approaching (>2h) counts 1 |
| 2 | ServiceMemoListPage.test.jsx | Queue age rendering past 24h | Shows `1d 2h` rather than an unreadable raw hour count |
| 3 | ServiceMemoListPage.test.jsx | Queue age rendering under 1h | Shows `30m` rather than a fractional hour |
| 4 | ServiceMemoListPage.test.jsx | A memo previously returned to the crew | Shows a "Corrected" badge so the review reads as a re-check, not a first look |
| 5 | ServiceMemoListPage.test.jsx | Empty review queue | Explicit "No memos awaiting review" empty state |
| 6 | ServiceMemoListPage.test.jsx | Queue request fails | Error toast instead of a silently empty table |
| 7 | ServiceMemoListPage.test.jsx | Memo review detail pricing panel | All 9 surcharge fields shown unabbreviated (CLAUDE.md logic correction 1) |
| 8 | ServiceMemoListPage.test.jsx | `evacuation_floors` placement | Rendered outside the blue pricing panel - documentation only, not billable (logic correction 4) |
| 9 | ServiceMemoListPage.test.jsx | Return a memo with an empty note | Blocked client-side with an error toast; no PATCH sent |
| 10 | ServiceMemoListPage.test.jsx | Return a memo with a padded note | PATCHes `{ note: 'Oxygen litres missing' }` - trimmed |
| 11 | ServiceMemoListPage.test.jsx | Approval that matches cleanly | Success toast naming the invoice id and total (`Invoice #42 generated ($926.50)`) |
| 12 | ServiceMemoListPage.test.jsx | Approval rejected by the server | Shows the backend message verbatim |
| 13 | ServiceMemoListPage.test.jsx | Approval succeeds but no contract matched | Amber warning toast + navigates to the new unmatched invoice so it is not lost |
| 14 | InvoiceListPage.test.jsx | Table rendering across all 6 statuses | Status badge and Xero id per row; an em dash where there is no Xero id |
| 15 | InvoiceListPage.test.jsx | GST column | `$76.50 (9%)` when a rate was snapshotted; no percentage at all when none was |
| 16 | InvoiceListPage.test.jsx | Status filter chips | Narrow the table to one status and carry live counts |
| 17 | InvoiceListPage.test.jsx | View action | Navigates to `/invoices/:id` |
| 18 | InvoiceListPage.test.jsx | Invoice list request fails | Error toast rather than an empty table |
| 19 | InvoiceListPage.test.jsx | Row selection rules | Only `matched`/`adjusted` selectable; approved, synced, failed and unmatched disabled |
| 20 | InvoiceListPage.test.jsx | Header select-all checkbox | Selects only the 2 approvable rows, never all 6 |
| 21 | InvoiceListPage.test.jsx | Batch button with nothing selected | Disabled |
| 22 | InvoiceListPage.test.jsx | Header checkbox clicked twice | Clears the selection |
| 23 | InvoiceListPage.test.jsx | Batch approve happy path | POSTs `{ invoice_ids: [1,2] }`; toast reports approved/synced counts |
| 24 | InvoiceListPage.test.jsx | Approved but only partly synced to Xero | Reports `Approved 2, synced 1` - a partial Xero failure is never shown as a clean success |
| 25 | InvoiceListPage.test.jsx | Server skips part of the batch | Toast names the skipped count |
| 26 | InvoiceListPage.test.jsx | After a successful batch | Table refetched and selection cleared so the same invoices cannot be submitted twice |
| 27 | InvoiceListPage.test.jsx | Whole batch fails | Shows the server message |
| 28 | InvoiceDetailPage.test.jsx | Unmatched invoice with no active contract | Explains the unpriced charges clearly |
| 29 | InvoiceDetailPage.test.jsx | Retry match on an unmatched invoice | Renders the contract-priced result |
| 30 | InvoiceDetailPage.test.jsx | Missing contract rate | Names the exact service/transfer/time combination and links to the contract |
| 31 | InvoiceDetailPage.test.jsx | Quotation mismatch | Offers manual pricing instead of pointing at a new contract |
| 32 | InvoiceDetailPage.test.jsx | Locked (approved/synced) invoice | Uses the correct Xero product name in the locked message |
| 33 | InvoiceDetailPage.test.jsx | Add line item returns 201 | Success toast and the new line item appears |
| 34 | InvoiceDetailPage.test.jsx | Add line item returns 500 with no body | Falls back to a generic error toast |
| 35 | InvoiceDetailPage.test.jsx | Add line item returns 400 | Shows the backend validation message |
| 36 | PricingContractPage.test.jsx | In-range active contract | Derived status renders as Active |
| 37 | PricingContractPage.test.jsx | `is_active` but not yet started | Renders as Upcoming, not Active - billing against it today would use a rate not in force |
| 38 | PricingContractPage.test.jsx | Two inactive contracts, differing only by `effective_to` | Lapsed one renders Expired; early-withdrawn one renders Deactivated |
| 39 | PricingContractPage.test.jsx | Inactive row styling | Rendered at 50% opacity; active rows are not |
| 40 | PricingContractPage.test.jsx | Default visibility | Deactivated/expired hidden, with a "2 hidden" count so the list is not silently partial |
| 41 | PricingContractPage.test.jsx | Show-inactive toggle | Reveals the Expired and Deactivated filter tabs |
| 42 | PricingContractPage.test.jsx | Hiding inactive while viewing the Expired tab | Falls back to All Contracts instead of stranding the user on a vanished tab |
| 43 | PricingContractPage.test.jsx | Active tab | Excludes upcoming contracts |
| 44 | PricingContractPage.test.jsx | Search box | Matches client name as well as contract name |
| 45 | PricingContractPage.test.jsx | Search casing | Case-insensitive |
| 46 | PricingContractPage.test.jsx | Search with no matches | Explicit "No contracts match" empty state |
| 47 | PricingContractPage.test.jsx | View action | Navigates to `/pricing-contracts/:id` |
| 48 | PricingContractPage.test.jsx | New Contract action | Navigates to `/pricing-contracts/new` |
| 49 | PricingContractPage.test.jsx | More contracts than the page limit (142 of 100) | Warns that 42 more exist - the screen has no pagination yet |
| 50 | PricingContractPage.test.jsx | Contract list request fails | Error toast |
| 51 | ContractDetailPage.test.jsx | Rates and surcharges rendering | Enum values shown as human-readable labels with formatted money |
| 52 | ContractDetailPage.test.jsx | Contract with matched invoices | Banner warns that edits are not retroactive |
| 53 | ContractDetailPage.test.jsx | Contract with zero rates | States the pricing engine cannot match jobs yet |
| 54 | ContractDetailPage.test.jsx | Expired contract | Read-only: no Add Rate, Edit Surcharges or Deactivate controls |
| 55 | ContractDetailPage.test.jsx | Manually deactivated contract | Read-only, with wording distinct from expired |
| 56 | ContractDetailPage.test.jsx | Upcoming contract | Still editable, and states when it begins matching |
| 57 | ContractDetailPage.test.jsx | Add an incomplete rate | Blocked by `rateSchema` client-side; no POST sent |
| 58 | ContractDetailPage.test.jsx | Edit a rate's base amount | PUTs `{ base_amount }` only - service/transfer/time are immutable once created |
| 59 | ContractDetailPage.test.jsx | Delete a rate | Asks for confirmation, then deletes |
| 60 | ContractDetailPage.test.jsx | Decline the delete confirmation | No DELETE sent |
| 61 | ContractDetailPage.test.jsx | Delete a rate already used for billing | Surfaces the backend `RATE_IN_USE` message |
| 62 | ContractDetailPage.test.jsx | Deactivate a contract with matched invoices, confirmed | Re-sends with `acknowledge_matched_invoices: true`; 2 PATCHes total |
| 63 | ContractDetailPage.test.jsx | Decline the matched-invoice acknowledgment | No retry, and no error toast - a deliberate Cancel is not a failure |
| 64 | ContractDetailPage.test.jsx | Save the surcharge schedule | One independent PUT per surcharge; single success toast |
| 65 | ContractDetailPage.test.jsx | One surcharge PUT fails out of two | Names the failed row and states the others were saved (no transaction spans the PUTs) |
| 66 | ContractDetailPage.test.jsx | Typing a negative surcharge amount | Input mask rejects the minus sign; the value is unreachable via the UI |
| 67 | ContractDetailPage.test.jsx | Typing 3+ decimal places | Clamped to 2 so money cannot round unpredictably downstream |
| 68 | ContractDetailPage.test.jsx | Cancel out of surcharge edit mode | Exits without sending anything |
| 69 | ContractFormPage.test.jsx | Create mode initial render | Client picker, rate section and pre-populated surcharge defaults |
| 70 | ContractFormPage.test.jsx | Submit with required fields empty | Blocked; no POST sent |
| 71 | ContractFormPage.test.jsx | Add a duplicate service/transfer/time row | Rejected client-side before the round-trip that would lose the form |
| 72 | ContractFormPage.test.jsx | Backend returns a zero-rate warning | Warning passed through instead of a plain success, then navigates to the new contract |
| 73 | ContractFormPage.test.jsx | Backend returns field-level errors | Every field error surfaced, not just the generic top-level message |
| 74 | ContractFormPage.test.jsx | Client list request fails | Error toast |
| 75 | ContractFormPage.test.jsx | Edit mode initial render | Loads the contract; client, rate and surcharge sections hidden |
| 76 | ContractFormPage.test.jsx | Save in edit mode | PATCHes only `contract_name`, `effective_from`, `effective_to` |
| 77 | ContractFormPage.test.jsx | Edit a contract with matched invoices, confirmed | Re-sends with `acknowledge_matched_invoices: true` |
| 78 | ContractFormPage.test.jsx | Decline the acknowledgment | No retry and no navigation, so the user's edits survive |
| 79 | ContractFormPage.test.jsx | Contract load fails in edit mode | Error toast |
| 80 | RevenueLeakagePage.test.jsx | `getRevenueLeakage()` unwrapping | Returns the report payload, not the axios response |
| 81 | RevenueLeakagePage.test.jsx | `getRevenueLeakage()` date range | Passed through as query params |
| 82 | RevenueLeakagePage.test.jsx | Report rendering | Summary, breakdowns and recommendation all shown |
| 83 | RevenueLeakagePage.test.jsx | Surcharge with no reference rate | Labelled as unvaluable rather than shown as a misleading $0.00 |
| 84 | RevenueLeakagePage.test.jsx | Honesty counters | Shown, since every amount on the screen is an estimate |
| 85 | RevenueLeakagePage.test.jsx | Period with nothing unpriced | Reports a clean period rather than a blank screen |
| 86 | RevenueLeakagePage.test.jsx | Malformed payload | Recoverable error instead of blanking |
| 87 | RevenueLeakagePage.test.jsx | Request fails | Recoverable error |
| 88 | VendorInvoiceListPage.test.jsx | OCR fails after the PDF is saved | Recovery warning, then navigates to the saved invoice for manual entry |
| 89 | VendorInvoiceListPage.test.jsx | Upload fails before an invoice is saved | Shows the server error and keeps the modal open for retry |
| 90 | VendorInvoiceListPage.test.jsx | Status badge counts after filtering | Counts stay accurate for every status, not just the selected one |
| 91 | VendorInvoiceReviewPage.test.jsx | AP invoice review panel | Shows GST, due-date, coding and audit information |
| 92 | VendorInvoiceReviewPage.test.jsx | Low-confidence OCR | Requires explicit source verification before approval |
| 93 | VendorInvoiceReviewPage.test.jsx | Server-supplied approval issues | Each issue listed and approval disabled |
| 94 | VendorInvoiceReviewPage.test.jsx | Add a manual line to an OCR-failed invoice | POSTs the line, refreshes, and returns the invoice to pending review |
| 95 | VendorInvoiceReviewPage.test.jsx | Delete an invoice line | In-app confirmation, DELETE, then refreshed totals |
| 96 | VendorInvoiceReviewPage.test.jsx | Expense account selection | Chosen from the connected Xero chart and saved by code |
| 97 | VendorInvoiceReviewPage.test.jsx | Xero chart cannot validate the account | Approval blocked |
| 98 | VendorInvoiceReviewPage.test.jsx | Failed Xero-sync invoice | Correctable without reopening approval or rejection |
| 99 | VendorInvoiceReviewPage.test.jsx | Retry OCR over existing data | Requires destructive-replacement confirmation and sends `confirm_replace: true` |
| 100 | VendorInvoiceReviewPage.test.jsx | Confirmed OCR retry fails | Preservation error shown; current fields and line items stay visible |
| 101 | XeroConnectPage.test.jsx | LIVE mode with an expired access token | Shows LIVE and explains the token auto-refreshes on the next sync |
| 102 | XeroConnectPage.test.jsx | Simulation mode while disconnected | Simulation banner is unmistakable and states no data reaches Xero |
| 103 | XeroSyncStatusPage.test.jsx | Long Xero error reason | Status stays on one line; the full reason expands on demand |

_Not covered by unit tests: the Xero OAuth redirect itself (a full-page browser
navigation, so there is nothing to assert in jsdom), and PDF rendering inside the AP
review viewer (`react-pdf` requires a real worker)._

_Rows 1-13, 14-27, 36-50, 51-68 and 69-79 were added when the AR screens were brought up
to the same coverage as the AP screens; the ServiceMemoListPage file previously held a
single test and the four contract/invoice-list screens had no test file at all._
