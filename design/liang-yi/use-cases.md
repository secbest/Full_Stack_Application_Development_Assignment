# Use Cases - Liang Yi

**Feature Area:** Field Operations & Executive Dashboard

> **Implementation note (2026-07-02):** Design below is authored by Liang Yi. Wave 2A code implementation (`service_memos`, `memo_signatures`, memo wizard, executive dashboard) is being carried out by Jasper - see `README.md` Task Allocation and `my-project-ai/Jasper/handoff-2026-07-02.md` for context.

---

## UC-01: Fill In Digital Field Memo

**Actor:** Field Crew

**Trigger:** A field crew member completes a job and needs to record the service details before leaving the site.

**Main Flow:**
1. The field crew member logs into the platform on a mobile device and navigates to their assigned job queue.
2. They locate the booking for the completed job and click "Create Memo".
3. The system presents the digital field memo form pre-filled with the booking details (client name, job date, location) to reduce manual entry.
4. The crew member fills in the remaining fields:
   - Job start time and end time
   - Overtime hours (mandatory if end time exceeds the standard shift by more than 30 minutes)
   - Evacuation floor count (mandatory - enter 0 if no evacuation occurred)
   - Patient name
   - Hospital destination
   - Additional charges or notes (optional)
5. The crew member reviews the entered data and proceeds to digital signature capture (UC-02).
6. After signature capture, they proceed to hospital stamp upload if required (UC-04), then submit the memo (UC-05).

**Edge Cases / Alternative Flows:**
- **The crew member cannot find their booking in the job queue:** The system provides a search field to locate a booking by reference number or client name. If the booking still cannot be found, the crew member contacts Camilla to verify the assignment.
- **The crew member starts filling the form but loses network connectivity mid-way:** The system caches the form data in the browser's local storage. When connectivity is restored, the saved draft is offered for resumption rather than starting over.
- **The booking linked to the memo has already been invoiced:** The system prevents a new memo from being created and displays: "A memo has already been submitted and invoiced for this booking. Contact AR if a correction is needed."

---

## UC-02: Capture Digital Signature

**Actor:** Field Crew / Patient or Client Representative (signer)

**Trigger:** The crew member has completed the field memo form (UC-01) and proceeds to capture the handover signature.

**Main Flow:**
1. The system presents a full-screen signature canvas optimised for touch input.
2. The patient or client representative draws their signature on the canvas using a finger or stylus.
3. The crew member reviews the captured signature for legibility.
4. If acceptable, they click "Confirm Signature".
5. The system encodes the signature as an image, uploads it to Cloudinary, and stores the returned URL in the `memo_signatures` table linked to the current memo draft.
6. The signer's name is recorded in the `signer_name` field alongside the signature.
7. The system returns to the memo review screen, indicating the signature has been captured successfully.

**Edge Cases / Alternative Flows:**
- **The signer makes an error and wants to redo the signature:** The crew member clicks "Clear" to reset the canvas. The signer can re-draw as many times as needed before confirming. No partial signature data is saved during this process.
- **The patient is unconscious or otherwise unable to sign:** The crew member selects "Signature Unavailable" and records the reason (e.g. "Patient unconscious - ICU transfer"). The system marks the signature field as waived with the reason logged. The memo can still proceed to submission.
- **The Cloudinary upload of the signature image fails:** The system retries once automatically. If the retry fails, the crew member is prompted to retry manually. The memo cannot be submitted without a confirmed signature or a documented waiver.
- **The signer disputes the signature after the fact:** The stored Cloudinary URL and `signed_at` timestamp provide an immutable audit record. The crew member cannot alter a confirmed signature - any dispute must be handled through an administrative correction process.

---

## UC-03: Validate Mandatory Revenue Fields

**Actor:** System (triggered on memo form submission attempt)

**Trigger:** The field crew member attempts to submit the memo form.

