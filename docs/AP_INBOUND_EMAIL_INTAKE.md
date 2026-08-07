# AP automatic vendor-invoice intake

Vendor invoices can enter the AP review queue without a staff member uploading them.
Forward vendor email with one or more PDF attachments to the AP mailbox, then configure its inbound-email provider to POST those attachments to the platform.

## Required configuration

Set these server environment variables:

```env
AP_INBOUND_EMAIL_ADDRESS=vendor-invoices@efar.com.sg
AP_INBOUND_EMAIL_SECRET=<long-random-secret>
AP_INBOUND_UPLOADED_BY=<optional-ap-specialist-user-id>
```

`AP_INBOUND_UPLOADED_BY` is optional. Without it, the platform uses the first AP Specialist account as the intake owner.

Run `npm run db:migrate:ap-inbound-email` after deployment so the `inbound_email_id` idempotency column and index are created. This migration is safe to run more than once.

## Provider request contract

Configure the provider's inbound-parse rule to send a `POST` request to:

```text
https://<api-host>/api/vendor-invoices/inbound-email
```

Use `multipart/form-data` with:

| Field/header | Value |
|---|---|
| `attachments` | One or more PDF attachment files; maximum 10 MB each |
| `message_id` | Stable provider message identifier |
| `X-AP-Inbound-Secret` | Value of `AP_INBOUND_EMAIL_SECRET` |
| `rebate_percentage` | Optional; defaults to `1.00` |

The message id plus attachment number prevents a provider retry from creating another AP invoice. Each attachment is stored, OCR-processed, rebate-checked, and sent to the existing manual review queue. An OCR failure still creates a recoverable `extraction_failed` invoice.

Only the forwarding address is shown to staff in Vendor Invoices. The webhook secret stays server-side.

## Gmail API option

For a personal Gmail inbox, use the Gmail card in Vendor Invoices instead of the forwarding webhook. Configure the `GOOGLE_GMAIL_*` values, run `npm run db:migrate:gmail-intake`, then sign in as the Managing Director and select **Connect Gmail**. Apply the `EFAR AP Invoices` label to a PDF invoice email and select **Import Gmail** to test. The server subsequently polls that labelled queue every five minutes and adds `EFAR AP Processed` only after successful intake.
