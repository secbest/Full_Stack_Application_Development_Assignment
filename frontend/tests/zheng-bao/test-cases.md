# Frontend Test Cases - Zheng Bao

_List all test cases below before submission. Include what is being tested and the expected outcome._

| # | Test File | What is Tested | Expected Outcome |
|---|-----------|---------------|-----------------|
| 1 | PublicIntakeFormPage.test.jsx | Submitting the public intake form completely blank | A "required" validation message is shown under every required field; `submitIntake` is never called |
| 2 | PublicIntakeFormPage.test.jsx | Contact phone number that is not exactly 8 digits | "Enter an 8-digit Singapore phone number" is shown; `submitIntake` is not called |
| 3 | PublicIntakeFormPage.test.jsx | Invalid email format, checked on blur | "Enter a valid email address" is shown; `submitIntake` is not called |
| 4 | PublicIntakeFormPage.test.jsx | Server responds with 409 `DUPLICATE_SUBMISSION` | The backend's message is shown as a form-level error and the form stays on screen |
| 5 | PublicIntakeFormPage.test.jsx | Server error response with no message body | Falls back to a generic "could not submit your request" message |
| 6 | PublicIntakeFormPage.test.jsx | Successful submission | Form is replaced by the "Request Received" confirmation screen showing the returned reference number |
| 7 | IntakeQueuePage.test.jsx | Typing in the search box | Table narrows to rows matching name, reference number, or organisation |
| 8 | IntakeQueuePage.test.jsx | Search term matching no submission | Table shows the "No intake submissions found." empty state |
| 9 | IntakeQueuePage.test.jsx | Clicking the "Rejected" status filter pill | Only rejected submissions remain visible in the table |
| 10 | IntakeQueuePage.test.jsx | Clicking "Reject Submission" with no rejection reason entered | Shows "Please enter a rejection reason"; no reject request is sent |
| 11 | IntakeQueuePage.test.jsx | Rejecting a submission with a reason filled in | Posts `{ rejection_reason }` to `/intake/:id/reject` and shows a success toast |
| 12 | IntakeQueuePage.test.jsx | Reject request fails (e.g. already actioned) | The backend's error message is shown in the toast |
| 13 | IntakeQueuePage.test.jsx | Initial `/intake` fetch fails | Shows a "Failed to load intake queue" error toast and an empty table |
| 14 | IntakeQueuePage.test.jsx | Row action visibility | Only rejected rows show a Delete action |
| 15 | IntakeQueuePage.test.jsx | Clicking Delete | Opens the app's own `ConfirmDialog` (not a browser `window.confirm`); Cancel closes it without calling the API and leaves the row in place |
| 16 | IntakeQueuePage.test.jsx | Confirming the delete dialog | Calls `DELETE /intake/:id` and shows a success toast |
| 17 | IntakeQueuePage.test.jsx | Delete request fails (e.g. not rejected) | The backend's error message is shown in the toast |
| 18 | BookingListPage.test.jsx | Row action visibility | Only Invoiced rows show a Delete action |
| 19 | BookingListPage.test.jsx | Clicking Delete | Opens the app's own `ConfirmDialog` naming the linked service memo/invoice/job milestones; Cancel closes it without calling the API |
| 20 | BookingListPage.test.jsx | Confirming the delete dialog | Calls `DELETE /bookings/:id` and shows a success notification |
| 21 | BookingListPage.test.jsx | Delete request fails (e.g. not invoiced) | The backend's error message is shown in the notification |
