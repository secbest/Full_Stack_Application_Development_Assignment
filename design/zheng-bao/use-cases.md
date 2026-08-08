# Use Cases - Zheng Bao

**Feature Area:** Customer Intake & Booking Management

---

## UC-01: Submit Customer Intake Query

**Actor:** Customer (hospital, corporate client, or individual)

**Trigger:** A customer needs to request ambulance or emergency medical services from EFAR and submits a query via the intake portal.

**Main Flow:**
1. The customer navigates to the EFAR public intake portal.
2. The system presents a structured intake form with the following mandatory fields:
   - Full name and organisation (if applicable)
   - Contact email and phone number
   - Type of service requested (e.g. Types of Ambulance Services: EAS, Non-Emergency Medical Transfers, Medical Coverage: Sports & Industrial Events, Pricing Schedule: Oxygen, Covid 19 Cases, No lift Landing etc.)
   - Preferred service date and time
   - Pickup location and destination
   - Additional notes (optional)
3. The customer fills in all mandatory fields and clicks "Submit". The customer does **not** select a service tier - there is no tier field on the public intake form. Tier classification (Basic, Advanced, or Critical) is a judgment call made by Camilla when she reviews the submission (UC-05), not a self-service choice.
4. The system validates all mandatory fields are present and correctly formatted.
5. A new `intake_submissions` record is created with status `pending` and `service_tier` set to `null`.
6. The system displays a confirmation message to the customer with a reference number.
7. Camilla receives an in-app notification (UC-09-A) that a new intake query has arrived.

**Edge Cases / Alternative Flows:**
- **Customer submits the form with one or more mandatory fields missing:** The system highlights the missing fields with inline error messages and prevents submission. The form retains all previously entered data so the customer does not have to start over.
- **Customer submits the same query twice (double-click or browser refresh):** The system detects a duplicate submission within a short time window based on matching contact email, service date, and location. It shows the customer their existing reference number instead of creating a second record.
- **Customer enters an invalid email format or phone number:** The system displays a field-level validation error immediately on blur so the customer can correct it before submitting.

---

## UC-02: View Intake Queue

**Actor:** Quotations Specialist (Camilla)

**Trigger:** Camilla logs in to the platform or navigates to the Intake Queue section to process pending customer queries.

**Main Flow:**
1. Camilla navigates to the Intake Queue dashboard.
2. The system displays all `intake_submissions` records with status `pending`, sorted by submission date (oldest first).
3. Each row in the queue shows: reference number, customer name, organisation, service type, requested date, and time elapsed since submission.
4. Camilla can filter the queue by service type or service tier, and search by customer name or reference number.
5. Camilla clicks into a submission to open the full detail view before taking action (confirm or reject).

**Edge Cases / Alternative Flows:**
- **The intake queue is empty:** The system displays an empty state message: "No pending intake submissions. All queries have been reviewed."
- **Multiple submissions are queued from the same customer:** The system visually groups or flags them so Camilla can identify repeat requesters and handle them together to avoid creating duplicate bookings.
- **Camilla applies a filter that returns no results:** The system shows "No submissions match the selected filters" and provides a "Clear Filters" button.

---

## UC-03: Confirm an Intake Submission and Create a Booking

**Actor:** Quotations Specialist (Camilla)

**Trigger:** Camilla opens an intake submission from the queue and determines it is valid and serviceable.

**Main Flow:**
1. Camilla opens the intake submission detail view.
2. She reviews all submitted fields - service type, requested date, and location. The submission has no service tier yet (the customer never chose one).
3. She assigns the service tier appropriate for the described situation (UC-05).
4. She selects an existing client contract or records a one-off agreed quotation, including transfer type and time category.
5. She clicks "Confirm Booking".
6. The system creates a new `bookings` record linked to the intake submission with status `confirmed`, copying the service details and freezing the approved base price for AR.
7. The `intake_submissions` status updates to `confirmed`.
8. The booking appears in the booking list (UC-07) and is available for crew assignment (UC-06).
9. The customer's submitted contact email receives a booking confirmation notification.

**Edge Cases / Alternative Flows:**
- **The requested date is in the past:** The system warns Camilla before she confirms: "The requested service date has already passed. Please contact the customer to confirm a new date before creating the booking."
- **The same customer already has an active booking on the same date and location:** The system flags a potential duplicate and asks Camilla to confirm she intends to create a second booking, in case the customer accidentally submitted twice.
- **Camilla is unsure which tier to assign:** She can consult the customer's `additional_notes` and contact them directly before choosing. Since the intake submission never carries a tier of its own, there is nothing to "revert to" - whatever Camilla selects becomes the booking's `service_tier`, with `original_service_tier` left `null`.

---

## UC-04: Reject an Intake Submission

**Actor:** Quotations Specialist (Camilla)

**Trigger:** Camilla reviews an intake submission and determines EFAR cannot fulfil the request (out of service area, no available capacity, insufficient information, etc.).

