# Test Cases - Kwan Hua

**Feature Area:** Xero Foundation, OCR & AP Processing
**Scope:** Derived from `use-cases.md` (UC-01 to UC-08) and `api-documentation.md` (endpoints 1-14) in this folder. Covers the Xero OAuth2 connection, vendor invoice upload/OCR/rebate, AP review/approve/reject, and the shared Xero sync-log/retry panel.

Fill in **Pass/Fail** manually after running each test. `Fail` entries should link to a bug note or commit that fixes them.

---

## Backend Test Cases

| Test ID | What is Being Tested (Endpoint) | Input / Action | Expected Outcome | Pass/Fail |
|---|---|---|---|---|
| TC-001 | `GET /api/xero/status` | Call while a Xero connection exists | 200, `is_connected: true` with org name, tenant ID, connected_at, token_expiry | |
| TC-002 | `GET /api/xero/status` | Call with no stored connection | 200, `is_connected: false` with all other fields `null` | |
| TC-003 | `GET /api/xero/status` | Call with missing/invalid JWT | 401 `UNAUTHORIZED` | |
| TC-004 | `GET /api/xero/status` | Call as a role outside md/ap/ar (e.g. `quotations_specialist`) | 403 `FORBIDDEN` | |
| TC-005 | `GET /api/xero/connect` | Call as `managing_director` with valid env config | 200, `auth_url` contains correct `client_id`, `redirect_uri`, scopes, and a `state` CSRF token | |
| TC-006 | `GET /api/xero/connect` | Call as any non-`managing_director` role | 403 `FORBIDDEN` | |
| TC-007 | `GET /api/xero/connect` | `XERO_CLIENT_ID`/`XERO_REDIRECT_URI` missing from env | 500 `XERO_CONFIG_MISSING` | |
| TC-008 | `GET /api/xero/callback` | Valid `code` + matching `state` | Tokens exchanged and stored in `xero_connections`; redirects to `/settings/xero?connected=true` | |
| TC-009 | `GET /api/xero/callback` | Admin denies permission (`error` param present) | Redirects to `/settings/xero?error=access_denied` | |
| TC-010 | `GET /api/xero/callback` | `state` param missing or mismatched | Redirects to `/settings/xero?error=invalid_state` | |
| TC-011 | `GET /api/xero/callback` | Authorisation code already expired | Redirects to `/settings/xero?error=code_expired` | |
| TC-012 | `GET /api/xero/callback` | Xero rejects the token exchange | Redirects to `/settings/xero?error=token_exchange_failed` | |
| TC-013 | `DELETE /api/xero/disconnect` | `managing_director` disconnects an active connection | 200, connection marked `is_connected: false` (row retained) | |
| TC-014 | `DELETE /api/xero/disconnect` | Call as any non-`managing_director` role | 403 `FORBIDDEN` | |
| TC-015 | `DELETE /api/xero/disconnect` | No active connection exists | 404 `NOT_CONNECTED` | |
| TC-016 | Token auto-refresh (UC-02) | Access token within expiry window before any Xero-calling endpoint | Token refreshed transparently; original request retried and succeeds with no user-facing error | |
| TC-017 | Token auto-refresh (UC-02) | Refresh token itself expired (>60 days inactive) | Operation aborted, affected sync marked `failed`, admin notified to re-authenticate via UC-01 | |
| TC-018 | Token auto-refresh (UC-02) | Xero token endpoint unreachable | Retries up to 3x with exponential backoff, then operation queued and admin notified of connectivity issue | |
| TC-019 | `POST /api/vendor-invoices` | Valid PDF upload, no `rebate_percentage` supplied | 201, status `pending_review`, `rebate_amount`/`verified_total` computed at default 1% | |
| TC-020 | `POST /api/vendor-invoices` | Valid PDF with a custom `rebate_percentage` | Rebate calculated at the overridden rate, not the 1% default | |
| TC-021 | `POST /api/vendor-invoices` | Upload a non-PDF file (e.g. JPEG) | 400 `INVALID_FILE_TYPE`, no `vendor_invoices` record created | |
| TC-022 | `POST /api/vendor-invoices` | Upload a PDF exceeding 10 MB | 400 `FILE_TOO_LARGE`, no record created | |
| TC-023 | `POST /api/vendor-invoices` | Cloudinary upload fails (network/service error) | 502 `CLOUDINARY_UPLOAD_FAILED`, no `vendor_invoices` record created | |
| TC-024 | `POST /api/vendor-invoices` | Gemini OCR fails/times out (after 1 internal retry) | Invoice saved with status `extraction_failed`, 502 `OCR_EXTRACTION_FAILED` | |
| TC-025 | `POST /api/vendor-invoices` | Gemini returns `extraction_confidence < 0.80` | `is_low_confidence: true`, invoice flagged "Needs Manual Check" | |
| TC-026 | `POST /api/vendor-invoices` | Gemini omits a field (e.g. total is unreadable) | Missing field(s) left `null`/blank, highlighted for manual entry in the review UI | |
| TC-027 | `POST /api/vendor-invoices` | Call as any non-`ap_specialist` role | 403 `FORBIDDEN` | |
| TC-028 | `POST /api/vendor-invoices` | Missing/invalid JWT | 401 `UNAUTHORIZED` | |
| TC-029 | `GET /api/vendor-invoices` | No query params | 200, page 1, default `limit=20`, `pagination` block correct | |
| TC-030 | `GET /api/vendor-invoices` | `status=pending_review` | Only rows with that status returned | |
| TC-031 | `GET /api/vendor-invoices` | `vendor_name=esso` (partial, case-insensitive) | Only matching vendor rows returned | |
| TC-032 | `GET /api/vendor-invoices` | `date_from` after `date_to` | 400 `INVALID_DATE_RANGE` | |
| TC-033 | `GET /api/vendor-invoices` | Call as a role outside ap/md | 403 `FORBIDDEN` | |
| TC-034 | `GET /api/vendor-invoices/:id` | Valid existing id | 200, full detail including `items[]` | |
| TC-035 | `GET /api/vendor-invoices/:id` | Unknown id | 404 `NOT_FOUND` | |
| TC-036 | `PATCH /api/vendor-invoices/:id` | Edit `vendor_name`/`invoice_number` on a `pending_review` invoice | 200, fields updated | |
| TC-037 | `PATCH /api/vendor-invoices/:id` | Change `extracted_total` | `rebate_amount` and `verified_total` recalculated from the new total | |
| TC-038 | `PATCH /api/vendor-invoices/:id` | Invoice status is `approved`/`synced_to_xero`/`rejected` | 409 `INVALID_STATUS` | |
| TC-039 | `PATCH /api/vendor-invoices/:id` | `extracted_total` set to 0 or negative | 400 `INVALID_TOTAL` | |
| TC-040 | `PATCH /api/vendor-invoices/:id` | Edit that would make `verified_total` negative | 400 `NEGATIVE_VERIFIED_TOTAL` | |
| TC-041 | `PATCH /api/vendor-invoices/:id` | Unknown id | 404 `NOT_FOUND` | |
| TC-042 | `POST /api/vendor-invoices/:id/approve` | Happy path, Xero reachable and contact recognised | 200, status `synced_to_xero`, `xero_bill_id` set, `sync_log.status: success` | |
| TC-043 | `POST /api/vendor-invoices/:id/approve` | Xero rejects the bill (e.g. `ContactNotFound`) | 200 with status `failed`, `sync_log.error_message` populated | |
| TC-044 | `POST /api/vendor-invoices/:id/approve` | Duplicate `vendor_name` + `invoice_number` already approved/synced | 409 `DUPLICATE_INVOICE` | |
| TC-045 | `POST /api/vendor-invoices/:id/approve` | Invoice not in `pending_review` | 409 `INVALID_STATUS` | |
| TC-046 | `POST /api/vendor-invoices/:id/approve` | `extracted_total` not set | 409 `MISSING_TOTAL` | |
| TC-047 | `POST /api/vendor-invoices/:id/approve` | Xero not connected | 503 `XERO_NOT_CONNECTED` | |
| TC-048 | `POST /api/vendor-invoices/:id/approve` | Unknown id | 404 `NOT_FOUND` | |
| TC-049 | `POST /api/vendor-invoices/:id/reject` | Valid `rejection_reason`, invoice `pending_review` | 200, status `rejected`, reason stored | |
| TC-050 | `POST /api/vendor-invoices/:id/reject` | Missing `rejection_reason` | 400 `MISSING_REASON` | |
| TC-051 | `POST /api/vendor-invoices/:id/reject` | Invoice already `approved`/`synced_to_xero` | 409 `INVALID_STATUS` | |
| TC-052 | `POST /api/vendor-invoices/:id/reextract` | Invoice in `extraction_failed`, retry succeeds | 200, new extraction replaces old line items, status `pending_review` | |
| TC-053 | `POST /api/vendor-invoices/:id/reextract` | Invoice not in `pending_review`/`extraction_failed` | 409 `INVALID_STATUS` | |
| TC-054 | `POST /api/vendor-invoices/:id/reextract` | Gemini fails again on retry | 502 `OCR_EXTRACTION_FAILED`, status stays `extraction_failed` | |
| TC-055 | `PATCH /api/vendor-invoice-items/:id` | Change an item's `amount` | Parent's `extracted_total`/`rebate_amount`/`verified_total` recomputed from all items | |
| TC-056 | `PATCH /api/vendor-invoice-items/:id` | `amount` set to 0 or negative | 400 `INVALID_AMOUNT` | |
| TC-057 | `PATCH /api/vendor-invoice-items/:id` | Parent invoice not in an editable status | 409 `INVALID_STATUS` | |
| TC-058 | `PATCH /api/vendor-invoice-items/:id` | Unknown item id | 404 `NOT_FOUND` | |
| TC-059 | `GET /api/xero/sync-logs` | No filters | 200, entries with pagination and an `xero_connected` flag | |
| TC-060 | `GET /api/xero/sync-logs` | `status=failed` | Only failed entries returned | |
| TC-061 | `GET /api/xero/sync-logs` | `entity_type=vendor_invoice` vs `entity_type=ar_invoice` | Only matching entity rows returned for each | |
| TC-062 | `GET /api/xero/sync-logs` | Entry with `attempt_count >= 3` | `retry_available: false` on that entry | |
| TC-063 | `GET /api/xero/sync-logs` | Xero currently disconnected | `retry_available: false` on all `failed` entries, `xero_connected: false` | |
| TC-064 | `POST /api/xero/sync-logs/:id/retry` | Failed log, attempt < 3, Xero connected, Xero accepts on retry | 200, status `success`, `xero_record_id` returned | |
| TC-065 | `POST /api/xero/sync-logs/:id/retry` | Retry attempt also rejected by Xero | 200, status `failed`, `attempt_count` incremented, new `error_message` | |
| TC-066 | `POST /api/xero/sync-logs/:id/retry` | `attempt_count` already >= 3 | 409 `RETRY_LIMIT_REACHED` | |
| TC-067 | `POST /api/xero/sync-logs/:id/retry` | Log status is not `failed` | 409 `NOT_FAILED` | |
| TC-068 | `POST /api/xero/sync-logs/:id/retry` | Xero not connected | 503 `XERO_NOT_CONNECTED` | |
| TC-069 | `POST /api/xero/sync-logs/:id/retry` | Unknown log id | 404 `NOT_FOUND` | |
| TC-070 | `GET /api/xero/sync-logs` / `POST .../retry` | Call as a role outside ap/ar(/md for GET) | 403 `FORBIDDEN` | |
| TC-071 | `POST /api/vendor-invoices/:id/approve` | Call as any non-`ap_specialist` role | 403 `FORBIDDEN` | |
| TC-072 | `POST /api/vendor-invoices/:id/reject` | Call as any non-`ap_specialist` role | 403 `FORBIDDEN` | |
| TC-073 | `POST /api/vendor-invoices/:id/reextract` | Call as any non-`ap_specialist` role | 403 `FORBIDDEN` | |
| TC-074 | `PATCH /api/vendor-invoice-items/:id` | Call as any non-`ap_specialist` role | 403 `FORBIDDEN` | |
| TC-075 | Any endpoint above | Request sent with missing or expired JWT | 401 `UNAUTHORIZED` | |

