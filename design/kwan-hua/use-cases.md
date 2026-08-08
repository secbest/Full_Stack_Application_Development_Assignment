# Use Cases - Kwan Hua

**Feature Area:** Xero Foundation, OCR & AP Processing

---

## UC-01: Connect Platform to Xero via OAuth2

**Actor:** Admin / Managing Director (Doris)

**Trigger:** The platform is being set up for the first time, or the Xero connection has been revoked and needs to be re-established.

**Main Flow:**
1. Admin navigates to the Xero Integration settings page.
2. Admin clicks "Connect to Xero".
3. The system redirects the user to the Xero OAuth2 authorisation page with the configured `client_id` and requested permission scopes.
4. The admin logs into Xero and approves the requested permissions.
5. Xero redirects back to the platform with an authorisation code.
6. The system exchanges the authorisation code for an access token and a refresh token via the Xero token endpoint.
7. Both tokens are stored securely in the environment. The connection status page updates to "Connected" with the linked Xero organisation name and connection timestamp.

**Edge Cases / Alternative Flows:**
- **Admin denies permissions on the Xero authorisation page:** Xero redirects back with an error parameter. The system displays: "Xero connection was not authorised. Please try again and accept the required permissions."
- **The authorisation code has expired before exchange (user left the tab open too long):** Xero rejects the exchange request. The system detects the error response and prompts the admin to restart the connection flow.
- **The Xero account connected does not match the expected organisation:** The system displays the connected organisation name after authorisation and asks the admin to confirm before saving the tokens. If wrong, they can disconnect and reconnect with the correct account.

---

## UC-02: Refresh Xero Access Token Automatically

**Actor:** System

**Trigger:** Any backend service (invoice push, bank feed pull, AP sync) attempts a Xero API call and receives a 401 Unauthorised response, or the system detects the access token is within its expiry window before making a call.

**Main Flow:**
1. The system detects the access token is expired or about to expire.
2. It sends a POST request to the Xero token endpoint using the stored refresh token and `client_id` / `client_secret`.
3. Xero returns a new access token and a new refresh token.
4. The system replaces the stored tokens with the new values.
5. The original API call that triggered the refresh is retried automatically using the new access token.
6. The calling service continues without any user-facing interruption.

**Edge Cases / Alternative Flows:**
- **The refresh token has also expired (Xero refresh tokens expire after 60 days of inactivity):** The system cannot obtain a new access token. It aborts the pending operation, marks any affected sync jobs as `failed`, and raises an alert prompting the admin to re-authenticate via UC-01.
- **The Xero token endpoint is unreachable (network issue):** The system retries the refresh up to 3 times with exponential backoff. If all attempts fail, the pending operation is queued and the admin is notified of the connectivity issue.

---

## UC-03: Upload Vendor PDF Invoice

**Actor:** AP Specialist (Chloe)

**Trigger:** EFAR receives a vendor invoice (diesel supplier, vehicle repair workshop, etc.) and Chloe needs to process it for payment.

**Main Flow:**
1. Chloe navigates to the Vendor Invoices section and clicks "Upload Invoice".
2. She selects a PDF file from her device (maximum file size enforced by the system).
3. The system uploads the file to Cloudinary via the backend and stores the returned secure PDF URL in the `vendor_invoices` table with status `pending_review`.
4. The system immediately triggers OCR extraction (UC-04) on the uploaded PDF.
5. Chloe is redirected to the AP review interface for that invoice (UC-06) once extraction completes.

**Edge Cases / Alternative Flows:**
- **Chloe uploads a non-PDF file (e.g. a JPEG photo of an invoice):** The system rejects the upload and displays: "Only PDF files are accepted. Please scan the invoice and upload as a PDF."
- **The uploaded PDF exceeds the maximum allowed file size:** The system rejects the upload before sending it to Cloudinary and instructs Chloe to compress or re-scan the document.
- **Cloudinary upload fails (network timeout or service outage):** The system displays an error and does not create a `vendor_invoices` record. Chloe is prompted to retry. No partial records are created.

---

## UC-04: OCR Data Extraction via Gemini API

**Actor:** System (triggered automatically after UC-03)

**Trigger:** A vendor PDF is successfully uploaded and a `vendor_invoices` record is created with status `pending_review`.

**Main Flow:**
1. The system retrieves the Cloudinary PDF URL for the new vendor invoice record.
2. It sends a structured prompt to the Gemini API along with the PDF URL, requesting extraction of the following fields: vendor name, invoice number, invoice date, line items (description, quantity, unit price, amount), and total amount.
3. Gemini processes the document and returns a JSON response containing the extracted fields and an overall `extraction_confidence` score (0.0 to 1.0).
4. The system maps the extracted values to the `vendor_invoices` and `vendor_invoice_items` tables.
5. If `extraction_confidence` is at or above the threshold (e.g. 0.80), the system sets `is_low_confidence = false` and the invoice proceeds to UC-05 for rebate verification.
6. The AP review interface (UC-06) is pre-populated with the extracted data for Chloe to review.