**Main Flow:**
1. Camilla opens the intake submission detail view.
2. She clicks "Reject".
3. The system presents a mandatory rejection reason field.
4. Camilla enters the reason (e.g. "Location is outside EFAR service area", "Requested date unavailable", "Incomplete information provided").
5. She confirms the rejection.
6. The `intake_submissions` status updates to `rejected` and the `rejection_reason` field is populated.
7. The submission is removed from the active intake queue and moved to a closed submissions view.
8. The customer's contact email receives a rejection notification with the reason provided.

**Edge Cases / Alternative Flows:**
- **Camilla attempts to reject without entering a reason:** The system blocks submission and displays: "A rejection reason is required before this intake can be closed."
- **Camilla accidentally rejects a valid submission:** She can reopen a rejected submission within a configurable time window and change its status back to `pending` for re-review, provided no further action has been taken on it.
- **The customer's contact email is invalid and the rejection notification bounces:** The system logs the delivery failure. Camilla is shown a notice that the rejection email could not be delivered and should follow up by phone.

---

## UC-05: Assign Service Tier at Booking Confirmation

**Actor:** Quotations Specialist (Camilla, during booking confirmation)

**Trigger:** Camilla is confirming an intake submission (UC-03) and must classify the job into a service tier before the booking can be priced.

**Main Flow:**
1. The intake form itself has no service tier field - the customer never selects one at submission time. `intake_submissions.service_tier` is always `null`.
2. During Camilla's review (UC-03), the confirmation screen presents three tier options with plain-language descriptions, based on the service description and notes the customer submitted:
   - **Basic** - Non-emergency transport, stable patient, standard equipment
   - **Advanced** - Medically supervised transport, monitoring required
   - **Critical** - Active emergency or intensive care transport, full life support
3. Camilla selects the tier that matches the described situation (e.g. Critical for an ICU transfer) and includes it in the confirmation request.
4. The final confirmed tier is stored on the `bookings` record (`service_tier`) and drives the pricing match engine's base rate lookup.

**Edge Cases / Alternative Flows:**
- **Camilla is unsure which tier applies:** She contacts the customer directly by phone or email for clarification before confirming, since there is no customer-facing tier selector to fall back on.
- **Audit trail:** `bookings.original_service_tier` exists to preserve a prior tier value if one is ever changed after the fact, but for submissions coming through the public intake form it is always `null` on creation - there is no customer-selected tier to diverge from.

---

## UC-06: Assign Crew to a Booking

**Actor:** Quotations Specialist (Camilla)

**Trigger:** A booking has been confirmed (status `confirmed`) and needs a crew member assigned before dispatch.

**Main Flow:**
1. Camilla opens the booking detail view for a confirmed booking.
2. She clicks "Assign Crew".
3. The system displays a list of available field crew members (users with the `field_crew` role and `is_active = true`).
4. Camilla selects a crew member from the list.
5. The system updates the `bookings` record with `assigned_crew_id` set to the selected user.
6. The booking status remains `confirmed`. The assigned crew member can now see this booking in their job queue.
7. The assigned crew member receives an in-app notification of the new job assignment.

**Edge Cases / Alternative Flows:**
- **No crew members are available:** The system displays an empty crew list with the message: "No active crew members are currently available. Please contact the operations team." Camilla can still save the booking without a crew assignment and return to assign later.
- **Camilla assigns the wrong crew member:** She can open the booking and change the crew assignment at any time while the booking status is still `confirmed` or `in_progress`. A log entry records the change of assignment.
- **The assigned crew member's account is deactivated after assignment:** The system flags the booking as "Crew Unavailable" and prompts Camilla to reassign before the job date.

---

## UC-07: View Booking List and Track Status

**Actor:** Quotations Specialist (Camilla) / AR Specialist (Sarah) / Managing Director (Doris)

**Trigger:** User navigates to the Bookings section to review the current state of all service jobs.

**Main Flow:**
1. The user opens the Booking List view.
2. The system displays all bookings with their current status in a paginated, sortable table:
   - `confirmed` - booking created, awaiting crew assignment or dispatch
   - `in_progress` - crew is on-site or en route
   - `completed` - job finished, awaiting field memo submission
   - `invoiced` - memo matched and invoice pushed to Xero
3. The user can filter by status, service tier, date range, client name, or assigned crew member.
4. Each row shows: booking reference, client, scheduled date, service tier, assigned crew, and current status.
5. Clicking a row opens the full booking detail view (UC-08).

**Edge Cases / Alternative Flows:**
- **A booking has been in `completed` status for more than the alert threshold with no memo submitted:** The row is highlighted to draw attention, consistent with the revenue leakage alert visible on Jasper's AR dashboard.
- **The user searches for a booking reference that does not exist:** The system displays "No bookings found matching your search." with a prompt to clear the search.
- **There are a large number of bookings:** The list is paginated with a configurable page size. Filters are preserved when navigating between pages so the user does not lose their view state.

---

## UC-08: View Booking Detail

**Actor:** Quotations Specialist (Camilla) / AR Specialist (Sarah) / Managing Director (Doris)