**Main Flow:**
1. The system runs validation across all memo fields before allowing submission to proceed.
2. Revenue-sensitive fields are validated with the following rules:
   - **Overtime hours:** Must be a non-negative number. If job end time exceeds the scheduled duration by more than 30 minutes, overtime hours cannot be zero without a reason note.
   - **Evacuation floor count:** Must be a non-negative integer. The field cannot be left blank - crew must explicitly enter 0 if no evacuation occurred.
   - **Job start time and end time:** Both required; end time must be after start time.
   - **Patient name and hospital destination:** Both required.
3. If all fields pass validation, the form proceeds to submission (UC-05).
4. If any field fails, the system highlights the failing field with an inline error message and scrolls to the first error. Submission is blocked until all errors are resolved.

**Edge Cases / Alternative Flows:**
- **Crew member enters overtime hours but leaves the job end time blank:** The system flags both the end time (required) and prompts the crew member to confirm the overtime entry is consistent with the job duration.
- **Crew member enters an evacuation floor count greater than a threshold (e.g. above 50):** The system shows a soft warning: "Unusually high floor count entered. Please confirm this is correct." The crew member can acknowledge and proceed - this is a warning, not a block, to account for genuinely tall buildings.
- **Crew member attempts to enter a negative number for overtime or floors:** The system immediately rejects the input with: "This field cannot be negative."

---

## UC-04: Upload Hospital Stamp Image

**Actor:** Field Crew

**Trigger:** The crew member is completing a memo for a job where the hospital requires a physical rubber stamp on the service record, and a photo of the stamped document must be attached.

**Main Flow:**
1. On the memo form, the crew member sees a "Hospital Stamp" section with an "Upload Photo" button.
2. They tap the button, which opens the device camera or file picker.
3. They photograph the stamped document or select an existing photo from their device.
4. The system uploads the image to Cloudinary and stores the returned secure URL in the `hospital_stamp_image_url` field on the `service_memos` record.
5. A thumbnail preview of the uploaded image is shown on the memo form for the crew member to verify legibility.
6. The memo can proceed to submission with or without a stamp image - this field is not mandatory, as not all hospitals require physical stamps.