**Edge Cases / Alternative Flows:**
- **Gemini returns a confidence score below the threshold:** The system sets `is_low_confidence = true` and flags the invoice in the review queue with a "Needs Manual Check" indicator. Chloe is prompted to correct the extracted fields before proceeding (UC-06 alternative flow).
- **Gemini is unable to extract one or more fields (e.g. the invoice total is missing):** The missing fields are left blank in the database and highlighted in the AP review interface. Chloe must fill them in manually before the invoice can be approved.
- **The Gemini API returns an error or times out:** The system retries once after a short delay. If the retry also fails, the invoice status is set to `extraction_failed` and Chloe is notified. She can trigger a manual re-extraction or enter all fields manually.
- **The PDF is a scanned image with poor print quality:** Gemini may return a low confidence score or incomplete fields. The system handles this as the low-confidence flow above - no silent pass of uncertain data.

---

## UC-05: Automated 1% Rebate Verification

**Actor:** System (triggered automatically after UC-04 completes successfully)

**Trigger:** OCR extraction completes and the `extracted_total` is populated on the vendor invoice record.

**Main Flow:**
1. The system reads the `extracted_total` from the vendor invoice.
2. It reads the `rebate_percentage` configured for this vendor (default: 1.0%).
3. It calculates `rebate_amount = extracted_total × (rebate_percentage / 100)`.
4. It calculates `verified_total = extracted_total - rebate_amount`.
5. Both values are stored on the `vendor_invoices` record.
6. The AP review interface (UC-06) displays the rebate calculation alongside the extracted total so Chloe can see the expected net payable amount.

**Edge Cases / Alternative Flows:**
- **The vendor's rebate percentage differs from the default 1%:** If the vendor has a custom rebate rate stored in the system, that rate is used instead. If no rate is configured, the system defaults to 1% and displays a notice: "Using default 1% rebate - please confirm this applies to this vendor."
- **The extracted total is zero or missing (incomplete OCR):** The system skips rebate calculation and leaves `rebate_amount` and `verified_total` as null. Chloe must enter the total manually in UC-06 before rebate calculation can be triggered.
- **The rebate results in a negative verified total (data entry error):** The system flags this as an anomaly and blocks approval until Chloe corrects the extracted total.

---

## UC-06: AP Invoice Review and Approval

**Actor:** AP Specialist (Chloe)

**Trigger:** OCR extraction and rebate verification complete. Chloe opens the invoice from her AP review queue.

**Main Flow:**
1. Chloe opens the AP review interface for the vendor invoice.
2. The interface shows a two-panel view: the original PDF on the left and the extracted data fields on the right.
3. Chloe reviews each extracted field against the visible PDF:
   - Vendor name, invoice number, invoice date
   - Each line item (description, quantity, unit price, amount)
   - Extracted total, rebate amount, and verified total
4. If all fields are correct and the rebate has been applied, she clicks "Approve". The invoice status updates to `approved`.
5. The system queues the approved invoice for Xero AP sync (UC-07).

**Edge Cases / Alternative Flows:**
- **Chloe spots an incorrectly extracted field:** She edits the field directly in the right panel. The system recalculates the rebate if the total is changed. All manual edits are logged as corrections for audit purposes.
- **The invoice is a duplicate of one already processed:** The system performs a duplicate check on `vendor_name` + `invoice_number` before allowing approval. If a duplicate is detected, it displays a warning: "An invoice with this number from this vendor already exists. Please verify before approving."
- **Chloe rejects the invoice (e.g. it belongs to a different company or is fraudulent):** She clicks "Reject" and enters a reason. The invoice status updates to `rejected` and is excluded from the AP sync queue. It remains accessible in the audit log.
- **The invoice is flagged as low-confidence (from UC-04):** All extracted fields are shown with a yellow highlight. Chloe must confirm or correct each highlighted field before the "Approve" button becomes active.

---

## UC-07: Sync Approved AP Invoice to Xero

**Actor:** System (triggered by Chloe approving an invoice in UC-06)

**Trigger:** A vendor invoice status is updated to `approved`.

**Main Flow:**
1. The system retrieves the approved vendor invoice and its line items.
2. It authenticates with Xero using the stored access token (triggering UC-02 if the token is expired).
3. It constructs a Xero-formatted bill payload using the vendor name, invoice number, date, line items, and verified total.
4. It sends a POST request to the Xero API to create a draft bill in the AP ledger.
5. On success, the system stores the returned `xero_bill_id` on the vendor invoice record and updates status to `synced_to_xero`.
6. A `xero_sync_logs` record is created with `entity_type = vendor_invoice`, status `success`, and the sync timestamp.
7. The Xero sync status indicator in Chloe's dashboard updates to "Synced".

**Edge Cases / Alternative Flows:**
- **Xero rejects the bill payload (e.g. unrecognised vendor or missing account code):** The system sets the invoice status to `failed`, writes a `xero_sync_logs` record with the full Xero error message, and notifies Chloe. She can correct the vendor details and retry the sync from the status panel (UC-08).
- **Access token expired during sync:** The system invokes UC-02 to refresh the token and retries the sync automatically. If the refresh fails, the sync is aborted and Chloe is notified to re-authenticate.
- **Xero API is temporarily unavailable:** The system retries up to 3 times with exponential backoff, incrementing `attempt_count` on the sync log each time. If all attempts fail, Chloe is notified and can retry manually once Xero is available.

