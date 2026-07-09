# Test Cases - Jasper

**Feature Area:** AR Billing, Pricing Engine & Invoice Sync

Derived from [use-cases.md](use-cases.md) (UC-01 to UC-10) and [api-documentation.md](api-documentation.md).

---

## Backend Test Cases

| Test ID | Endpoint / Function | Input / Action | Expected Outcome | Pass/Fail |
|---|---|---|---|---|
| TC-B001 | `GET /api/contracts` | Valid AR specialist JWT, no query params | `200`, returns paginated list of all contracts wrapped in `{ success: true, data: [...] }` with `meta` | |
| TC-B002 | `GET /api/contracts` | Valid JWT, `client_id=1` | `200`, results filtered to only contracts for client 1 | |
| TC-B003 | `GET /api/contracts` | Valid JWT, `is_active=true` | `200`, results contain only contracts where `is_active` is `true` | |
| TC-B004 | `GET /api/contracts` | Valid JWT, `page=2&limit=1` | `200`, `meta.page=2`, `meta.limit=1`, one record returned | |
| TC-B005 | `GET /api/contracts` | No `Authorization` header | `401 UNAUTHORISED` | |
| TC-B006 | `GET /api/contracts` | Valid JWT for `field_crew` role | `403 FORBIDDEN` | |
| TC-B007 | `POST /api/contracts` | Valid AR JWT, complete body (client_id, contract_name, dates, rates, surcharges) | `201`, contract created with `is_active` computed from today's date vs effective range, rates and surcharges persisted | |
| TC-B008 | `POST /api/contracts` | Missing `contract_name` | `400 VALIDATION_ERROR` | |
| TC-B009 | `POST /api/contracts` | Invalid `service_type` enum in `rates[]` | `400 VALIDATION_ERROR` | |
| TC-B010 | `POST /api/contracts` | `client_id` for a non-existent client | `404 CLIENT_NOT_FOUND` | |
| TC-B011 | `POST /api/contracts` | Same `client_id` and overlapping date range as an existing active contract | `409 CONTRACT_OVERLAP`, submission blocked | |
| TC-B012 | `POST /api/contracts` | Valid body but `rates: []` | `201` created, response/UI signals no pricing rules attached (pricing match will fail until rules added) | |
| TC-B013 | `POST /api/contracts` | Valid AR JWT missing token | `401 UNAUTHORISED` | |
| TC-B014 | `POST /api/contracts` | Valid JWT for `managing_director` role | `403 FORBIDDEN` (write not permitted for this role) | |
| TC-B015 | `GET /api/contracts/:id` | Valid JWT, existing contract id | `200`, returns contract with `rates[]`, `surcharges[]`, `matched_invoice_count` | |
| TC-B016 | `GET /api/contracts/:id` | Non-existent contract id | `404 CONTRACT_NOT_FOUND` | |
| TC-B017 | `PATCH /api/contracts/:id` | Valid AR JWT, `{ effective_to: "2026-09-30" }` on existing contract | `200`, `effective_to` updated, `is_active` recomputed | |
| TC-B018 | `PATCH /api/contracts/:id` | `effective_to` earlier than `effective_from` | `400 VALIDATION_ERROR` | |
| TC-B019 | `PATCH /api/contracts/:id` | `effective_to` set to a past date | `200`, `is_active` becomes `false` immediately, contract excluded from pricing match pool | |
| TC-B020 | `PATCH /api/contracts/:id` | Edit rules on a contract that already has matched invoices | `400 HAS_MATCHED_INVOICES` with count returned; existing invoices remain unaffected | |
| TC-B021 | `PATCH /api/contracts/:id` | Non-existent contract id | `404 CONTRACT_NOT_FOUND` | |
| TC-B022 | `POST /api/contracts/:contractId/rates` | Valid AR JWT, new unique `service_type`/`transfer_type`/`time_of_day` combo | `201`, rate row created | |
| TC-B023 | `POST /api/contracts/:contractId/rates` | Duplicate combo already existing on contract | `409 RATE_DUPLICATE` | |
| TC-B024 | `POST /api/contracts/:contractId/rates` | Invalid enum for `service_type` | `400 VALIDATION_ERROR` | |
| TC-B025 | `POST /api/contracts/:contractId/rates` | Non-existent `contractId` | `404 CONTRACT_NOT_FOUND` | |
| TC-B026 | `PUT /api/contracts/:contractId/rates/:rateId` | Valid `base_amount` update | `200`, `base_amount` updated | |
| TC-B027 | `PUT /api/contracts/:contractId/rates/:rateId` | Negative `base_amount` | `400 VALIDATION_ERROR` | |
| TC-B028 | `PUT /api/contracts/:contractId/rates/:rateId` | Non-existent `rateId` | `404 RATE_NOT_FOUND` | |
| TC-B029 | `DELETE /api/contracts/:contractId/rates/:rateId` | Rate row with no matched invoices | `200`, rate deleted | |
| TC-B030 | `DELETE /api/contracts/:contractId/rates/:rateId` | Rate row already used by matched invoices | `409 RATE_IN_USE`, deletion blocked | |
| TC-B031 | `DELETE /api/contracts/:contractId/rates/:rateId` | Non-existent `rateId` | `404 RATE_NOT_FOUND` | |
| TC-B032 | `PUT /api/contracts/:contractId/surcharges/:surchargeId` | Valid `amount` update | `200`, surcharge amount updated | |
| TC-B033 | `PUT /api/contracts/:contractId/surcharges/:surchargeId` | Negative `amount` | `400 VALIDATION_ERROR` | |
| TC-B034 | `PUT /api/contracts/:contractId/surcharges/:surchargeId` | Non-existent `surchargeId` | `404 SURCHARGE_NOT_FOUND` | |
| TC-B035 | `GET /api/memos/pending-review` | Valid AR JWT | `200`, returns memos with status `submitted` and no linked invoice | |
| TC-B036 | `GET /api/memos/pending-review` | Valid JWT for `field_crew` role | `403 FORBIDDEN` | |
| TC-B037 | `PATCH /api/memos/:id/approve` | Memo for client with active contract and matching rate | `200`, memo status -> `reviewed`, invoice created with status `matched` and populated `line_items` | |
| TC-B038 | `PATCH /api/memos/:id/approve` | Memo for client with no active contract | `422 NO_ACTIVE_CONTRACT`, invoice created with status `unmatched` | |
| TC-B039 | `PATCH /api/memos/:id/approve` | Active contract exists but no rate row matches memo's service/transfer/time combo | `422 NO_MATCHING_RATE`, invoice created with status `unmatched`, affected line item flagged `incomplete` with zero amount | |
| TC-B040 | `PATCH /api/memos/:id/approve` | Memo with `overtime_hours = 0` and `evacuation_floors = 0` | `200`, invoice generated with only base rate line item, no error | |
| TC-B041 | `PATCH /api/memos/:id/approve` | Non-existent memo id | `404 MEMO_NOT_FOUND` | |
| TC-B042 | `PATCH /api/memos/:id/approve` | Memo already reviewed / invoice already exists | `409 MEMO_ALREADY_REVIEWED` | |
| TC-B043 | `PATCH /api/memos/:id/return` | Valid `note` on a submitted memo | `200`, memo status reverts to `submitted`, `note_recorded: true` | |
| TC-B044 | `PATCH /api/memos/:id/return` | Empty/missing `note` | `400 VALIDATION_ERROR` | |
| TC-B045 | `PATCH /api/memos/:id/return` | Non-existent memo id | `404 MEMO_NOT_FOUND` | |
| TC-B046 | `PATCH /api/memos/:id/return` | Memo already linked to an approved/synced invoice | `409 MEMO_ALREADY_INVOICED` | |
| TC-B047 | `GET /api/invoices` | Valid JWT, `status=matched` | `200`, only invoices with status `matched` returned | |
| TC-B048 | `GET /api/invoices` | Valid JWT, `from_date`/`to_date` range | `200`, results restricted to `created_at` within range | |
| TC-B049 | `GET /api/invoices` | Invalid `status` value | `400 INVALID_STATUS` | |
| TC-B050 | `GET /api/invoices` | Valid JWT for `managing_director` | `200`, read-only access allowed | |
| TC-B051 | `GET /api/invoices/:id` | Existing invoice id | `200`, full invoice with `line_items[]` returned | |
| TC-B052 | `GET /api/invoices/:id` | Non-existent invoice id | `404 INVOICE_NOT_FOUND` | |
| TC-B053 | `POST /api/invoices/batch-approve` | `invoice_ids` array of valid `matched`/`adjusted` invoices | `200`, all updated to `approved` and queued for Xero push, returned in `approved`/`queued_for_xero` | |
| TC-B054 | `POST /api/invoices/batch-approve` | `invoice_ids` includes an invoice already `synced_to_xero` | `200`, ineligible invoice returned in `skipped`, others processed normally | |
| TC-B055 | `POST /api/invoices/batch-approve` | Empty `invoice_ids` array | `400 VALIDATION_ERROR` | |
| TC-B056 | `POST /api/invoices/:id/retry-xero` | Invoice currently in `failed` status | `200`, status becomes `synced_to_xero`, `xero_invoice_id` populated | |
| TC-B057 | `POST /api/invoices/:id/retry-xero` | Invoice not in `failed` status (e.g. `matched`) | `409 INVOICE_NOT_FAILED` | |
| TC-B058 | `POST /api/invoices/:id/retry-xero` | Non-existent invoice id | `404 INVOICE_NOT_FOUND` | |
| TC-B059 | `POST /api/invoices/:id/retry-xero` | Xero API rejects/times out on retry | `502 XERO_SYNC_ERROR`, invoice remains `failed` with updated error log | |
| TC-B060 | `POST /api/invoices/:invoiceId/line-items` | Valid manual adjustment (`description`, positive `quantity`/`unit_price`) on a `matched` invoice | `201`, line item created with `is_manual_adjustment: true`, invoice status -> `adjusted`, `subtotal`/`total_amount` recalculated | |
| TC-B061 | `POST /api/invoices/:invoiceId/line-items` | Missing `description` | `400 VALIDATION_ERROR` | |
| TC-B062 | `POST /api/invoices/:invoiceId/line-items` | Invoice already in `approved` status | `409 INVOICE_LOCKED` | |
| TC-B063 | `POST /api/invoices/:invoiceId/line-items` | Non-existent `invoiceId` | `404 INVOICE_NOT_FOUND` | |
| TC-B064 | `PUT /api/invoices/:invoiceId/line-items/:itemId` | Valid `unit_price` update on an editable invoice | `200`, `amount` recalculated, invoice `subtotal`/`total_amount` updated, status -> `adjusted` | |
| TC-B065 | `PUT /api/invoices/:invoiceId/line-items/:itemId` | Negative `unit_price` | `400 VALIDATION_ERROR` | |
| TC-B066 | `PUT /api/invoices/:invoiceId/line-items/:itemId` | Non-existent `itemId` | `404 LINE_ITEM_NOT_FOUND` | |
| TC-B067 | `PUT /api/invoices/:invoiceId/line-items/:itemId` | Invoice in `synced_to_xero` status | `409 INVOICE_LOCKED` | |
| TC-B068 | `DELETE /api/invoices/:invoiceId/line-items/:itemId` | Manual adjustment line item (`is_manual_adjustment: true`) | `200`, line item deleted, invoice totals recalculated | |
| TC-B069 | `DELETE /api/invoices/:invoiceId/line-items/:itemId` | Engine-generated line item (`is_manual_adjustment: false`) | `403 SYSTEM_LINE_ITEM`, deletion blocked | |
| TC-B070 | `DELETE /api/invoices/:invoiceId/line-items/:itemId` | Non-existent `itemId` | `404 LINE_ITEM_NOT_FOUND` | |
| TC-B071 | `DELETE /api/invoices/:invoiceId/line-items/:itemId` | Invoice in `approved` status | `409 INVOICE_LOCKED` | |
| TC-B072 | `GET /api/revenue-leakage` | Valid JWT, default threshold | `200`, returns `completed` bookings with no linked memo past 4-hour threshold | |
| TC-B073 | `GET /api/revenue-leakage` | Valid JWT, `threshold_hours=8` | `200`, results filtered using overridden threshold | |
| TC-B074 | `GET /api/revenue-leakage` | Valid JWT for `ap_specialist` role | `403 FORBIDDEN` | |
| TC-B075 | `PATCH /api/revenue-leakage/:bookingId/resolve` | Valid `reason` on a flagged booking | `200`, `resolved: true`, alert excluded from future reports | |
| TC-B076 | `PATCH /api/revenue-leakage/:bookingId/resolve` | Missing `reason` | `400 VALIDATION_ERROR` | |
| TC-B077 | `PATCH /api/revenue-leakage/:bookingId/resolve` | Non-existent `bookingId` | `404 BOOKING_NOT_FOUND` | |
| TC-B078 | `PATCH /api/revenue-leakage/:bookingId/resolve` | A memo was submitted for the booking after the alert was raised | `409 MEMO_NOW_EXISTS` | |
| TC-B079 | `GET /api/ar/dashboard` | Valid AR JWT, no date filter | `200`, `summary[]` grouped by all statuses with counts/totals, `revenue_leakage_alert_count` included | |
| TC-B080 | `GET /api/ar/dashboard` | Valid JWT, `from_date`/`to_date` supplied | `200`, `period` reflects requested range, summary scoped accordingly | |
| TC-B081 | `GET /api/ar/dashboard` | No invoices exist yet | `200`, each status group returns zero count, no error raised | |
| TC-B082 | `GET /api/ar/dashboard` | No `Authorization` header | `401 UNAUTHORISED` | |
| TC-B083 | `POST /api/xero/bank-feed/pull` | Valid AR JWT, Xero reachable | `200`, `transactions_imported` count and `transactions[]` returned, `xero_sync_logs` entry written with entity type `bank_feed` | |
| TC-B084 | `POST /api/xero/bank-feed/pull` | No new transactions since last pull | `200`, zero imported, "up to date" message, no new records written | |
| TC-B085 | `POST /api/xero/bank-feed/pull` | Xero API unreachable/times out | `502 XERO_UNAVAILABLE` | |
| TC-B086 | `POST /api/xero/bank-feed/pull` | Valid JWT for `quotations_specialist` role | `403 FORBIDDEN` | |
| TC-B087 | Any endpoint | Expired JWT (`exp` in the past) | `401 UNAUTHORISED` | |
| TC-B088 | Any endpoint | Malformed/tampered JWT signature | `401 UNAUTHORISED` | |

