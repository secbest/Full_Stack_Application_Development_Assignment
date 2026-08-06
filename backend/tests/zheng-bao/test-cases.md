# Backend Test Cases - Zheng Bao

_List all test cases below before submission. Include what is being tested and the expected outcome._

| # | Test File | What is Tested | Expected Outcome |
|---|-----------|---------------|-----------------|
| 1 | intakeController.test.js | `createIntake` rejects a second submission with the same email/date/pickup within 10 minutes | Returns 409 with code `DUPLICATE_SUBMISSION`; no new `IntakeSubmission` row is created |
| 2 | intakeController.test.js | `createIntake` allows a submission through when no recent duplicate exists | Returns 201 and creates the `IntakeSubmission` |
| 3 | intakeController.test.js | `createIntake` derives the next reference number from the highest existing `reference_number` suffix rather than the row id | The new reference number continues from the last used suffix (e.g. `...00010` -> `...00011`), even when a seeded id/reference gap exists |
| 4 | intakeController.test.js | `createIntake` reference numbering with no prior `EFAR-2026` rows | Starts at `EFAR-2026-00001` |
| 5 | intakeController.test.js | `createIntake` with a required field missing | Returns 400 with code `VALIDATION_ERROR`; no row is created |
| 6 | intakeController.test.js | `createIntake` with a contact phone that is not exactly 8 digits | Returns 400; no row is created |
| 7 | intakeController.test.js | `listIntakes` with `status`/`service_type`/`search`/`page`/`limit` query params | Query filters are applied to the Sequelize `where` clause and the response `meta` reflects the requested page/limit/total |
| 8 | intakeController.test.js | `listIntakes` with no query params | Defaults to `status: 'pending'`, page 1, offset 0 |
| 9 | intakeController.test.js | `getIntakeById` with a non-existent id | Returns 404 |
| 10 | intakeController.test.js | `confirmIntake` on an intake that is no longer `pending` | Returns 409 with code `ALREADY_ACTIONED`; no `Booking` is created |
| 11 | intakeController.test.js | `confirmIntake` with `service_tier` missing from the request body | Returns 400 with code `VALIDATION_ERROR`; no `Booking` is created |
| 12 | intakeController.test.js | `confirmIntake` for a contact email that already has a `Client` record | Reuses the existing `Client` via `findOrCreate` instead of creating a duplicate; the new `Booking` links to that client |
| 13 | intakeController.test.js | `confirmIntake` when the customer never selected a service tier | `original_service_tier` on the new `Booking` is `null` |
| 14 | intakeController.test.js | `confirmIntake` when quotations overrides a pre-existing customer-selected tier | `original_service_tier` on the new `Booking` preserves the customer's original tier |
| 15 | intakeController.test.js | `rejectIntake` on an intake that is no longer `pending` | Returns 409 with code `ALREADY_ACTIONED` |
| 16 | intakeController.test.js | `rejectIntake` with `rejection_reason` missing | Returns 400 with code `VALIDATION_ERROR` |
| 17 | intakeController.test.js | `rejectIntake` with a valid reason | Intake is updated to `status: 'rejected'` with the reviewer id, timestamp, and reason recorded |
| 18 | intakeController.test.js | `deleteIntake` with a non-existent id | Returns 404 |
| 19 | intakeController.test.js | `deleteIntake` on a `pending` submission | Returns 409 with code `INTAKE_NOT_REJECTED`; the row is not deleted |
| 20 | intakeController.test.js | `deleteIntake` on a `confirmed` submission | Returns 409 with code `INTAKE_NOT_REJECTED`; the row is not deleted (it already has a linked `Booking`) |
| 21 | intakeController.test.js | `deleteIntake` on a `rejected` submission | The row is destroyed and the response echoes its id/reference number |
| 22 | bookingController.test.js | `deleteBooking` with a non-existent id | Returns 404 |
| 23 | bookingController.test.js | `deleteBooking` on a `confirmed` booking | Returns 409 with code `BOOKING_NOT_INVOICED`; the row is not deleted |
| 24 | bookingController.test.js | `deleteBooking` on an `in_progress` booking | Returns 409 with code `BOOKING_NOT_INVOICED` |
| 25 | bookingController.test.js | `deleteBooking` on an `invoiced` booking with no linked `Invoice` row (edge case) | Deletes the `Booking`, `ServiceMemo`, and `JobMilestone` rows without erroring on the missing invoice |
| 26 | bookingController.test.js | `deleteBooking` on an `invoiced` booking with a linked `Invoice` | Deletes the invoice's line items, the `Invoice`, the `ServiceMemo`, the `JobMilestone` rows, and the `Booking` itself in one transaction; `XeroSyncLog` rows are left untouched |