---

## UC-08: View and Retry Xero Sync Status

**Actor:** AP Specialist (Chloe) / AR Specialist (Sarah)

**Trigger:** User opens the Xero Sync Status panel on the AP or AR dashboard, or receives an in-app notification about a sync failure.

**Main Flow:**
1. The user navigates to the Xero Sync Status panel.
2. The system displays all sync log entries grouped by status: `success`, `pending`, and `failed`.
3. For each `failed` entry, the system shows the entity type (AR invoice or vendor invoice), the entity reference, the Xero error message, and the number of previous attempts.
4. The user clicks "Retry" on a failed entry.
5. The system re-attempts the Xero API call for that specific record (UC-07 for AP, Jasper's UC-07 for AR invoices).
6. The sync log entry updates to reflect the new attempt outcome.

**Edge Cases / Alternative Flows:**
- **The same invoice has failed 3 or more times:** The system disables the individual retry button and shows a "Contact Support" message alongside the Xero error detail, indicating a likely configuration issue rather than a transient error.
- **User attempts to retry a sync while Xero authentication is invalid:** The system detects the invalid token before attempting the retry and redirects the admin to re-authenticate (UC-01) rather than logging another failed attempt.
- **All failed entries belong to the same root cause (e.g. expired token):** The system groups them and displays a single "Reconnect Xero" prompt rather than surfacing individual retries, preventing Chloe from retrying 20 invoices one by one before realising the token is the problem.

---

## UC-10: Automatic Vendor Invoice Intake via Gmail

**Actor:** System (background/manual poll), Managing Director (Doris, one-time connect), AP Specialist (Chloe, reviews the resulting drafts)

**Trigger:** A vendor emails a PDF invoice to the EFAR AP intake inbox instead of it being uploaded by hand, and the Gmail connection has already been established.

**Main Flow:**
1. (One-time setup) Doris opens the Xero Integration Settings screen and clicks "Connect Gmail". The system calls `GET /api/gmail/connect`, which returns a Google OAuth2 authorisation URL requesting the `gmail.modify` scope with `access_type=offline` and `prompt=consent` so a refresh token is always issued, and generates a short-lived CSRF `state` token.
2. Doris signs in to the Gmail account used for AP intake and approves access. Google redirects to `GET /api/gmail/callback` with an authorisation code and the `state` token.
3. The system validates `state`, exchanges the code for tokens, reads the connected mailbox's address, deactivates any previously-connected inbox, and stores the encrypted refresh token in `gmail_connections` with `is_connected = true`. The browser is redirected back to `/vendor-invoices?gmail_connected=true`.
4. Whenever an import runs - either an operator clicking "Import now" (`POST /api/gmail/import`) or a scheduled poll calling the same code path - the system finds (or creates) the `EFAR AP Invoices` and `EFAR AP Processed` Gmail labels, then lists messages under the intake label that have a PDF attachment and are not yet tagged with the processed label.
5. For each candidate message, the system fetches the full message, extracts every PDF attachment, and internally invokes the same handler used by `POST /api/vendor-invoices/inbound-email`, passing `gmail:<messageId>` as the idempotency key stored on `vendor_invoices.inbound_email_id`.
6. For each PDF that creates a new `vendor_invoices` row, the normal OCR pipeline (UC-04) and rebate/GST calculation (UC-05) run exactly as for a manual upload, leaving the invoice at `pending_review` in Chloe's AP review queue.
7. If none of the attachments from a message failed to import, the system labels that Gmail message as processed so it is not imported again on the next poll.

**Edge Cases / Alternative Flows:**
- **Gmail is not connected when an import is triggered:** `POST /api/gmail/import` returns `{ connected: false, imported: [], message: "Gmail is not connected." }` without error; the AP review queue is simply not updated until Doris completes UC-10 step 1-3.
- **Google denies the OAuth request, the CSRF `state` is missing/expired, or no authorisation code is returned:** `GET /api/gmail/callback` redirects to `/vendor-invoices` with `gmail_error=access_denied`, `gmail_error=invalid_state`, or `gmail_error=missing_code` respectively, and no `gmail_connections` row is written or changed.
- **Google approves the connection but does not return a refresh token (the app was already authorised once before):** The callback treats this as a failure and redirects with `gmail_error=token_exchange_failed`; Doris must remove EFAR's access from her Google Account's third-party app list and reconnect so Google issues a fresh refresh token.
- **A labelled email has no PDF attachment:** The message is skipped (not imported, not marked processed) so it can still be inspected manually; it is not treated as an error.
- **The inbound handler fails for one attachment in a message with several:** The message is not marked processed, so the next import re-attempts all of its attachments; `vendor_invoices.inbound_email_id`'s unique index means any attachment that already succeeded is not re-created, only the failed one is retried.
- **The Gmail API call itself fails (expired refresh token, network error, Gmail quota):** `POST /api/gmail/import` returns `502 GMAIL_IMPORT_FAILED` and no messages are marked processed, so the next successful poll retries the same batch.
