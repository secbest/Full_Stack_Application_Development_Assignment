# Test Cases - Liang Yi

**Feature Area:** Field Operations & Executive Dashboard

Derived from `design/liang-yi/use-cases.md` (UC-01 to UC-07) and `design/liang-yi/api-documentation.md`. Fill in Pass/Fail manually after executing each test.

---

## Backend Test Cases

| Test ID | Endpoint | Input / Action | Expected Outcome | Pass/Fail |
|---|---|---|---|---|
| TC-BE-001 | POST /api/service-memos/upload-signature | Field crew uploads a valid PNG/JPG signature file (<5MB) with valid token | `200 OK` with `signature_image_url` returned, no DB record created | |
| TC-BE-002 | POST /api/service-memos/upload-signature | Upload a file >5MB | `400 FILE_TOO_LARGE` | |
| TC-BE-003 | POST /api/service-memos/upload-signature | Upload a non-PNG/JPG file (e.g. PDF) | `400 INVALID_FILE_TYPE` | |
| TC-BE-004 | POST /api/service-memos/upload-signature | Request with no Authorization header | `401 UNAUTHORIZED` | |
| TC-BE-005 | POST /api/service-memos/upload-signature | Cloudinary upload fails (simulated outage) | `502 CLOUDINARY_UPLOAD_FAILED` | |
| TC-BE-006 | POST /api/service-memos/upload-hospital-stamp | Field crew uploads a valid PNG/JPG stamp photo (<10MB) with valid token | `200 OK` with `hospital_stamp_image_url` returned | |
| TC-BE-007 | POST /api/service-memos/upload-hospital-stamp | Upload a file >10MB | `400 FILE_TOO_LARGE` | |
| TC-BE-008 | POST /api/service-memos/upload-hospital-stamp | Upload a non-PNG/JPG file | `400 INVALID_FILE_TYPE` | |
| TC-BE-009 | POST /api/service-memos/upload-hospital-stamp | Request with no Authorization header | `401 UNAUTHORIZED` | |
| TC-BE-010 | POST /api/service-memos | Submit a complete valid memo with a confirmed signature (`is_waived: false`, `signature_image_url` present) | `201 Created`; memo status `submitted`; linked booking status updates `in_progress` -> `completed` | |
| TC-BE-011 | POST /api/service-memos | Submit a valid memo with a signature waiver (`is_waived: true`, `waiver_reason` present, `signature_image_url: null`) | `201 Created` | |
| TC-BE-012 | POST /api/service-memos | Submit a memo with neither a signature image nor a waiver reason | `400 SIGNATURE_REQUIRED` | |
| TC-BE-013 | POST /api/service-memos | Submit with `job_end_time` earlier than `job_start_time` | `400 INVALID_TIME_RANGE` | |
| TC-BE-014 | POST /api/service-memos | Submit with negative `overtime_hours` | `400 NEGATIVE_VALUE` | |
| TC-BE-015 | POST /api/service-memos | Submit with negative `evacuation_floors` | `400 NEGATIVE_VALUE` | |
| TC-BE-016 | POST /api/service-memos | Job duration exceeds standard shift by >30 min but `overtime_hours` is `0` with no note | `400 OVERTIME_INCONSISTENT` | |
| TC-BE-017 | POST /api/service-memos | Submit with `patient_name` or `hospital_destination` missing | `400 VALIDATION_ERROR` with `errors` array identifying the failing field | |
| TC-BE-018 | POST /api/service-memos | Submit with a `booking_id` that doesn't exist or isn't assigned to this crew member | `404 BOOKING_NOT_FOUND` | |
| TC-BE-019 | POST /api/service-memos | Submit a second memo for a `booking_id` that already has a submitted memo | `409 MEMO_ALREADY_EXISTS` | |
| TC-BE-020 | POST /api/service-memos | Submit a memo for a booking that has already been invoiced | `409 BOOKING_ALREADY_INVOICED` | |
| TC-BE-021 | POST /api/service-memos | Request made with a role other than `field_crew`/`managing_director` (e.g. `ap_specialist`) | `403 FORBIDDEN` | |
| TC-BE-022 | POST /api/service-memos | Request with no Authorization header | `401 UNAUTHORIZED` | |
| TC-BE-023 | POST /api/service-memos | Submit with `evacuation_floors: 0` explicitly (no evacuation occurred) | `201 Created` - zero is a valid explicit value | |
| TC-BE-024 | GET /api/service-memos | AR Specialist requests list with no filters | `200 OK` with paginated `data` array and `pagination` object | |
| TC-BE-025 | GET /api/service-memos | Field crew requests list filtered by `submitted_by` set to another user's ID | Request is scoped/rejected - field crew may only filter by their own ID | |
| TC-BE-026 | GET /api/service-memos | Request with `status=submitted` | `200 OK` with only `submitted` memos returned | |
| TC-BE-027 | GET /api/service-memos | Request with `date_from` after `date_to` | `400 INVALID_DATE_RANGE` | |
| TC-BE-028 | GET /api/service-memos | Request with `limit=500` | Result capped at max `100` per page | |
| TC-BE-029 | GET /api/service-memos | Request with no Authorization header | `401 UNAUTHORIZED` | |
| TC-BE-030 | GET /api/service-memos/:id | AR Specialist requests an existing memo ID | `200 OK` with full memo detail including `signatures` array | |
| TC-BE-031 | GET /api/service-memos/:id | Request a non-existent memo ID | `404 NOT_FOUND` | |
| TC-BE-032 | GET /api/service-memos/:id | Field crew requests a memo submitted by a different crew member | `403 FORBIDDEN` | |
| TC-BE-033 | GET /api/service-memos/:id | Request with missing/invalid token | `401 UNAUTHORIZED` | |
| TC-BE-034 | GET /api/dashboard/fleet-overview | Managing Director requests with default `period` (today) | `200 OK` with `totals`, `booking_status_breakdown`, `revenue_risk` | |
| TC-BE-035 | GET /api/dashboard/fleet-overview | Request with `period=this_week` | `200 OK` with figures aggregated over the current week | |
| TC-BE-036 | GET /api/dashboard/fleet-overview | Request with `period=invalid_value` | `400 INVALID_PERIOD` | |
| TC-BE-037 | GET /api/dashboard/fleet-overview | Request with `date_from` after `date_to` | `400 INVALID_DATE_RANGE` | |
| TC-BE-038 | GET /api/dashboard/fleet-overview | No bookings exist for the selected range | `200 OK` with all totals at zero, `revenue_risk.warning: false` | |
| TC-BE-039 | GET /api/dashboard/fleet-overview | Range includes completed bookings with no linked memo | `revenue_risk.completed_without_memo > 0` and `revenue_risk.warning: true` | |
| TC-BE-040 | GET /api/dashboard/fleet-overview | Request made by a non-`managing_director` role | `403 FORBIDDEN` | |
| TC-BE-041 | GET /api/dashboard/fleet-overview | Request with no Authorization header | `401 UNAUTHORIZED` | |
| TC-BE-042 | GET /api/dashboard/vendor-expenses | Managing Director requests with default date range | `200 OK` with `summary`, `by_vendor` (sorted descending by expenditure), `monthly_trend` | |
| TC-BE-043 | GET /api/dashboard/vendor-expenses | Request with `vendor_name` partial match filter | `200 OK` with only matching vendor(s) in `by_vendor` | |
| TC-BE-044 | GET /api/dashboard/vendor-expenses | Request with `date_from` after `date_to` | `400 INVALID_DATE_RANGE` | |
| TC-BE-045 | GET /api/dashboard/vendor-expenses | No `approved`/`synced_to_xero` vendor invoices exist for the range | `200 OK` with zero totals and empty `by_vendor`/`monthly_trend` arrays | |
| TC-BE-046 | GET /api/dashboard/vendor-expenses | A previously approved vendor invoice was later rejected | Rejected invoice excluded from aggregation; totals reflect only currently approved/synced invoices | |
| TC-BE-047 | GET /api/dashboard/vendor-expenses | Request made by a non-`managing_director` role | `403 FORBIDDEN` | |
| TC-BE-048 | GET /api/dashboard/vendor-expenses | Request with no Authorization header | `401 UNAUTHORIZED` | |

