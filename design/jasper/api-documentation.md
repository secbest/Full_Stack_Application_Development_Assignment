# API Documentation - Jasper

**Feature Area:** AR Billing, Pricing Engine & Invoice Sync

All endpoints are prefixed with `/api`. All endpoints require a valid JWT in the `Authorization: Bearer <token>` header unless stated otherwise.

**Response envelope (updated to match the implemented shape, used consistently by every controller across the whole app, not just this feature):**

Success responses wrap the payload in `{ success: true, data: <payload> }`:
```json
{ "success": true, "data": { "id": 1, "...": "..." } }
```

Error responses use `code` (not `error`) for the machine-readable identifier, plus `success: false`:
```json
{ "success": false, "code": "ERROR_CODE", "message": "Human-readable description" }
```

The JSON examples throughout the sections below show only the contents of the `data` field for brevity - wrap them in `{ "success": true, "data": { ...shown... } }` to get the real response. Where a section documents an error code (e.g. `CONTRACT_OVERLAP`), the actual field name for that code in the response is `code`, matching the shape above.

---

## Table of Contents

1. [Pricing Contracts](#1-pricing-contracts)
2. [Pricing Rates](#2-pricing-rates)
3. [Surcharge Schedules](#3-surcharge-schedules)
4. [Memo Review Queue](#4-memo-review-queue)
5. [Invoices](#5-invoices)
6. [Invoice Line Items](#6-invoice-line-items)
7. [Revenue Leakage Report](#7-revenue-leakage-report)
8. [AR Dashboard - DROPPED](#8-ar-dashboard---dropped)
9. [Xero Bank Feed - DROPPED](#9-xero-bank-feed---dropped)
10. [Dev Auth Reference](#10-dev-auth-reference)

---

## 1. Pricing Contracts

### `GET /api/contracts`

**Purpose:** List all pricing contracts. Supports filtering by client and active status. Used by Sarah to manage the contract list (UC-01, UC-02).

**Auth required:** Yes

**Allowed roles:** `ar_specialist`, `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `client_id` | integer | No | Filter by client |
| `is_active` | boolean | No | `true` returns only active contracts |
| `page` | integer | No | Page number, default `1` |
| `limit` | integer | No | Records per page, default `20` |

**Success response `200`:**
```json
{
  "data": [
    {
      "id": 1,
      "client_id": 1,
      "client_name": "Tan Tock Seng Hospital",
      "contract_name": "Tan Tock Seng Hospital - FY2026 Service Agreement",
      "effective_from": "2026-01-01",
      "effective_to": "2026-12-31",
      "is_active": true,
      "created_by": 1,
      "created_at": "2026-01-01T08:00:00.000Z"
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20 }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `POST /api/contracts`

**Purpose:** Create a new pricing contract for a client, including its initial rate rows and surcharge schedule (UC-01).

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body:**
```json
{
  "client_id": 1,
  "contract_name": "Tan Tock Seng Hospital - FY2026 Service Agreement",
  "effective_from": "2026-01-01",
  "effective_to": "2026-12-31",
  "rates": [
    {
      "service_type": "eas",
      "transfer_type": "one_way_hospital",
      "time_of_day": "office_hours",
      "base_amount": 850.00
    }
  ],
  "surcharges": [
    { "surcharge_type": "oxygen_base",   "amount": 50.00 },
    { "surcharge_type": "resuscitation", "amount": 320.00 }
  ]
}
```

**Success response `201`:**
```json
{
  "data": {
    "id": 4,
    "client_id": 1,
    "contract_name": "Tan Tock Seng Hospital - FY2026 Service Agreement",
    "effective_from": "2026-01-01",
    "effective_to": "2026-12-31",
    "is_active": true,
    "rates": [ { "id": 18, "service_type": "eas", "transfer_type": "one_way_hospital", "time_of_day": "office_hours", "base_amount": "850.00" } ],
    "surcharges": [
      { "id": 25, "surcharge_type": "oxygen_base", "amount": "50.00" },
      { "id": 26, "surcharge_type": "resuscitation", "amount": "320.00" }
    ],
    "created_at": "2026-06-22T10:00:00.000Z"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | Missing required fields or invalid ENUM values |
| `409` | `CONTRACT_OVERLAP` | An active contract already exists for this client covering the same date range |
| `404` | `CLIENT_NOT_FOUND` | `client_id` does not exist |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `GET /api/contracts/:id`

**Purpose:** Retrieve a single contract with all its rate rows and surcharge schedule.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`, `managing_director`

**Success response `200`:**
```json
{
  "data": {
    "id": 1,
    "client_id": 1,
    "client_name": "Tan Tock Seng Hospital",
    "contract_name": "Tan Tock Seng Hospital - FY2026 Service Agreement",
    "effective_from": "2026-01-01",
    "effective_to": "2026-12-31",
    "is_active": true,
    "rates": [
      { "id": 1, "service_type": "eas", "transfer_type": "one_way_hospital", "time_of_day": "office_hours", "base_amount": "850.00" },
      { "id": 2, "service_type": "eas", "transfer_type": "one_way_hospital", "time_of_day": "non_office_hours", "base_amount": "950.00" }
    ],
    "surcharges": [
      { "id": 1, "surcharge_type": "oxygen_base", "amount": "50.00" },
      { "id": 5, "surcharge_type": "resuscitation", "amount": "320.00" }
    ],
    "matched_invoice_count": 12
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `CONTRACT_NOT_FOUND` | No contract with this id |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `PATCH /api/contracts/:id`

**Purpose:** Update a contract's name, effective dates, or active status. Rate and surcharge changes are handled by their own endpoints (sections 2 and 3). Used for renegotiations and end-dating (UC-02).

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body** (all fields optional, send only those being changed):
```json
{
  "contract_name": "Tan Tock Seng Hospital - FY2026 Service Agreement (Revised)",
  "effective_to": "2026-09-30",
  "is_active": false
}
```

**Success response `200`:**
```json
{
  "data": {
    "id": 1,
    "contract_name": "Tan Tock Seng Hospital - FY2026 Service Agreement (Revised)",
    "effective_from": "2026-01-01",
    "effective_to": "2026-09-30",
    "is_active": false,
    "updated_at": "2026-06-22T11:00:00.000Z"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | `effective_to` is before `effective_from` |
| `400` | `HAS_MATCHED_INVOICES` | Contract has matched invoices - response includes count so Sarah can acknowledge |
| `404` | `CONTRACT_NOT_FOUND` | No contract with this id |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

## 2. Pricing Rates

### `POST /api/contracts/:contractId/rates`

**Purpose:** Add a new rate row to an existing contract.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body:**
```json
{
  "service_type": "mts",
  "transfer_type": "sg_jb_ground",
  "time_of_day": "all_hours",
  "base_amount": 1800.00
}
```

**Success response `201`:**
```json
{
  "data": { "id": 15, "contract_id": 1, "service_type": "mts", "transfer_type": "sg_jb_ground", "time_of_day": "all_hours", "base_amount": "1800.00" }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | Invalid ENUM value or missing field |
| `409` | `RATE_DUPLICATE` | A row with the same `service_type`, `transfer_type`, and `time_of_day` already exists on this contract |
| `404` | `CONTRACT_NOT_FOUND` | No contract with this id |

---

### `PUT /api/contracts/:contractId/rates/:rateId`

**Purpose:** Update the `base_amount` on an existing rate row.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body:**
```json
{ "base_amount": 1900.00 }
```

**Success response `200`:**
```json
{
  "data": { "id": 15, "contract_id": 1, "service_type": "mts", "transfer_type": "sg_jb_ground", "time_of_day": "all_hours", "base_amount": "1900.00" }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | `base_amount` is missing or not a positive number |
| `404` | `RATE_NOT_FOUND` | No rate row with this id on this contract |

---

### `DELETE /api/contracts/:contractId/rates/:rateId`

**Purpose:** Remove a rate row from a contract. Only allowed if no invoices have been matched against this rate.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Success response `200`:**
```json
{ "message": "Rate row deleted." }
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `409` | `RATE_IN_USE` | Invoices have been matched using this rate - deletion blocked to preserve audit trail |
| `404` | `RATE_NOT_FOUND` | No rate row with this id on this contract |

---

## 3. Surcharge Schedules

### `PUT /api/contracts/:contractId/surcharges/:surchargeId`

**Purpose:** Update the `amount` for a specific surcharge type on a contract. Surcharge rows are created with the contract (via `POST /api/contracts`) and are updated individually here.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body:**
```json
{ "amount": 350.00 }
```

**Success response `200`:**
```json
{
  "data": { "id": 5, "contract_id": 1, "surcharge_type": "resuscitation", "amount": "350.00" }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | `amount` is missing or negative |
| `404` | `SURCHARGE_NOT_FOUND` | No surcharge row with this id on this contract |

---

## 4. Memo Review Queue

These endpoints read from `service_memos` (Liang Yi's table). Jasper's routes query it read-only; only the `status` and `ar_note` fields are written by Jasper's endpoints.

### `GET /api/service-memos/pending-review`

**Purpose:** List all submitted service memos awaiting AR review (UC-03). Returns memos with status `submitted` that have no linked invoice yet.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | integer | No | Default `1` |
| `limit` | integer | No | Default `20` |

**Success response `200`:**
```json
{
  "data": [
    {
      "id": 7,
      "booking_id": 7,
      "booking_reference": "BKG-2026-00007",
      "client_name": "Tan Tock Seng Hospital",
      "job_date": "2026-06-20",
      "service_type": "eas",
      "transfer_type": "one_way_hospital",
      "submitted_at": "2026-06-20T18:45:00.000Z",
      "hours_since_submission": 3.2
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20 }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `PATCH /api/service-memos/:id/approve`

**Purpose:** Sarah approves a memo and triggers the automated pricing match (UC-03 → UC-04). The system looks up the client's active pricing contract (or, for a quoted booking, its frozen quotation) and generates the invoice in the same transaction.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body:** None required.

**Success response `200` - fully matched:**
```json
{
  "data": {
    "memo_id": 7,
    "memo_status": "reviewed",
    "invoice": {
      "id": 7,
      "status": "matched",
      "subtotal": 850.00,
      "gst_rate_percent": 9.00,
      "gst_effective_date": "2024-01-01",
      "tax_amount": 76.50,
      "total_amount": 926.50,
      "unpriced_surcharges": [],
      "line_items": [
        { "id": 21, "description": "EAS - One-Way Hospital Transfer (Office Hours)", "quantity": 1, "unit_price": 850.00, "amount": 850.00, "is_manual_adjustment": false }
      ]
    }
  }
}
```

**Behavioral note - a missing contract or missing rate is NOT an error.** Approval always succeeds once the memo itself is valid: the memo is marked `reviewed` and an invoice is always created, even when the base transport charge cannot be priced automatically. This was deliberately changed from an earlier design that returned `422` after already committing both writes, which made the frontend report a successful approval as a failure and discarded the new invoice id AR needed to recover. See the comment above `approveMemo` in `backend/src/controllers/memoReviewController.js` (around lines 236-261).

In these cases the response is still `200 success: true`, but `invoice.status` is `unmatched` (surcharges the engine could price are still added as line items - only the base transport charge is missing) and a `warning` object is included alongside `invoice`:

```json
{
  "data": {
    "memo_id": 9,
    "memo_status": "reviewed",
    "invoice": {
      "id": 9,
      "status": "unmatched",
      "subtotal": 50.00,
      "gst_rate_percent": 9.00,
      "gst_effective_date": "2024-01-01",
      "tax_amount": 4.50,
      "total_amount": 54.50,
      "unpriced_surcharges": [],
      "line_items": [
        { "id": 25, "description": "Oxygen Charge - Base (first 10L)", "quantity": 1, "unit_price": 50.00, "amount": 50.00, "is_manual_adjustment": false }
      ]
    },
    "warning": {
      "code": "NO_ACTIVE_CONTRACT",
      "message": "Invoice #9 needs the base charge because no active contract covers this client's service date. Recorded surcharges have been priced. Create or activate the contract, then retry matching from the invoice; alternatively, price the base manually."
    }
  }
}
```

`warning.code` is one of:

| `warning.code` | Condition |
|-----------------|-----------|
| `QUOTATION_MISMATCH` | The booking was priced by Quotations, but the completed service (from the memo) does not match the service combination the quote was sold for. Only the base is in dispute; recorded surcharges are still priced |
| `NO_ACTIVE_CONTRACT` | No active pricing contract covers this client and service date (legacy, non-quoted bookings only) |
| `NO_MATCHING_RATE` | An active contract was found but has no rate row matching the memo's service/transfer/time combination |
| `UNPRICED_SURCHARGES` | The base was priced successfully (via a quotation), but one or more recorded surcharges have no rate anywhere in the applicable schedule |

Once the underlying contract/rate gap is fixed, retry automatic pricing with `POST /api/invoices/:id/rematch` (section 5) rather than re-approving the memo.

**Error responses** (genuine failures only - a pricing gap is reported via `warning`, not here):

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | No memo with this id |
| `409` | `MEMO_RETURNED` | Memo was returned to the crew for correction and has not been resubmitted yet |
| `409` | `MEMO_ALREADY_REVIEWED` | Memo has already been approved or an invoice already exists for it |
| `409` | `INVOICE_SOURCE_MISSING` | The memo's booking has no scheduled service date, so the applicable GST rate cannot be determined |
| `422` | `GST_RATE_NOT_CONFIGURED` / `INVALID_GST_DATE` | No GST rate is configured for the service date, or the date itself is invalid |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `PATCH /api/service-memos/:id/return`

**Purpose:** Sarah returns a memo to the field crew with a correction note (UC-03 alternative flow). Memo status reverts to `submitted` and the crew is notified.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body:**
```json
{ "note": "Evacuation floor count appears to be incorrect. Please review and resubmit." }
```

**Success response `200`:**
```json
{
  "data": { "memo_id": 7, "memo_status": "submitted", "note_recorded": true }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | `note` is missing or empty |
| `404` | `NOT_FOUND` | No memo with this id |
| `409` | `MEMO_ALREADY_INVOICED` | Memo is linked to an invoice - cannot be returned once an invoice exists (locked or not); the error message distinguishes an `approved`/`synced_to_xero` invoice (raise a credit note in Xero instead) from any other status (adjust the invoice, or reject its match first) |
| `409` | `MEMO_ALREADY_RETURNED` | Memo has already been returned to the crew and is awaiting their correction |
| `409` | `MEMO_NOT_SUBMITTED` | Memo is not in `submitted` status, so it cannot be returned |

---

## 5. Invoices

### `GET /api/invoices`

**Purpose:** List invoices with optional filters. Powers Sarah's AR review queue and the batch approval view (UC-05, UC-06, UC-10).

**Auth required:** Yes

**Allowed roles:** `ar_specialist`, `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | One of `matched`, `adjusted`, `approved`, `synced_to_xero`, `failed`, `unmatched` |
| `client_id` | integer | No | Filter by client |
| `from_date` | date | No | Filter by `created_at` range start (`YYYY-MM-DD`) |
| `to_date` | date | No | Filter by `created_at` range end (`YYYY-MM-DD`) |
| `page` | integer | No | Default `1` |
| `limit` | integer | No | Default `20` |

**Success response `200`:**
```json
{
  "data": [
    {
      "id": 1,
      "booking_reference": "BKG-2026-00001",
      "client_name": "Tan Tock Seng Hospital",
      "memo_id": 1,
      "subtotal": 850.00,
      "tax_amount": 0.00,
      "total_amount": 850.00,
      "status": "matched",
      "xero_invoice_id": null,
      "approved_at": null,
      "created_at": "2026-06-10T09:30:00.000Z"
    }
  ],
  "meta": { "total": 6, "page": 1, "limit": 20 }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `INVALID_STATUS` | `status` value is not a valid ENUM |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `GET /api/invoices/:id`

**Purpose:** Get a single invoice with all line items. Used by Sarah when reviewing a matched invoice before adjusting or approving (UC-05).

**Auth required:** Yes

**Allowed roles:** `ar_specialist`, `managing_director`

**Success response `200`:**
```json
{
  "data": {
    "id": 2,
    "booking_id": 2,
    "booking_reference": "BKG-2026-00002",
    "memo_id": 2,
    "client_id": 1,
    "client_name": "Tan Tock Seng Hospital",
    "contract_id": 1,
    "contract_name": "Tan Tock Seng Hospital - FY2026 Service Agreement",
    "subtotal": 1080.00,
    "tax_amount": 0.00,
    "total_amount": 1080.00,
    "status": "adjusted",
    "xero_invoice_id": null,
    "approved_by": null,
    "approved_at": null,
    "created_at": "2026-06-11T22:15:00.000Z",
    "updated_at": "2026-06-12T10:00:00.000Z",
    "line_items": [
      { "id": 2, "description": "EAS - One-Way Hospital Transfer (Non-Office Hours)", "quantity": 1, "unit_price": 950.00, "amount": 950.00, "is_manual_adjustment": false },
      { "id": 3, "description": "Oxygen Charge - Base (first 10L)", "quantity": 1, "unit_price": 50.00, "amount": 50.00, "is_manual_adjustment": false },
      { "id": 4, "description": "Oxygen Charge - Additional (5L @ $1/L)", "quantity": 5, "unit_price": 1.00, "amount": 5.00, "is_manual_adjustment": false },
      { "id": 5, "description": "Inconvenience Fee (Floor/Stair Access)", "quantity": 1, "unit_price": 50.00, "amount": 50.00, "is_manual_adjustment": false },
      { "id": 6, "description": "Hospital Administration Fee (Manual Adjustment)", "quantity": 1, "unit_price": 25.00, "amount": 25.00, "is_manual_adjustment": true }
    ]
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | No invoice with this id |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `POST /api/invoices/:id/rematch`

**Purpose:** Re-runs automatic pricing on an invoice that is currently `unmatched` (e.g. because no active contract or no matching rate existed at approval time). This is the recovery action referenced by the `warning.message` on `PATCH /api/service-memos/:id/approve` - creating or fixing a contract does not by itself mutate an already-created invoice, so AR must explicitly retry matching. Deletes and regenerates all engine-produced line items (`is_manual_adjustment: false`); any manual adjustments already on the invoice are left untouched and block the operation instead (see `INVOICE_HAS_LINE_ITEMS` below).

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body:** None required.

**Success response `200`:**
```json
{
  "data": {
    "invoice_id": 9,
    "status": "matched",
    "contract_id": 3,
    "subtotal": 900.00,
    "gst_rate_percent": 9.00,
    "gst_effective_date": "2024-01-01",
    "tax_amount": 81.00,
    "total_amount": 981.00,
    "unpriced_surcharges": [],
    "line_items": [
      { "id": 40, "description": "EAS - One-Way Hospital Transfer (Office Hours)", "quantity": 1, "unit_price": 850.00, "amount": 850.00, "line_type": "base", "is_manual_adjustment": false },
      { "id": 41, "description": "Oxygen Charge - Base (first 10L)", "quantity": 1, "unit_price": 50.00, "amount": 50.00, "line_type": "surcharge", "is_manual_adjustment": false }
    ],
    "warning": null
  }
}
```

If the rematched invoice still has surcharges the schedule cannot price, `warning` is `{ "code": "UNPRICED_SURCHARGES", "message": "..." }` instead of `null` - same shape as the memo approval endpoint's warning.

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | No invoice with this id |
| `409` | `INVOICE_NOT_UNMATCHED` | Invoice is not currently `unmatched` - only an unmatched invoice can be re-matched |
| `409` | `INVOICE_SOURCE_MISSING` | The invoice's source memo or booking record no longer exists, so it cannot be matched automatically |
| `409` | `INVOICE_HAS_LINE_ITEMS` | The invoice has manual adjustment line items; remove them before retrying automatic matching, or continue pricing it by hand |
| `422` | `QUOTATION_MISMATCH` | (Quoted bookings) The completed service still does not match the combination approved by Quotations |
| `422` | `NO_ACTIVE_CONTRACT` | (Legacy, non-quoted bookings) No active pricing contract covers this client and service date yet |
| `422` | `NO_MATCHING_RATE` | (Legacy, non-quoted bookings) The active contract still has no rate for this memo's service/transfer/time combination |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `POST /api/invoices/batch-approve`

**Purpose:** Sarah batch-approves a set of invoices and queues them for Xero push (UC-06). Accepts an array of invoice IDs. Only invoices in `matched` or `adjusted` status are processed; others in the array are skipped and reported.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body:**
```json
{ "invoice_ids": [1, 2, 3] }
```

**Success response `200`:**
```json
{
  "data": {
    "approved": [1, 2, 3],
    "skipped": [],
    "queued_for_xero": [1, 2, 3]
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | `invoice_ids` is empty or not an array |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `POST /api/invoices/:id/retry-xero`

**Purpose:** Retry a Xero push for a single invoice in `failed` status (UC-07 alternative flow, UC-10).

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body:** None required.

**Success response `200`:**
```json
{
  "data": {
    "invoice_id": 5,
    "status": "synced_to_xero",
    "xero_invoice_id": "INV-XR-20260622-0052"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | No invoice with this id |
| `409` | `INVOICE_NOT_FAILED` | Invoice is not in `failed` status - retry not applicable |
| `502` | `XERO_SYNC_ERROR` | Xero rejected or timed out; invoice status remains `failed` with updated error log |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

## 6. Invoice Line Items

### `POST /api/invoices/:invoiceId/line-items`

**Purpose:** Add a manual adjustment line item to an invoice (UC-05). Sets the invoice status to `adjusted`.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body:**
```json
{
  "description": "Hospital Administration Fee",
  "quantity": 1,
  "unit_price": 25.00
}
```

**Success response `201`:**
```json
{
  "data": {
    "id": 13,
    "invoice_id": 2,
    "description": "Hospital Administration Fee",
    "quantity": 1,
    "unit_price": 25.00,
    "amount": 25.00,
    "is_manual_adjustment": true
  },
  "invoice": {
    "id": 2,
    "subtotal": 1080.00,
    "total_amount": 1080.00,
    "status": "adjusted"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | `description` missing, `quantity` or `unit_price` not a positive number |
| `404` | `NOT_FOUND` | No invoice with this id |
| `409` | `INVOICE_LOCKED` | Invoice is in `approved` or `synced_to_xero` status - edits not permitted |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `PUT /api/invoices/:invoiceId/line-items/:itemId`

**Purpose:** Update the `description`, `quantity`, or `unit_price` of an existing line item. Recalculates `amount` and the invoice `subtotal` and `total_amount` automatically.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body** (all fields optional, send only those being changed):
```json
{ "unit_price": 100.00 }
```

**Success response `200`:**
```json
{
  "data": {
    "id": 11,
    "invoice_id": 4,
    "description": "Jurong Island Transport Surcharge",
    "quantity": 1,
    "unit_price": 100.00,
    "amount": 100.00,
    "is_manual_adjustment": false
  },
  "invoice": {
    "id": 4,
    "subtotal": 1150.00,
    "total_amount": 1150.00,
    "status": "adjusted"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | Negative `quantity` or `unit_price` |
| `404` | `NOT_FOUND` | No line item with this id on this invoice |
| `409` | `INVOICE_LOCKED` | Invoice is in `approved` or `synced_to_xero` status |

---

### `DELETE /api/invoices/:invoiceId/line-items/:itemId`

**Purpose:** Remove a line item from an invoice. Only manual adjustment items (`is_manual_adjustment = true`) can be deleted. Engine-generated items can only be edited to preserve the pricing audit trail.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Success response `200`:**
```json
{
  "message": "Line item deleted.",
  "invoice": {
    "id": 2,
    "subtotal": 1055.00,
    "total_amount": 1055.00,
    "status": "adjusted"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `403` | `SYSTEM_LINE_ITEM` | Line item was engine-generated (`is_manual_adjustment = false`) - deletion not permitted |
| `404` | `NOT_FOUND` | No line item with this id on this invoice |
| `409` | `INVOICE_LOCKED` | Invoice is in `approved` or `synced_to_xero` status |

---

## 7. Revenue Leakage Report

### `GET /api/dashboard/revenue-leakage`

**Purpose:** NOT a missing-memo alert. This reports **unpriced surcharges on already-generated invoices** - chargeable items the field crew recorded on a memo that the matched pricing contract (or the published surcharge card) had no rate for, and which the pricing engine therefore could not bill. Every invoice carries an `unpriced_surcharges` JSONB column recording exactly this; this endpoint aggregates that column across the requested window into the report the Managing Director (and Sarah, who is the one who can actually fix the underlying contracts) needs: how much is going unbilled, which surcharge type causes it, and which contract to fix first. See `revenueLeakage()` in `backend/src/controllers/dashboardController.js` (around lines 216-266) and `backend/src/services/leakageService.js`.

All amounts are **estimates**: by definition an unpriced surcharge has no contracted rate, so each occurrence is valued at the **median rate every other active contract charges for that same surcharge type**. An occurrence with no reference rate anywhere in the system is still counted, but valued at zero - the report states this explicitly rather than silently rounding an unknown to zero and presenting the total as complete.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`, `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date_from` | date | No | Filter by invoice `created_at` range start (`YYYY-MM-DD`). Default: 1 January of the current year |
| `date_to` | date | No | Filter by invoice `created_at` range end (`YYYY-MM-DD`). Default: today |

**Success response `200`:**
```json
{
  "data": {
    "period": { "from": "2026-01-01", "to": "2026-06-22" },
    "summary": {
      "estimated_leakage": 850.00,
      "affected_invoice_count": 4,
      "unpriced_item_count": 6,
      "items_without_reference_rate": 1,
      "items_without_recorded_quantity": 0,
      "top_recommendation": "Tan Tock Seng Hospital - FY2026 Service Agreement is missing 1 surcharge rate(s), accounting for an estimated $500.00 of unbilled charges across 3 invoice(s)."
    },
    "by_surcharge_type": [
      {
        "surcharge_type": "jurong_island_min",
        "label": "Jurong Island Transport Surcharge",
        "occurrences": 3,
        "total_quantity": 3,
        "unit_rate": 150.00,
        "basis": "median",
        "estimated_amount": 450.00
      }
    ],
    "by_contract": [
      {
        "contract_id": 3,
        "contract_name": "Tan Tock Seng Hospital - FY2026 Service Agreement",
        "client_id": 1,
        "client_name": "Tan Tock Seng Hospital",
        "affected_invoices": 3,
        "missing_surcharge_types": ["jurong_island_min"],
        "estimated_amount": 450.00
      }
    ],
    "affected_invoices": [
      {
        "invoice_id": 12,
        "client_id": 1,
        "client_name": "Tan Tock Seng Hospital",
        "contract_id": 3,
        "created_at": "2026-06-10T09:30:00.000Z",
        "unpriced_count": 1,
        "estimated_amount": 150.00
      }
    ],
    "reference_rates": { "jurong_island_min": { "basis": "median", "unit_rate": 150.00 } },
    "dismissed": {
      "count": 1,
      "estimated_amount": 150.00,
      "rows": [
        {
          "invoice_id": 9,
          "client_id": 2,
          "client_name": "Singapore General Hospital",
          "created_at": "2026-05-02T11:00:00.000Z",
          "unpriced_count": 1,
          "estimated_amount": 150.00,
          "dismissed_at": "2026-08-08T03:12:00.000Z",
          "dismissed_reason": "Billed separately via a manual adjustment note - contract rate will be added next renewal.",
          "dismissed_by": { "id": 5, "name": "Sarah Lim" }
        }
      ]
    },
    "basis_note": "Amounts are estimates. Unpriced surcharges have no contracted rate by definition, so each is valued at the median rate other contracts charge for the same surcharge type. Items with no reference rate anywhere in the system are counted but valued at zero."
  }
}
```

The top-level `summary`/`by_surcharge_type`/`by_contract`/`affected_invoices`/`reference_rates` figures only ever reflect **open** (non-dismissed) rows, so a dismissed write-off cannot make the headline leakage number look smaller than it should. The `dismissed` block reports closed rows separately rather than folding them into the total, so "we are leaking $X" and "we decided to stop chasing $Y" stay distinguishable.

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

**Note - the "missing memo" concept is a different endpoint.** A completed booking with no linked service memo at all (nothing to price, because nothing was submitted) is not reported here - it is a separate field, `revenue_risk.completed_without_memo`, on `GET /api/dashboard/fleet-overview`'s response (`fleetOverview()` in `dashboardController.js`, around lines 123-126). That endpoint is owned/documented by a different feature area and is not otherwise covered in this document; it is called out here only so the two "revenue leakage"-sounding concepts are not conflated.

### `PATCH /api/dashboard/revenue-leakage/:invoiceId/dismiss`

**Purpose:** Closes a leakage row that will not be recovered (e.g. billed separately, or written off), with an attributable reason. Deliberately does NOT clear `unpriced_surcharges` on the invoice - the record of what went unbilled is the evidence behind the decision, so erasing it would make the dismissal unauditable and the figure unreproducible. See `dismissLeakage()` in `backend/src/controllers/dashboardController.js`.

**Auth required:** Yes

**Allowed roles:** `managing_director`, `ar_specialist` - restricted to the two roles accountable for the number; the read access above is wider than this write.

**URL params:** `invoiceId` (integer, required)

**Request body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `reason` | string | Yes | Free-text explanation of why this leakage is being closed. Trimmed before saving. |

**Success response `200`:**
```json
{
  "data": {
    "invoice_id": 9,
    "dismissed_at": "2026-08-08T03:12:00.000Z",
    "dismissed_reason": "Billed separately via a manual adjustment note - contract rate will be added next renewal."
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |
| `404` | `NOT_FOUND` | No invoice with this id |
| `409` | `NO_LEAKAGE_TO_DISMISS` | Invoice has no unpriced surcharges - nothing to dismiss |
| `409` | `LEAKAGE_ALREADY_DISMISSED` | This leakage row has already been dismissed |

### `DELETE /api/dashboard/revenue-leakage/:invoiceId/dismiss`

**Purpose:** Reopens a previously-dismissed leakage row - a write-off decided in error must be reversible, otherwise the safe move is never to dismiss anything and the feature goes unused. Clears `leakage_dismissed_at`/`leakage_dismissed_reason`/`leakage_dismissed_by` back to `null`, returning the row to exactly its pre-dismissal state. See `restoreLeakage()` in `backend/src/controllers/dashboardController.js`.

**Auth required:** Yes

**Allowed roles:** `managing_director`, `ar_specialist`

**URL params:** `invoiceId` (integer, required)

**Success response `200`:**
```json
{
  "data": {
    "invoice_id": 9,
    "dismissed_at": null
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |
| `404` | `NOT_FOUND` | No invoice with this id |

---

## 8. AR Dashboard - DROPPED

**This screen was never built and the endpoint below does not exist in the codebase.** Per CLAUDE.md's Logic Correction 6 ("No AR or AP dashboard"), the AR Specialist lands directly on the Invoice List (`GET /api/invoices`, section 5) instead of a dashboard. The status-breakdown content this section used to describe is covered by the status filter chips on that list screen; the revenue-leakage content is covered by section 7 above. Section numbering is intentionally left as a tombstone (not renumbered) so any existing code comments or references to "section 8" stay meaningful - see CLAUDE.md's own tombstoning of dropped prototype screens 6 and 15.

~~`GET /api/ar/dashboard`~~ - dropped, never implemented.

---

## 9. Xero Bank Feed - DROPPED

**This feature was never built and the endpoint below does not exist in the codebase.** Per CLAUDE.md's Logic Correction 6, the Xero bank feed is out of scope: `bank_feed` exists only as an unused `entity_type` enum literal on `XeroSyncLog` (see `backend/src/models/XeroSyncLog.js`), with zero producers anywhere in the codebase. There is no bank-feed UI and none is required. Section numbering is intentionally left as a tombstone, matching section 8 above.

~~`POST /api/xero/bank-feed/pull`~~ - dropped, never implemented.

---

## 10. Dev Auth Reference

All JWT tokens below are signed with `HS256` and use the shared dev secret. They expire **2027-06-22** (1 year from today).

Add the following to `backend/.env` (already in `.env.example`):

```
DEV_JWT_SECRET=dev-secret-efar-2026
```

To verify or decode a token locally: `jwt.verify(token, process.env.DEV_JWT_SECRET)`

---

### Token Payload Shape

```json
{
  "sub":   1,
  "name":  "Sarah Tan",
  "email": "sarah@efar.sg",
  "role":  "ar_specialist",
  "iat":   1782114425,
  "exp":   1813650425
}
```

**`sub`** maps to `users.id` in the shared users table. Middleware reads `req.user.role` for access control and `req.user.sub` as the acting user id (e.g. for `approved_by`, `reviewed_by`).

### Canonical User ID Map

| `users.id` | Name | Role |
|-----------|------|------|
| 1 | Sarah Tan | `ar_specialist` |
| 2 | Doris Ching | `managing_director` |
| 3 | Ravi Kumar | `field_crew` |
| 4 | Chloe Lim | `ap_specialist` |
| 5 | Camilla Ng | `quotations_specialist` |

This mapping is shared across all teammates. All seed files and JWT tokens use these IDs.

---

### Pre-signed Test Tokens

Copy the token for the role you are testing and paste it as the `Authorization: Bearer <token>` header.

#### AR Specialist - Sarah Tan (`sub: 1`)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsIm5hbWUiOiJTYXJhaCBUYW4iLCJlbWFpbCI6InNhcmFoQGVmYXIuc2ciLCJyb2xlIjoiYXJfc3BlY2lhbGlzdCIsImlhdCI6MTc4MjExNDQyNSwiZXhwIjoxODEzNjUwNDI1fQ.ESzmUh8-f6nRvC0MH0c3t13hSEfeapsAYD4ResqL4pM
```

#### Managing Director - Doris Ching (`sub: 2`)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsIm5hbWUiOiJEb3JpcyBDaGluZyIsImVtYWlsIjoiZG9yaXNAZWZhci5zZyIsInJvbGUiOiJtYW5hZ2luZ19kaXJlY3RvciIsImlhdCI6MTc4MjExNDQyNSwiZXhwIjoxODEzNjUwNDI1fQ.k452ZYTHp373ilcJKalsXLlKWQ7Df1c_kJ9F2JIsJzM
```

#### AP Specialist - Chloe Lim (`sub: 4`)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjQsIm5hbWUiOiJDaGxvZSBMaW0iLCJlbWFpbCI6ImNobG9lQGVmYXIuc2ciLCJyb2xlIjoiYXBfc3BlY2lhbGlzdCIsImlhdCI6MTc4MjExNDQyNSwiZXhwIjoxODEzNjUwNDI1fQ.hHKZGVrmB6jmPcm52HnUg5lbxkSPMZe7FhreLrE1eZI
```

#### Quotations Specialist - Camilla Ng (`sub: 5`)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsIm5hbWUiOiJDYW1pbGxhIE5nIiwiZW1haWwiOiJjYW1pbGxhQGVmYXIuc2ciLCJyb2xlIjoicXVvdGF0aW9uc19zcGVjaWFsaXN0IiwiaWF0IjoxNzgyMTE0NDI1LCJleHAiOjE4MTM2NTA0MjV9.tYNXbCvGiUFz-uu1a4Y5fE_GMzWEjLMkBO7KABeMi1w
```

---

### Role Access Matrix

| Endpoint group | `ar_specialist` | `managing_director` | `ap_specialist` | `quotations_specialist` |
|----------------|:-:|:-:|:-:|:-:|
| Pricing contracts (read) | Yes | Yes | - | - |
| Pricing contracts (write) | Yes | - | - | - |
| Memo review queue | Yes | - | - | - |
| Invoices (read) | Yes | Yes | - | - |
| Invoices (write / approve / rematch) | Yes | - | - | - |
| Revenue leakage report (read-only) | Yes | Yes | - | - |
| AR dashboard | DROPPED | DROPPED | DROPPED | DROPPED |
| Xero bank feed pull | DROPPED | DROPPED | DROPPED | DROPPED |

`AR dashboard` and `Xero bank feed pull` are marked `DROPPED` across every role because neither endpoint exists in the codebase - see sections 8 and 9.
