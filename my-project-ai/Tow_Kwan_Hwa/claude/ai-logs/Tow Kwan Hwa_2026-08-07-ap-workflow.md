# Session Log - 2026-08-07 - AP Workflow, Gmail Intake, OCR, and Xero Recovery

**Student:** Kwan Hua  
**AI tool:** Codex  
**Phases:** Coding, testing, integration, and live configuration diagnosis

## Task 1: Improve the AP workflow and automatic invoice intake

**Prompts / direction:**
> do all the necessary fixies and report them

> do the main feature

> can you do the automatic intake for me

> gmail

**AI output/actions:**

- Audited the AP vendor-invoice flow and implemented recoverable OCR failure handling, editable
  line items/headers, AP validation controls, Xero retry support, and audit-safe updates.
- Added generic provider-based inbound email intake and Gmail API intake. Gmail imports PDF
  attachments from messages labelled `EFAR AP Invoices`, deduplicates by source message and
  attachment, and marks completed messages `EFAR AP Processed`.
- Added the Gmail intake UI, Managing Director connection access, status/error display, and
  documented environment variables and migrations in `docs/AP_INBOUND_EMAIL_INTAKE.md`.
- Added/updated tests, committed the work on `feature/ap-workflow-improvements`, then merged it
  into `main` without conflicts.

**Outcome:** Accepted. The user continued testing the new Gmail and AP flows in the browser.

## Task 2: Diagnose Gmail OAuth and invoice-import problems

**Prompts / direction:**
> I dont see the gmail ap intake card

> [gmail/callback] failed: The provided client secret is invalid.

> it says theres not pdf even though I already sent one to myself

**AI output/actions:**

- Identified role-based visibility and corrected Managing Director access to the Vendor Invoice
  list/Gmail intake card.
- Explained Google OAuth testing access: the personal Gmail account must be listed as a Google
  OAuth test user until verification is complete.
- Diagnosed the invalid client-secret response as configuration mismatch and directed the user to
  replace `GOOGLE_GMAIL_CLIENT_SECRET`, restart the backend, and reconnect Gmail.
- Confirmed Gmail intake requires the `EFAR AP Invoices` label and PDF attachment; import and
  polling only act on labelled eligible messages.

**Outcome:** Accepted. The user connected/testing their personal Gmail inbox. Credentials were not
  written to source control or this log.

## Task 3: Repair OCR extraction and AP GST validation

**Prompt / direction:**
> now Another issue is that the ocr can retrive the information properly

**AI output/actions:**

- Migrated OCR from the retired Gemini SDK/model path to `@google/genai` with a configurable
  current model.
- Tested the supplied vendor PDF and identified a specific discrepancy: the OCR captured subtotal
  `1343.00` and total `1463.87` but produced GST `0.00`.
- Added a guarded GST recovery rule: when subtotal/total differ by exactly 7%, 8%, or 9%, infer the
  missing GST, record the percentage, and require low-confidence source-document confirmation.
- Added regression tests using the Central Medical amounts. Backend suite passed: 43 suites, 468
  tests.

**Outcome:** Accepted. The user was given the correct one-off review steps: select Standard-rated,
enter the supplier GST number from the PDF, and save before approval.

## Task 4: Fix AP approval database error

**Prompt / direction:**
> [screenshot showing] FOR UPDATE cannot be applied to the nullable side of an outer join

**AI output/actions:**

- Traced the error to the AP approval query combining a PostgreSQL row lock with an optional
  `VendorInvoiceItem` outer join.
- Changed the transaction lock to target only the parent `VendorInvoice` row. This preserves the
  protection against double approval/Xero duplicate bills while avoiding PostgreSQL's invalid
  outer-join lock.
- Updated the unit test and reran the full backend suite successfully.

**Outcome:** Accepted. Fix committed and pushed as `07d283b`.

## Task 5: Diagnose Xero currency sync rejection

**Prompt / direction:**
> [screenshot showing] Organisation is not subscribed to currency SGD

**AI output/actions:**

- Confirmed the error originated from Xero rather than EFAR's invoice validation.
- Determined the connected organisation needs SGD as its base currency or multicurrency enabled
  with SGD added. The application deliberately does not rewrite a Singapore invoice into another
  currency merely to make a sync pass.
- Directed the user to fix Xero organisation settings, then retry the retained failed sync from
  Xero Sync Status.

**Outcome:** Accepted as a configuration follow-up. No code was changed because the correction is
in the external Xero organisation.

## Integration Record

- AP feature branch merged into `main` without conflicts: `1d333ea`.
- Post-merge test-harness fix: `87918fc`.
- OCR GST recovery: `e47f26b`.
- PostgreSQL approval-lock fix: `07d283b`.
- Final repository state at log time: `main` synchronized with `origin/main`.

## Decision Notes

- Kept human confirmation for inferred GST. Arithmetic can repair an OCR omission, but it cannot
  prove the source document's tax treatment.
- Kept the actual SGD currency in the Xero payload. Changing currency in application code would
  conceal an external accounting configuration problem and produce an incorrect bill.
- Did not draft the separate `ai-reflection.md`; the submission guide requires that reflection to
  be written personally by the student.