---

## Frontend Test Cases

| Test ID | Flow | Input / Action | Expected Outcome | Pass/Fail |
|---|---|---|---|---|
| TC-FE-001 | UC-01: Fill In Digital Field Memo | Field crew clicks "Start Job & Create Memo" on a job in My Jobs | Memo Wizard Step 1 opens pre-filled with client name, job date, and location (locked/read-only) | |
| TC-FE-002 | UC-01: Fill In Digital Field Memo | Crew searches job queue by booking reference number or client name | Matching booking is shown | |
| TC-FE-003 | UC-01: Fill In Digital Field Memo | Crew searches for a booking that doesn't exist in their queue | Empty-result state shown, prompting crew to contact Camilla | |
| TC-FE-004 | UC-01: Fill In Digital Field Memo | Crew is filling Step 1 and loses network connectivity | Form data is cached to browser local storage | |
| TC-FE-005 | UC-01: Fill In Digital Field Memo | Crew reopens the memo after connectivity is restored | Saved draft is offered for resumption instead of a blank form | |
| TC-FE-006 | UC-01: Fill In Digital Field Memo | Crew attempts to create a memo for a booking that has already been invoiced | Blocked with message: "A memo has already been submitted and invoiced for this booking. Contact AR if a correction is needed." | |
| TC-FE-007 | UC-02: Capture Digital Signature | Signer draws on the canvas and crew clicks "Confirm Signature" | Signature uploads successfully; memo review screen shows the signature thumbnail | |
| TC-FE-008 | UC-02: Capture Digital Signature | Crew clicks "Clear" mid-signature | Canvas resets; no partial signature data is saved | |
| TC-FE-009 | UC-02: Capture Digital Signature | Crew selects "Signature Unavailable" and enters a waiver reason (e.g. "Patient unconscious") | Signature field marked as waived with reason logged; memo can proceed to submission | |
| TC-FE-010 | UC-02: Capture Digital Signature | Crew selects "Signature Unavailable" but leaves the reason blank | Validation blocks proceeding until a reason is entered | |
| TC-FE-011 | UC-02: Capture Digital Signature | Signature upload to Cloudinary fails on first attempt | System automatically retries the upload once | |
| TC-FE-012 | UC-02: Capture Digital Signature | Signature upload fails again after automatic retry | Crew is prompted to retry manually; submission is blocked until a confirmed signature or waiver exists | |
| TC-FE-013 | UC-03: Validate Mandatory Revenue Fields | Crew leaves `evacuation_floors` blank and attempts to proceed | Inline error shown; form scrolls to the field; submission blocked | |
| TC-FE-014 | UC-03: Validate Mandatory Revenue Fields | Crew explicitly enters `evacuation_floors: 0` | Accepted with no error | |
| TC-FE-015 | UC-03: Validate Mandatory Revenue Fields | Crew enters `evacuation_floors` above 50 | Soft warning shown: "Unusually high floor count entered. Please confirm this is correct." Crew can acknowledge and proceed | |
| TC-FE-016 | UC-03: Validate Mandatory Revenue Fields | Crew enters a negative value for `overtime_hours` or `evacuation_floors` | Input immediately rejected with "This field cannot be negative." | |
| TC-FE-017 | UC-03: Validate Mandatory Revenue Fields | Job duration implies overtime but `overtime_hours` is left at `0` with no note | Crew is prompted to add a note or correct the hours before proceeding | |
| TC-FE-018 | UC-03: Validate Mandatory Revenue Fields | Crew leaves job start or end time blank | Required-field error shown; form scrolls to first error | |
| TC-FE-019 | UC-03: Validate Mandatory Revenue Fields | Crew leaves `patient_name` or `hospital_destination` blank | Required-field error shown on the relevant field(s) | |
| TC-FE-020 | UC-04: Upload Hospital Stamp Image | Crew uploads a valid stamp photo via camera or file picker | Thumbnail preview shown; `hospital_stamp_image_url` populated | |
| TC-FE-021 | UC-04: Upload Hospital Stamp Image | Crew proceeds through the wizard without uploading a stamp | Submission allowed; `hospital_stamp_image_url` remains null | |
| TC-FE-022 | UC-04: Upload Hospital Stamp Image | Crew answers "No" to "Is the stamp clearly visible in this image?" | Crew is prompted to retake the photo | |
| TC-FE-023 | UC-04: Upload Hospital Stamp Image | Crew taps "Remove" on an uploaded stamp thumbnail | Image is deleted; crew can re-upload a new photo before submission | |
| TC-FE-024 | UC-04: Upload Hospital Stamp Image | Stamp upload fails and the automatic retry also fails | Error shown; crew can still proceed to submit the memo without the stamp | |
| TC-FE-025 | UC-05: Submit Field Memo | Crew reaches the memo review/summary screen | All entered data displayed accurately: job times, overtime, evacuation floors, patient details, signature thumbnail, stamp image | |
| TC-FE-026 | UC-05: Submit Field Memo | Crew clicks "Submit Memo" with all valid data | Success confirmation shown: "Memo submitted successfully. Reference: [Memo ID]." | |
| TC-FE-027 | UC-05: Submit Field Memo | Network drops at the moment of submission | Error displayed; form data preserved locally; retry does not create a duplicate memo | |
| TC-FE-028 | UC-05: Submit Field Memo | Crew attempts to submit a second memo for a booking that already has one submitted | Blocked with message: "A memo has already been submitted for this booking. Contact AR if a correction is required." | |
| TC-FE-029 | UC-05: Submit Field Memo | Memo submission succeeds | Linked booking status updates from `in_progress` to `completed`, reflected in My Jobs | |
| TC-FE-030 | UC-05: Submit Field Memo | Memo submission succeeds | In-app notification is queued for Sarah; memo appears in her review queue regardless of notification delivery | |
| TC-FE-031 | UC-06: View Fleet and Job Status Overview | Doris (MD) opens the Executive Dashboard | Fleet Overview panel loads with totals (bookings, active jobs, pending memo, invoices synced) and a status breakdown chart | |
| TC-FE-032 | UC-06: View Fleet and Job Status Overview | Doris filters by date range (today/this week/this month/custom) | Figures and chart update to reflect the selected range | |
| TC-FE-033 | UC-06: View Fleet and Job Status Overview | Doris selects a custom range where start date is after end date | Error shown: "Start date must be before end date." | |
| TC-FE-034 | UC-06: View Fleet and Job Status Overview | No bookings exist for the selected range | All metrics show zero with an empty-state chart; no error raised | |
| TC-FE-035 | UC-06: View Fleet and Job Status Overview | Pending Memo count is greater than zero | Figure is highlighted in a warning colour | |
| TC-FE-036 | UC-06: View Fleet and Job Status Overview | Doris clicks the "Pending Memo" figure | Navigates to booking list filtered to `completed` status with no linked memo | |
| TC-FE-037 | UC-06: View Fleet and Job Status Overview | Doris clicks any other status figure (e.g. `in_progress`) | Navigates to booking list filtered to that status | |
| TC-FE-038 | UC-07: View Overhead Cost and Vendor Expense Summary | Doris opens the Overhead and Vendor Expense Summary panel | Total expenditure, breakdown by vendor, total rebates, and net payable are displayed | |
| TC-FE-039 | UC-07: View Overhead Cost and Vendor Expense Summary | Doris views the vendor expenditure bar chart | Largest cost contributor is shown first/most prominently | |
| TC-FE-040 | UC-07: View Overhead Cost and Vendor Expense Summary | Doris views the monthly spend trend line chart for the current financial year | Chart matches the `monthly_trend` data for the period | |
| TC-FE-041 | UC-07: View Overhead Cost and Vendor Expense Summary | Doris filters by vendor name, date range, or expense category | Panel and charts update to the filtered scope | |
| TC-FE-042 | UC-07: View Overhead Cost and Vendor Expense Summary | No vendor invoices have been approved for the selected period | Zero totals and empty charts shown with message: "No approved vendor invoices found for this period." | |
| TC-FE-043 | UC-07: View Overhead Cost and Vendor Expense Summary | Doris clicks a vendor bar in the chart | Drills down to the list of individual invoices for that vendor | |
| TC-FE-044 | UC-07: View Overhead Cost and Vendor Expense Summary | Doris opens an invoice from the drill-down view | Invoice detail is read-only; no AP action buttons (approve/reject) are shown | |
| TC-FE-045 | UC-07: View Overhead Cost and Vendor Expense Summary | Selected date range spans more than one financial year | All invoices within the range are included; trend chart x-axis adjusts to the extended range | |
