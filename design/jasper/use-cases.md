# Use Cases - Jasper

**Feature Area:** AR Billing, Pricing Engine & Invoice Sync

---

## UC-01: Create Client Pricing Contract

**Actor:** AR Specialist (Sarah)

**Trigger:** A new client signs a service agreement with EFAR, or an existing contract expires and needs renewal.

**Main Flow:**
1. Sarah navigates to the Pricing Contracts section.
2. She clicks "New Contract" and selects the client from the client list.
3. She enters the contract name, effective start date, and effective end date.
4. She adds one or more pricing rules to the contract:
   - Base rate (per service tier: basic, advanced, critical)
   - Overtime multiplier (rate applied per overtime hour)
   - Evacuation surcharge (rate per floor above ground level)
5. She saves the contract. The system sets `is_active = true` if today's date falls within the effective date range.
6. The new contract appears in the active contracts list for that client.

**Edge Cases / Alternative Flows:**
- **Overlapping contract dates:** If an active contract already exists for the same client covering the same date range, the system blocks submission and displays an error: "An active contract already exists for this client. Please set an end date on the existing contract before creating a new one."
- **Missing pricing rules:** If Sarah saves a contract with no pricing rules attached, the system warns her that the pricing match engine will not be able to generate invoice amounts for this client's jobs until rules are added.

---

## UC-02: Edit or Deactivate a Pricing Contract

**Actor:** AR Specialist (Sarah)

**Trigger:** A client renegotiates their pricing terms, or a contract period ends and needs to be closed out.

**Main Flow:**
1. Sarah opens the Pricing Contracts section and locates the contract by client name.
2. She clicks into the contract and edits the pricing rules or adjusts the effective end date.
3. She saves the changes. The system updates `is_active` automatically based on the new date range.
4. Any invoices already matched under the old contract rates are unaffected - changes apply only to future matches.

**Edge Cases / Alternative Flows:**
- **Editing a contract with already-matched invoices:** The system displays a warning: "X invoices have already been matched using this contract. Editing rules will not retroactively change those invoices." Sarah must acknowledge before saving.
- **Setting an end date in the past:** The system immediately sets `is_active = false` and removes the contract from the active pool used by the pricing match engine.

---

## UC-03: Review Service Memo Before Pricing Match

**Actor:** AR Specialist (Sarah)

**Trigger:** Field crew submits a digital service memo. Sarah receives an in-app notification and opens the memo queue.

**Main Flow:**
1. Sarah opens her memo review queue, which lists all submitted memos not yet matched.
2. She clicks into a memo and reviews the captured fields:
   - Job start and end time
   - Overtime hours
   - Evacuation floor count
   - Patient details
   - Hospital destination
   - Attached signature or hospital stamp image
3. If the memo data looks correct, she clicks "Approve & Match". The system proceeds to UC-04.
4. The memo status updates to `reviewed` and the booking status advances to `matched`.

**Edge Cases / Alternative Flows:**
- **Incorrect data on the memo:** Sarah clicks "Return to Crew" and enters a correction note. The memo status reverts to `submitted` and the field crew member receives a notification to amend and resubmit.
- **Missing hospital stamp image where required:** Sarah can still approve the memo if the digital signature is present, but the system flags the record as "stamp pending" for follow-up.

---

## UC-04: Automated Pricing Match

**Actor:** System (triggered by Sarah approving a memo in UC-03)

**Trigger:** Sarah clicks "Approve & Match" on a reviewed service memo.

**Main Flow:**
1. The system retrieves the booking linked to the memo and identifies the client.
2. It queries the `pricing_contracts` table for an active contract covering the job date for that client.
3. It reads the memo fields and applies the matching pricing rules:
   - Looks up the base rate for the service tier recorded on the booking.
   - Multiplies overtime hours by the overtime multiplier rate.
   - Multiplies evacuation floors by the evacuation surcharge rate.
4. It creates an `invoices` record with status `matched` and populates `invoice_line_items` for each charge component.
5. The matched invoice appears in Sarah's invoice review queue (UC-05).

**Edge Cases / Alternative Flows:**
- **No active contract found for the client:** The system halts the match and flags the invoice with status `unmatched - no contract`. Sarah is notified and must create a contract (UC-01) before the match can proceed.
- **A pricing rule is missing for the job's service tier:** The system creates the invoice but leaves the affected line item with a zero amount and flags it as `incomplete`. Sarah is prompted to manually enter the missing amount in UC-05.
- **Overtime hours are zero and evacuation floors are zero:** The system generates the invoice with only the base rate line item. No error is raised - this is a valid standard job.

---

## UC-05: Review and Adjust a Matched Invoice

**Actor:** AR Specialist (Sarah)

**Trigger:** The pricing match engine creates an invoice (UC-04). The invoice appears in Sarah's review queue.

**Main Flow:**
1. Sarah opens the invoice from her review queue.
2. She sees the auto-generated line items alongside the source memo data for comparison.
3. She reviews each line item amount for accuracy.
4. If everything is correct, she marks the invoice as "Ready for Approval" with no changes.
5. If an adjustment is needed, she edits a line item amount or adds a manual surcharge line item with a description.
6. She saves the invoice. The status updates to `adjusted` if changes were made, or remains `matched` if none were.
7. The invoice moves to the batch approval queue (UC-06).

**Edge Cases / Alternative Flows:**
- **Sarah disputes the entire matched amount:** She clicks "Reject Match" and enters a reason. The memo is returned to the review queue (UC-03) with a note, and the invoice is deleted so the match can be rerun after the memo is corrected.
- **A hospital requires additional administrative fees not covered by the pricing contract:** Sarah adds a free-text surcharge line item manually. The system logs this as a manual adjustment for audit purposes.

---

## UC-06: Batch Invoice Approval