**Edge Cases / Alternative Flows:**
- **The uploaded image is too dark or blurry to be legible:** The system cannot assess image quality automatically - this responsibility falls on the crew member. The form displays the thumbnail and asks: "Is the stamp clearly visible in this image?" If the crew member selects No, they are prompted to retake the photo.
- **The crew member uploads the wrong image (e.g. an unrelated photo):** They can tap "Remove" on the thumbnail to delete the uploaded image from Cloudinary and re-upload the correct one at any point before memo submission.
- **The hospital stamp upload fails due to a Cloudinary error:** The system retries once. If the retry fails, the crew member is shown an error and can proceed to submit the memo without the stamp image. The `hospital_stamp_image_url` field remains null and Sarah is notified during memo review (Jasper's UC-03) that the stamp is missing.

---

## UC-05: Submit Field Memo and Trigger AR Notification

**Actor:** Field Crew

**Trigger:** The field crew member has completed all mandatory fields, captured the signature, and is ready to finalise the memo.

**Main Flow:**
1. The crew member reaches the memo review screen, which summarises all entered data: job times, overtime hours, evacuation floors, patient details, captured signature thumbnail, and hospital stamp image (if uploaded).
2. They review the summary for accuracy.
3. They click "Submit Memo".
4. The system performs a final validation pass (UC-03). If validation passes, the `service_memos` record is saved with status `submitted`.
5. The linked `bookings` record status updates from `in_progress` to `completed`.
6. The system creates an in-app notification for Sarah (AR Specialist) indicating a new memo is ready for review (Zheng Bao's UC-09-B).
7. The crew member sees a success confirmation: "Memo submitted successfully. Reference: [Memo ID]."

**Edge Cases / Alternative Flows:**
- **The crew member submits the memo but the network drops at the moment of submission:** The system detects the failure and displays an error. The form data is preserved locally. The crew member can retry submission when connectivity is restored. The system checks for an existing memo record for this booking before creating a new one to prevent duplicates.
- **The crew member tries to submit a memo for a booking that already has a submitted memo:** The system blocks the submission with: "A memo has already been submitted for this booking. Contact AR if a correction is required." This prevents duplicate memos from generating duplicate invoices.
- **Sarah's notification fails to send (internal error):** The memo is still saved successfully. The notification failure is logged silently. Sarah's memo review queue is the fallback - the unreviewed memo will appear there regardless of whether the push notification was delivered.

---

## UC-06: View Fleet and Job Status Overview

**Actor:** Managing Director (Doris)

**Trigger:** Doris logs in to the executive dashboard or navigates to the Fleet Overview panel to check the current state of operations.

**Main Flow:**
1. Doris opens the executive dashboard.
2. The system displays the Fleet and Job Status Overview panel with the following real-time aggregated figures:
   - Total bookings today: broken down by status (`confirmed`, `in_progress`, `completed`, `invoiced`)
   - Number of active jobs currently in progress
   - Number of completed jobs pending memo submission (revenue leakage risk count)
   - Number of invoices synced to Xero in the current billing period
3. A status breakdown chart (e.g. stacked bar or pie chart using MUI X Charts) visually represents the booking status distribution.
4. Doris can filter the overview by date range (today, this week, this month, custom range).
5. Clicking on any status figure drills down to the filtered booking list (Zheng Bao's UC-07) showing only bookings in that status.

**Edge Cases / Alternative Flows:**
- **No bookings exist for the selected date range:** Each metric shows zero with an empty state chart. No error is raised.
- **There are a large number of completed bookings with no memo submitted:** The "Pending Memo" figure is highlighted in a warning colour to draw Doris's attention to the revenue risk. Clicking it navigates to the booking list filtered to `completed` status with no linked memo.
- **Doris selects a custom date range where the start date is after the end date:** The system prevents the invalid range and displays: "Start date must be before end date."

---

## UC-07: View Overhead Cost and Vendor Expense Summary

**Actor:** Managing Director (Doris)

**Trigger:** Doris navigates to the Overhead and Expenses panel on the executive dashboard to review operational costs for a given period.

**Main Flow:**
1. Doris opens the Overhead and Vendor Expense Summary panel.
2. The system aggregates all `approved` and `synced_to_xero` vendor invoices from the `vendor_invoices` table for the selected period and displays:
   - Total vendor expenditure for the period
   - Expenditure breakdown by vendor name (e.g. diesel supplier, repair workshop)
   - Total rebates applied across all invoices for the period
   - Net payable amount after rebates
3. A bar chart (MUI X Charts) shows vendor expenditure by vendor name, allowing Doris to identify the largest cost contributors at a glance.
4. A secondary line chart shows vendor spend over time (monthly trend) for the current financial year.
5. Doris can filter by vendor name, date range, or expense category.
6. Clicking a vendor bar in the chart drills down to the list of individual vendor invoices from that vendor.

**Edge Cases / Alternative Flows:**
- **No vendor invoices have been approved yet for the selected period:** The panel shows zero totals and empty charts with the message: "No approved vendor invoices found for this period."
- **A vendor invoice was rejected after initial approval (data correction):** Rejected invoices are excluded from the aggregation. The summary reflects only currently approved or synced invoices, so the figures always represent the committed expenditure.
- **Doris notices an unusually high spend from a single vendor:** She clicks the vendor bar to drill down to individual invoices. From there she can see the invoice details but cannot take any AP action - AP actions are restricted to Chloe. Doris's view is read-only.
- **The date range selected spans more than one financial year:** The system includes all invoices within the range regardless of year boundary. The trend chart adjusts its x-axis to accommodate the extended range.