**Trigger:** User clicks into a booking from the booking list (UC-07) to review its full details or take action.

**Main Flow:**
1. The system displays the full booking detail page with all fields:
   - Booking reference and current status
   - Linked intake submission reference
   - Client name and contact details
   - Service tier, scheduled date, time, and location
   - Assigned crew member (if any)
   - Linked service memo (if submitted) with a link to view it
   - Linked invoice (if matched) with a link to view it
2. Available actions are displayed based on the user's role and the booking's current status:
   - Camilla: change crew assignment (if not yet completed), update status
   - Sarah: navigate to the linked memo or invoice
   - Doris: read-only view, no actions
3. The user can navigate directly to the linked memo or invoice from this page.

**Edge Cases / Alternative Flows:**
- **The booking has no linked memo yet (status is `completed`):** The system displays a "Memo Pending" indicator in the linked memo section with the time elapsed since completion, reinforcing the revenue leakage alert.
- **The booking has a linked invoice that failed Xero sync:** The invoice section displays the sync failure indicator so Sarah can navigate directly to the invoice to retry without having to search for it separately.

---

## UC-09-A: In-App Notification - New Intake Submission

**Actor:** System (sender) / Quotations Specialist (Camilla, recipient)

**Trigger:** A customer successfully submits an intake query (UC-01 completes).

**Main Flow:**
1. The system creates a notification record linked to Camilla's user account.
2. A notification badge appears on Camilla's navigation bar indicating unread notifications.
3. Camilla clicks the notification bell and sees: "New intake submission from [Customer Name] - [Service Type] on [Requested Date]."
4. Clicking the notification navigates Camilla directly to the intake submission detail view.
5. The notification is marked as read once Camilla views it.

**Edge Cases / Alternative Flows:**
- **Multiple intake submissions arrive while Camilla is offline:** All unread notifications are queued and visible when she next logs in. The badge shows the total unread count.
- **Camilla dismisses all notifications without acting on them:** The submissions remain in the intake queue (UC-02) regardless of notification read status. Dismissing a notification does not affect the submission record.

---

## UC-09-B: In-App Notification - Field Memo Submitted

**Actor:** System (sender) / AR Specialist (Sarah, recipient)

**Trigger:** A field crew member submits a service memo linked to a completed booking.

**Main Flow:**
1. The system creates a notification record linked to Sarah's user account.
2. A notification badge appears on Sarah's navigation bar.
3. Sarah clicks the notification bell and sees: "New memo submitted for Booking [Reference] - [Client Name] on [Job Date]."
4. Clicking the notification navigates Sarah directly to the memo review view (Jasper's UC-03).
5. The notification is marked as read once Sarah views it.

**Edge Cases / Alternative Flows:**
- **Sarah already has the memo queue open when the notification arrives:** The notification badge updates in real time. Sarah can refresh the queue to see the new entry without needing to click through the notification.

---

## UC-09-C: In-App Notification - Failed Xero Sync

**Actor:** System (sender) / AR Specialist (Sarah, recipient) / AP Specialist (Chloe, recipient)

**Trigger:** A Xero sync attempt for an AR invoice or AP vendor invoice fails after all retries are exhausted.

**Main Flow:**
1. The system creates a notification record linked to the relevant user (Sarah for AR invoices, Chloe for AP vendor invoices).
2. A notification badge appears on the recipient's navigation bar.
3. The recipient clicks the notification bell and sees: "Xero sync failed for [Invoice Reference] - [Error Summary]."
4. Clicking the notification navigates them directly to the Xero sync status panel (Kwan Hua's UC-08) with the failed record highlighted.
5. The notification is marked as read once the user views it.

**Edge Cases / Alternative Flows:**
- **Multiple invoices fail in the same batch:** A single grouped notification is created: "X invoices failed to sync to Xero. View sync status." to avoid flooding the notification list with individual entries for the same root cause.

---

## UC-09-D: In-App Notification - OCR Low Confidence

**Actor:** System (sender) / AP Specialist (Chloe, recipient)

**Trigger:** The Gemini Optical Character Recognition (OCR) extraction for an uploaded vendor invoice returns an `extraction_confidence` score below the defined threshold (Kwan Hua's UC-04).

**Main Flow:**
1. The system creates a notification record linked to Chloe's user account.
2. A notification badge appears on Chloe's navigation bar.
3. Chloe clicks the notification bell and sees: "Manual review required - low confidence extraction for vendor invoice [Invoice Number] from [Vendor Name]."
4. Clicking the notification navigates Chloe directly to the AP review interface for that invoice (Kwan Hua's UC-06), with all low-confidence fields highlighted.
5. The notification is marked as read once Chloe opens the invoice.

**Edge Cases / Alternative Flows:**
- **Chloe receives a low-confidence alert but the extracted data is actually correct:** She reviews, confirms all fields are accurate, and approves without editing. The system logs this as a confirmed extraction with no corrections made.
- **Chloe does not act on the notification for an extended period:** The invoice remains in `pending_review` status and continues to appear flagged in the AP invoice queue, independent of whether the notification has been read.
