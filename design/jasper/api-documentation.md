# API Documentation - Jasper

**Feature Area:** AR Billing, Pricing Engine & Invoice Sync

All endpoints are prefixed with `/api`. All endpoints require a valid JWT in the `Authorization: Bearer <token>` header unless stated otherwise.

Error responses always use the shape:
```json
{ "error": "ERROR_CODE", "message": "Human-readable description" }
```

---

## Table of Contents

1. [Pricing Contracts](#1-pricing-contracts)
2. [Pricing Rates](#2-pricing-rates)
3. [Surcharge Schedules](#3-surcharge-schedules)
4. [Memo Review Queue](#4-memo-review-queue)
5. [Invoices](#5-invoices)
6. [Invoice Line Items](#6-invoice-line-items)
7. [Revenue Leakage Alerts](#7-revenue-leakage-alerts)
8. [AR Dashboard](#8-ar-dashboard)
9. [Xero Bank Feed](#9-xero-bank-feed)
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

### `GET /api/memos/pending-review`

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

### `PATCH /api/memos/:id/approve`

**Purpose:** Sarah approves a memo and triggers the automated pricing match (UC-03 → UC-04). The system looks up the client's active contract and generates the invoice in the same transaction.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body:** None required.

**Success response `200`:**
```json
{
  "data": {
    "memo_id": 7,
    "memo_status": "reviewed",
    "invoice": {
      "id": 7,
      "status": "matched",
      "subtotal": 850.00,
      "tax_amount": 0.00,
      "total_amount": 850.00,
      "line_items": [
        { "description": "EAS - One-Way Hospital Transfer (Office Hours)", "quantity": 1, "unit_price": 850.00, "amount": 850.00, "is_manual_adjustment": false }
      ]
    }
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `MEMO_NOT_FOUND` | No memo with this id |
| `409` | `MEMO_ALREADY_REVIEWED` | Memo has already been approved or an invoice already exists for it |
| `422` | `NO_ACTIVE_CONTRACT` | No active pricing contract found for this client - invoice created with status `unmatched` |
| `422` | `NO_MATCHING_RATE` | Active contract found but no rate row matches the memo's service/transfer/time combination - invoice created with status `unmatched` |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `PATCH /api/memos/:id/return`

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
| `404` | `MEMO_NOT_FOUND` | No memo with this id |
| `409` | `MEMO_ALREADY_INVOICED` | Memo is linked to an invoice that has already been approved or synced - cannot be returned |

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
| `404` | `INVOICE_NOT_FOUND` | No invoice with this id |
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
| `404` | `INVOICE_NOT_FOUND` | No invoice with this id |
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
| `404` | `INVOICE_NOT_FOUND` | No invoice with this id |
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
| `404` | `LINE_ITEM_NOT_FOUND` | No line item with this id on this invoice |
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
| `404` | `LINE_ITEM_NOT_FOUND` | No line item with this id on this invoice |
| `409` | `INVOICE_LOCKED` | Invoice is in `approved` or `synced_to_xero` status |

---

## 7. Revenue Leakage Alerts

### `GET /api/revenue-leakage`

**Purpose:** Return all bookings in `completed` status with no linked service memo after the alert threshold (default 4 hours). Powers the Revenue Leakage Alert panel on the AR and executive dashboards (UC-09).

**Auth required:** Yes

**Allowed roles:** `ar_specialist`, `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `threshold_hours` | integer | No | Override the alert threshold. Default `4` |

**Success response `200`:**
```json
{
  "data": [
    {
      "booking_id": 7,
      "booking_reference": "BKG-2026-00007",
      "client_name": "Tan Tock Seng Hospital",
      "scheduled_date": "2026-06-20",
      "assigned_crew_name": "Ravi Kumar",
      "hours_since_completion": 6.5,
      "alert_severity": "high"
    }
  ],
  "meta": { "total": 1 }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `PATCH /api/revenue-leakage/:bookingId/resolve`

**Purpose:** Sarah marks a leakage alert as resolved with a reason (UC-09 - e.g. job was cancelled on site).

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body:**
```json
{ "reason": "Job cancelled on site - patient refused transport." }
```

**Success response `200`:**
```json
{
  "data": { "booking_id": 7, "resolved": true, "reason": "Job cancelled on site - patient refused transport." }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | `reason` is missing or empty |
| `404` | `BOOKING_NOT_FOUND` | No booking with this id |
| `409` | `MEMO_NOW_EXISTS` | A memo was submitted between the alert being raised and this resolve request - resolve is no longer needed |

---

## 8. AR Dashboard

### `GET /api/ar/dashboard`

**Purpose:** Return invoice status counts and totals for the AR Batch Status Tracker and executive dashboard (UC-10).

**Auth required:** Yes

**Allowed roles:** `ar_specialist`, `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `from_date` | date | No | Filter by `created_at` range start |
| `to_date` | date | No | Filter by `created_at` range end |

**Success response `200`:**
```json
{
  "data": {
    "summary": [
      { "status": "matched",        "count": 3, "total_value": 2550.00 },
      { "status": "adjusted",       "count": 1, "total_value": 1080.00 },
      { "status": "approved",       "count": 1, "total_value": 1570.00 },
      { "status": "synced_to_xero", "count": 1, "total_value": 1200.00 },
      { "status": "failed",         "count": 1, "total_value": 850.00  },
      { "status": "unmatched",      "count": 1, "total_value": 0.00    }
    ],
    "revenue_leakage_alert_count": 2,
    "period": { "from": "2026-06-01", "to": "2026-06-22" }
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

## 9. Xero Bank Feed

### `POST /api/xero/bank-feed/pull`

**Purpose:** Trigger a manual bank feed pull from Xero for the configured EFAR bank account (UC-08). Returns the newly imported transactions.

**Auth required:** Yes

**Allowed roles:** `ar_specialist`

**Request body:** None required.

**Success response `200`:**
```json
{
  "data": {
    "transactions_imported": 4,
    "last_pull_at": "2026-06-22T10:30:00.000Z",
    "transactions": [
      {
        "xero_transaction_id": "TXN-0001",
        "date": "2026-06-21",
        "description": "Payment from Tan Tock Seng Hospital",
        "amount": 850.00,
        "type": "credit"
      }
    ]
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `502` | `XERO_UNAVAILABLE` | Xero API timed out or returned an error |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

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
  "sub":  1,
  "name": "Sarah Lim",
  "role": "ar_specialist",
  "iat":  1782114425,
  "exp":  1813650425
}
```

**`sub`** maps to `users.id` in the shared users table. Middleware reads `req.user.role` for access control and `req.user.sub` as the acting user id (e.g. for `approved_by`, `reviewed_by`).

---

### Pre-signed Test Tokens

Copy the token for the role you are testing and paste it as the `Authorization: Bearer <token>` header.

#### AR Specialist - Sarah Lim (`sub: 1`)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsIm5hbWUiOiJTYXJhaCBMaW0iLCJyb2xlIjoiYXJfc3BlY2lhbGlzdCIsImV4cCI6MTgxMzY1MDQyNSwiaWF0IjoxNzgyMTE0NDI1fQ.dM8qVhZO5Q5i0XISOeHpzZKpggmCWOmzY7Z1o2Mrn1s
```

#### Managing Director - Doris Tan (`sub: 2`)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsIm5hbWUiOiJEb3JpcyBUYW4iLCJyb2xlIjoibWFuYWdpbmdfZGlyZWN0b3IiLCJleHAiOjE4MTM2NTA0MjUsImlhdCI6MTc4MjExNDQyNX0.KoZThoGKT0dVBA9hl10xJE-p3gXuunzD_q7gI7T137M
```

#### AP Specialist - Chloe Ng (`sub: 4`)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjQsIm5hbWUiOiJDaGxvZSBOZyIsInJvbGUiOiJhcF9zcGVjaWFsaXN0IiwiZXhwIjoxODEzNjUwNDI1LCJpYXQiOjE3ODIxMTQ0MjV9.77DpzoAdenAtp6hN3kuXz1Y5LbYY2hQwXmAtZA9HrW8
```

#### Quotations Specialist - Camilla Wong (`sub: 5`)

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsIm5hbWUiOiJDYW1pbGxhIFdvbmciLCJyb2xlIjoicXVvdGF0aW9uc19zcGVjaWFsaXN0IiwiZXhwIjoxODEzNjUwNDI1LCJpYXQiOjE3ODIxMTQ0MjV9.Rxdz5IhTmTDbowLeDFqE322qcSBAg2SpZPA57X_s8FI
```

---

### Role Access Matrix

| Endpoint group | `ar_specialist` | `managing_director` | `ap_specialist` | `quotations_specialist` |
|----------------|:-:|:-:|:-:|:-:|
| Pricing contracts (read) | Yes | Yes | - | - |
| Pricing contracts (write) | Yes | - | - | - |
| Memo review queue | Yes | - | - | - |
| Invoices (read) | Yes | Yes | - | - |
| Invoices (write / approve) | Yes | - | - | - |
| Revenue leakage (read) | Yes | Yes | - | - |
| Revenue leakage (resolve) | Yes | - | - | - |
| AR dashboard | Yes | Yes | - | - |
| Xero bank feed pull | Yes | - | - | - |