**Actor:** AR Specialist (Sarah)

**Trigger:** One or more invoices reach "Ready for Approval" status and Sarah initiates a batch sync to Xero.

**Main Flow:**
1. Sarah navigates to the Batch Approval view, which lists all invoices in `matched` or `adjusted` status.
2. She selects individual invoices or uses "Select All" for the current period.
3. She reviews the batch summary: total number of invoices, combined value, and client breakdown.
4. She clicks "Approve & Sync to Xero". The system updates all selected invoices to `approved` status and queues them for Xero push (UC-07).
5. Each invoice displays a sync status indicator: pending, synced, or failed.

**Edge Cases / Alternative Flows:**
- **Sarah deselects specific invoices before approving:** Only the selected invoices are pushed. Deselected invoices remain in the queue for the next batch.
- **One or more invoices in the batch fail Xero sync (UC-07):** The successful ones update to `synced_to_xero`. The failed ones are flagged individually with the Xero error reason so Sarah can retry without reprocessing the whole batch.

---

## UC-07: Push Draft Invoices to Xero

**Actor:** System (triggered by batch approval in UC-06)

**Trigger:** Sarah approves a batch of invoices. The system processes the Xero push queue.

**Main Flow:**
1. The system authenticates with Xero using the stored OAuth2 access token.
2. For each approved invoice in the queue, the system constructs a Xero-formatted invoice payload using the invoice's line items, client details, and amounts.
3. It sends a POST request to the Xero API to create a draft invoice.
4. On success, the system stores the returned `xero_invoice_id` on the local invoice record and updates status to `synced_to_xero`.
5. A `xero_sync_logs` record is written with status `success` and the timestamp.
6. Sarah sees the updated sync status in the AR batch tracker (UC-09).

**Edge Cases / Alternative Flows:**
- **OAuth2 access token has expired:** The system automatically attempts a token refresh using the stored refresh token before retrying. If the refresh fails, the push is aborted and Sarah is shown an alert: "Xero connection requires re-authentication."
- **Xero API rate limit hit:** The system pauses and retries the remaining invoices after a delay. `attempt_count` on the `xero_sync_logs` record is incremented. Sarah sees affected invoices flagged as "Retrying".
- **Xero rejects an invoice payload (e.g. missing required field):** The system marks that invoice as `failed`, logs the full Xero error message in `xero_sync_logs`, and continues pushing the remaining invoices in the batch. Sarah can view the specific error and correct the invoice before retrying.

---

## UC-08: Bank Feed Ingestion from Xero

**Actor:** System / AR Specialist (Sarah)

**Trigger:** Sarah manually triggers a bank feed pull from the AR dashboard, or the system runs a scheduled pull.

**Main Flow:**
1. The system authenticates with Xero using the stored OAuth2 token.
2. It requests the latest bank statement lines from Xero for the configured EFAR bank account.
3. The returned transactions are stored locally for reference during AR reconciliation.
4. Sarah can view the imported transactions alongside the current invoice list to identify payments received against outstanding invoices.
5. A `xero_sync_logs` record is written for the pull with entity type `bank_feed`.

**Edge Cases / Alternative Flows:**
- **No new transactions since the last pull:** The system completes without writing new records and displays "Bank feed up to date as of [last pull timestamp]."
- **OAuth2 token has expired:** Same re-authentication flow as UC-07. If token refresh fails, Sarah is prompted to reconnect to Xero.
- **Xero returns a partial response (network interruption mid-fetch):** The system stores only the transactions successfully received and logs the incomplete pull. Sarah is notified to re-trigger the pull to fetch the remainder.

---

## UC-09: Revenue Leakage Alert

**Actor:** System / Managing Director (Doris) / AR Specialist (Sarah)

**Trigger:** The system detects a booking in `completed` status with no linked service memo after a defined time window (e.g. 4 hours post job end time).

**Main Flow:**
1. The system runs a periodic check against all bookings with status `completed` and no associated `service_memos` record.
2. For each flagged booking, it checks whether the time elapsed since the scheduled job date exceeds the alert threshold.
3. Flagged bookings are surfaced in the Revenue Leakage Alert panel on both the AR dashboard and the executive dashboard.
4. Each alert shows the booking reference, client name, job date, and assigned crew member.
5. Sarah can click into the alert and either follow up with the crew to submit the missing memo, or mark the alert as resolved with a reason (e.g. job was cancelled on site).

**Edge Cases / Alternative Flows:**
- **Memo was submitted but failed to link to the booking:** The system provides a manual "Link Memo" action on the alert so Sarah can associate an orphaned memo with the booking without requiring a resubmission.
- **The booking was cancelled after completion status was set:** Sarah marks the alert as "Cancelled - No Memo Required". The booking and alert are excluded from future revenue leakage reports.

---

## UC-10: AR Batch Status Tracker

**Actor:** AR Specialist (Sarah) / Managing Director (Doris)

**Trigger:** User navigates to the AR dashboard.

**Main Flow:**
1. The system aggregates all invoice records and groups them by status: `matched`, `adjusted`, `approved`, `synced_to_xero`, `failed`.
2. The dashboard displays a summary panel showing the count and total value per status group.
3. Sarah can click into any status group to drill down to the individual invoices in that state.
4. The Managing Director sees the same high-level summary as a read-only view without the ability to take action on individual invoices.
5. The tracker refreshes automatically when a sync event or approval occurs.

**Edge Cases / Alternative Flows:**
- **No invoices exist yet (e.g. first day of use):** Each status group shows a zero count. No error is raised - the empty state is displayed with a prompt to process the first memo.
- **A large number of failed invoices are present:** The `failed` group is highlighted in a distinct colour to draw attention. Sarah can bulk-retry all failed syncs from the tracker view without navigating to each invoice individually.
