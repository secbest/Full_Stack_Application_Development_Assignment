# Frontend Test Cases - Kwan Hua

_List all test cases below before submission. Include what is being tested and the expected outcome._

| # | Test File | What is Tested | Expected Outcome |
|---|-----------|---------------|-----------------|
| 1 | VendorInvoiceReviewPage.test.jsx | Add a manual line to an `extraction_failed` invoice | POSTs the new line, refreshes the invoice and shows it back in pending review |
| 2 | VendorInvoiceReviewPage.test.jsx | Delete an invoice line | Shows the in-app confirmation, DELETEs the line and refreshes recalculated approval state |