---

## Frontend Test Cases

| Test ID | Flow / Screen | Input / Action | Expected Outcome | Pass/Fail |
|---|---|---|---|---|
| TC-F001 | Pricing Contracts List | Sarah opens Pricing Contracts section | Table loads showing active/expired contracts; expired rows render at 50% opacity | |
| TC-F002 | Create Contract Form (UC-01) | Sarah clicks "New Contract", selects client, enters name/dates, adds base rate/overtime/evacuation rules, saves | Contract created, appears in active contracts list for that client, `is_active` reflects today's date vs range | |
| TC-F003 | Create Contract Form - overlap | Sarah submits a contract with dates overlapping an existing active contract for the same client | Submission blocked, inline error: "An active contract already exists for this client..." | |
| TC-F004 | Create Contract Form - no rules | Sarah saves a contract with zero pricing rules attached | Contract saves but a warning is shown that pricing match cannot run until rules are added | |
| TC-F005 | Contract Detail - edit rates (UC-02) | Sarah edits pricing rules or extends/shortens `effective_to` on an existing contract | Changes saved, `is_active` recalculated, past invoices matched under old rates remain unchanged | |
| TC-F006 | Contract Detail - edit with matched invoices | Sarah edits rules on a contract that already has matched invoices | Warning modal: "X invoices have already been matched using this contract..."; Sarah must acknowledge before save proceeds | |
| TC-F007 | Contract Detail - past end date | Sarah sets `effective_to` to a date in the past | Contract immediately shows `is_active = false` and disappears from the active pool | |
| TC-F008 | Contract Detail - inline rate CRUD | Sarah adds/edits/deletes a rate row from the rates table | Table updates in place without full page reload; delete blocked with error if rate is in use | |
| TC-F009 | Memo Review Queue (UC-03) | Sarah opens memo queue | List shows all submitted memos not yet matched, overdue rows highlighted in red | |
| TC-F010 | Memo Review Detail - approve | Sarah opens a memo, reviews all captured fields (times, overtime, evacuation floors, patient details, hospital destination, signature/stamp), clicks "Approve & Match" | Memo status -> `reviewed`, booking status -> `matched`, user is routed to the newly created invoice | |
| TC-F011 | Memo Review Detail - all 9 surcharge fields visible | Sarah opens a memo with pricing engine section | All 9 fields shown without abbreviation: `oxygen_litres_used`, `has_inconvenience_fee`, `disposables_used`, `has_resuscitation_fee`, `has_suction_fee`, `has_jurong_island_fee`, `waiting_time_minutes`, `patient_weight_kg`, `has_heavy_lifting_fee` | |
| TC-F012 | Memo Review Detail - return | Sarah clicks "Return to Crew", enters a correction note, submits | Memo status reverts to `submitted`, note recorded, memo removed from Sarah's active review view, toast confirmation shown | |
| TC-F013 | Memo Review Detail - missing stamp | Sarah reviews a memo with a signature present but no hospital stamp image | Sarah can still approve; record is flagged "stamp pending" for follow-up | |
| TC-F014 | Pricing Match trigger (UC-04) | Sarah approves a memo for a client with an active contract and matching rate | New invoice auto-appears in invoice review queue with status `matched` and correct line items (base + overtime + evacuation) | |
| TC-F015 | Pricing Match - no active contract | Sarah approves a memo for a client with no active contract | Invoice flagged `unmatched - no contract`; Sarah is notified and prompted to create a contract | |
| TC-F016 | Pricing Match - missing rate for tier | Sarah approves a memo where no rate exists for the job's service tier | Invoice created with the affected line item at zero amount, flagged `incomplete`, prompting manual entry | |
| TC-F017 | Invoice Detail - review (UC-05) | Sarah opens a matched invoice, compares auto-generated line items against source memo data | Line items and memo data render side by side accurately | |
| TC-F018 | Invoice Detail - mark ready, no changes | Sarah reviews an invoice and clicks "Ready for Approval" without edits | Invoice status remains `matched`, moves into batch approval queue | |
| TC-F019 | Invoice Detail - edit line item | Sarah edits an existing auto-generated line item amount and saves | Status updates to `adjusted`, `is_manual_adjustment` badge remains blue (auto) for engine items but totals recalculate | |
| TC-F020 | Invoice Detail - add manual surcharge | Sarah adds a free-text manual surcharge line item with description | New line item shown with amber "manual" badge, invoice status -> `adjusted`, logged for audit | |
| TC-F021 | Invoice Detail - reject match | Sarah clicks "Reject Match", enters a reason, confirms | Invoice deleted, memo returned to review queue with note attached | |
| TC-F022 | Invoice Detail - locked invoice | Sarah attempts to edit a line item on an `approved`/`synced_to_xero` invoice | Edit controls disabled or action blocked with `INVOICE_LOCKED` error surfaced as toast | |
| TC-F023 | Batch Approval View (UC-06) | Sarah navigates to Batch Approval, sees invoices in `matched`/`adjusted` status | List shows batch summary (count, combined value, client breakdown) | |
| TC-F024 | Batch Approval - select all and approve | Sarah clicks "Select All" then "Approve & Sync to Xero" | Selected invoices update to `approved`, Xero push queued, sync status indicators shown per invoice (pending/synced/failed) | |
| TC-F025 | Batch Approval - deselect specific invoices | Sarah deselects some invoices before approving | Only selected invoices are pushed; deselected ones remain in queue for next batch | |
| TC-F026 | Batch Approval - partial sync failure | One invoice in a batch fails Xero sync while others succeed | Successful invoices show `synced_to_xero`; failed one flagged individually with Xero error reason and retry option | |
| TC-F027 | Xero Sync Status - retry (UC-07) | Sarah clicks "Retry" on a `failed` invoice | Invoice re-attempts Xero push; status updates to `synced_to_xero` on success or stays `failed` with updated error on failure | |
| TC-F028 | Xero Sync Status - max retries | Sarah retries the same invoice a 4th time after 3 failed attempts | Max-retry warning is shown (3 attempts) per design token spec | |
| TC-F029 | Xero Sync Status - token expired | Sync attempted while Xero OAuth2 token is expired and refresh fails | Alert shown: "Xero connection requires re-authentication" | |
| TC-F030 | AR Dashboard - Bank Feed (UC-08) | Sarah clicks "Pull Bank Feed" | Imported transactions list refreshes and displays alongside outstanding invoices | |
| TC-F031 | AR Dashboard - Bank Feed up to date | Sarah pulls the bank feed when no new transactions exist | UI shows "Bank feed up to date as of [timestamp]", no duplicate entries added | |
| TC-F032 | Revenue Leakage Alert panel (UC-09) | Sarah/Doris views AR or Executive dashboard with flagged bookings present | Alert panel lists booking reference, client name, job date, and assigned crew for each flagged booking | |
| TC-F033 | Revenue Leakage - link orphaned memo | Sarah uses "Link Memo" action on an alert where a memo was submitted but not linked | Memo associates with the booking, alert clears without requiring resubmission | |
| TC-F034 | Revenue Leakage - mark cancelled | Sarah marks an alert "Cancelled - No Memo Required" with a reason | Alert and booking excluded from future revenue leakage reports | |
| TC-F035 | AR Batch Status Tracker (UC-10) | Sarah/Doris opens AR dashboard | Summary panel shows count and total value per status (`matched`, `adjusted`, `approved`, `synced_to_xero`, `failed`) | |
| TC-F036 | AR Batch Status Tracker - drill down | Sarah clicks into a status group (e.g. `failed`) | View drills down to the individual invoices in that status | |
| TC-F037 | AR Batch Status Tracker - MD read-only | Doris (Managing Director) views the same tracker | Summary renders identically but with no action controls on individual invoices | |
| TC-F038 | AR Batch Status Tracker - empty state | Dashboard loaded with zero invoices in the system | Each status group shows zero count with a prompt to process the first memo; no error state shown | |
| TC-F039 | AR Batch Status Tracker - bulk retry | Multiple invoices are in `failed` status | `failed` group highlighted in distinct colour; "Retry All" bulk action available without opening each invoice | |
| TC-F040 | Role-based access - AP Specialist | Chloe Tan (AP role) attempts to navigate directly to the Pricing Contracts or AR Dashboard URL | Access denied / redirected, matching the role access matrix (AR-only screens not reachable) | |
| TC-F041 | Role-based access - Field Crew | Ravi Kumar (Field role) attempts to open Memo Review Queue via direct URL | Access denied / redirected | |

---

**Total:** 88 backend test cases (TC-B001-TC-B088), 41 frontend test cases (TC-F001-TC-F041).