---

## Frontend Test Cases

| Test ID | What is Being Tested (Screen / Flow) | Input / Action | Expected Outcome | Pass/Fail |
|---|---|---|---|---|
| TC-076 | Xero Connection page | Load as `managing_director` while connected | Org name, tenant ID, connected-since, token expiry shown; "Disconnect Xero" button visible | |
| TC-077 | Xero Connection page | Load as `ap_specialist`/`ar_specialist` while connected | Read-only status card, no connect/disconnect button, "Only the Managing Director can..." message | |
| TC-078 | Xero Connection page | Load as `managing_director` while not connected | "Not connected to Xero" state + "Connect to Xero" button visible | |
| TC-079 | Xero Connection page | Load as `ap_specialist`/`ar_specialist` while not connected | "Not connected" state + "Ask the Managing Director to connect..." message, no button | |
| TC-080 | Xero Connection page | Click "Connect to Xero" (as MD) | Browser redirects to the returned `auth_url` | |
| TC-081 | Xero Connection page | Return from OAuth redirect with `?connected=true` | Success toast shown, query string stripped from URL, status reloads to "Connected" | |
| TC-082 | Xero Connection page | Return from OAuth redirect with `?error=access_denied` | Error toast: "Xero connection was not authorised..." | |
| TC-083 | Xero Connection page | Return with `?error=invalid_state` / `code_expired` / `token_exchange_failed` | Matching mapped error toast shown for each case | |
| TC-084 | Xero Connection page | Click "Disconnect Xero" (as MD, connected) | Success toast, page reloads showing "Not connected" state | |
| TC-085 | Xero Connection page | `token_expiry` is in the past | Red "Access token has expired" warning banner shown | |
| TC-086 | Xero Connection page | `token_expiry` within next 24 hours | Amber "Token expires within 24 hours" warning banner shown | |
| TC-087 | Xero Connection page | Click "View Sync Status" | Navigates to `/xero/sync-status` | |
| TC-088 | Vendor Invoice List page | Load page | Table populated from `GET /api/vendor-invoices`; status filter pill counts match the data | |
| TC-089 | Vendor Invoice List page | Click a status filter pill (e.g. "pending review") | Table refetches and shows only rows with that status | |
| TC-090 | Vendor Invoice List page | No vendor invoices exist | "No vendor invoices. Upload a PDF to get started." message shown | |
| TC-091 | Vendor Invoice List page | Click "Upload Invoice" | Upload modal opens | |
| TC-092 | Upload modal | Drag-and-drop a valid PDF into the dropzone | File accepted; filename and size shown | |
| TC-093 | Upload modal | Drop/select a non-PDF file | Error toast "Only PDF files are accepted...", file rejected | |
| TC-094 | Upload modal | Click "Upload & Extract" with no file selected | Error toast "Select a PDF file to upload.", no request sent | |
| TC-095 | Upload modal | Submit a valid PDF with default rebate | Success toast with extracted total, modal closes, navigates to the new invoice's review page | |
| TC-096 | Upload modal | Submit a valid PDF with a custom rebate % | Request payload includes the overridden `rebate_percentage` | |
| TC-097 | Upload modal | Storage/upload fails before an invoice is saved | Error toast shows the server message, modal stays open for retry | |
| TC-097A | Upload modal | OCR fails after the PDF and placeholder invoice are saved | Warning explains that the invoice was saved; modal closes and opens its manual review page | |
| TC-098 | Vendor Invoice List page | Confidence column rendering | >=90% shown green, 80-89% amber, <80% or `is_low_confidence` shown red | |
| TC-099 | Vendor Invoice List page | Click "Review" on a row | Navigates to `/vendor-invoices/:id` | |
| TC-100 | AP Invoice Review page | Load for a `pending_review` invoice | PDF panel + editable fields + rebate summary + line items all rendered, fields editable | |
| TC-101 | AP Invoice Review page | Load for a non-editable status (`approved`/`synced_to_xero`/`rejected`) | Fields render disabled/read-only, no "Save Changes" button | |
| TC-102 | AP Invoice Review page | Edit `Extracted Total` and click "Save Changes" | Success toast "Changes saved. Rebate recalculated.", rebate/verified total refresh | |
| TC-103 | AP Invoice Review page | Save header changes that the server rejects (e.g. negative total) | Error toast with the server's message, invoice left unchanged | |
| TC-104 | AP Invoice Review page | Click "Approve & Sync" when Xero push succeeds | Success toast "Approved and synced to Xero.", status badge -> `synced_to_xero`, Xero bill ID banner shown | |
| TC-105 | AP Invoice Review page | Click "Approve & Sync" when the Xero push fails | Error toast with the sync failure reason, status badge -> `failed` | |
| TC-106 | AP Invoice Review page | Click "Reject" then "Confirm Reject" with no reason entered | Inline error "Enter a reason for rejecting this invoice.", modal stays open | |
| TC-107 | AP Invoice Review page | Click "Reject", enter a reason, "Confirm Reject" | Success toast, modal closes, status -> `rejected`, reason displayed on the page | |
| TC-108 | AP Invoice Review page | Invoice is low-confidence | Amber "Low-confidence extraction (_%)" banner shown | |
| TC-109 | AP Invoice Review page | Invoice status is `extraction_failed` | Red banner with a "Retry Extraction" button shown | |
| TC-110 | AP Invoice Review page | Click "Retry Extraction" | Success toast on success, or error toast if extraction fails again | |
| TC-111 | AP Invoice Review page | Click the pencil icon on a line item, edit values, click check/save | Line item updates; parent extracted/rebate/verified totals refresh | |
| TC-112 | AP Invoice Review page | Click the X icon to cancel a line item edit | Edit form discarded, original values shown unchanged | |
| TC-113 | AP Invoice Review page | Click "Open in new tab" on the source document | PDF opens in a new browser tab at `pdf_url` | |
| TC-114 | AP Invoice Review page | Click "Back to Vendor Invoices" | Navigates to `/vendor-invoices` | |
| TC-115 | Xero Sync Status page | Load page | Pending/Success/Failed stat cards match the counts returned by `GET /api/xero/sync-logs` | |
| TC-116 | Xero Sync Status page | Xero currently disconnected | Red "Xero is not connected..." banner shown at the top | |
| TC-117 | Xero Sync Status page | Click a status filter (Pending/Success/Failed) | Table updates to show only matching rows | |
| TC-118 | Xero Sync Status page | Click an entity-type filter (AP/AR) | Table updates to show only matching `entity_type` rows | |
| TC-119 | Xero Sync Status page | Failed row with `attempt_count < 3` and Xero connected | "Retry" button shown and enabled | |
| TC-120 | Xero Sync Status page | Failed row with `attempt_count >= 3` | "Retry unavailable" text shown instead of a button; attempt count shown in red | |
| TC-121 | Xero Sync Status page | Click "Retry" on a retryable failed row, retry succeeds | Success toast "Retry succeeded - synced to Xero.", row updates to `success` | |
| TC-122 | Xero Sync Status page | Click "Retry" and it fails again | Error toast with the failure reason, row stays `failed` with incremented attempt count | |
| TC-123 | Xero Sync Status page | Click "Back to Vendor Invoices" / "Back to Invoices" | Navigates to `/vendor-invoices` for `ap_specialist`, `/invoices` for other roles | |
