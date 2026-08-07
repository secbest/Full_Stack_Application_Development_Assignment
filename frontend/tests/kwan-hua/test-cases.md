# Frontend Test Cases - Kwan Hua

_List all test cases below before submission. Include what is being tested and the expected outcome._

| # | Test File | What is Tested | Expected Outcome |
|---|-----------|---------------|-----------------|
| 1 | VendorInvoiceReviewPage.test.jsx | Add a manual line to an `extraction_failed` invoice | POSTs the new line, refreshes the invoice and shows it back in pending review |
| 2 | VendorInvoiceReviewPage.test.jsx | Delete an invoice line | Shows the in-app confirmation, DELETEs the line and refreshes recalculated approval state |
| 3 | VendorInvoiceListPage.test.jsx | OCR fails after the PDF has been saved | Shows a recovery warning and navigates directly to the saved invoice review page |
| 4 | VendorInvoiceListPage.test.jsx | Upload fails before an invoice is saved | Shows the server error and keeps the upload modal open for retry |
| 5 | VendorInvoiceReviewPage.test.jsx | Retry OCR with existing extracted/manual data | Requires destructive replacement confirmation and sends `confirm_replace: true` |
| 6 | VendorInvoiceReviewPage.test.jsx | Confirmed OCR retry fails | Shows preservation error and leaves current fields and line items visible |
