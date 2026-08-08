# API Documentation - Liang Yi

**Feature Area:** Field Operations & Executive Dashboard

> **Implementation note (2026-07-02):** Design below is authored by Liang Yi. Wave 2A code implementation is being carried out by Jasper - see `README.md` Task Allocation and `my-project-ai/Jasper/handoff-2026-07-02.md` for context.

All endpoints are prefixed with `/api`. Authentication uses JWT Bearer tokens unless stated otherwise. The `Authorization` header format is:

```
Authorization: Bearer <token>
```

---

## Endpoint Index

| # | Method | Path | UC | Auth |
|---|--------|------|----|------|
| 1 | POST | `/api/service-memos/upload-signature` | UC-02 | Yes |
| 2 | POST | `/api/service-memos/upload-hospital-stamp` | UC-04 | Yes |
| 3 | POST | `/api/service-memos` | UC-01, UC-03, UC-05 | Yes |
| 4 | GET | `/api/service-memos` | UC-05 | Yes |
| 5 | GET | `/api/service-memos/:id` | UC-06 | Yes |
| 6 | GET | `/api/dashboard/fleet-overview` | UC-06 | Yes |
| 7 | GET | `/api/dashboard/vendor-expenses` | UC-07 | Yes |
| 8 | GET | `/api/service-memos/pending-review` | UC-08 | Yes |
| 9 | PATCH | `/api/service-memos/:id/approve` | UC-08 | Yes |
| 10 | PATCH | `/api/service-memos/:id/return` | UC-08 | Yes |
| 11 | PATCH | `/api/service-memos/:id/resubmit` | UC-08 | Yes |
| 12 | GET | `/api/dashboard/revenue-leakage` | UC-06 | Yes |
| 13 | GET | `/api/dashboard/cycle-time` | UC-06 | Yes |
| 14 | GET | `/api/dashboard/xero-health` | UC-06 | Yes |
| 15 | GET | `/api/dashboard/revenue-trend` | UC-06 | Yes |
| 16 | GET | `/api/dashboard/top-clients` | UC-06 | Yes |
| 17 | GET | `/api/dashboard/revenue-by-service-type` | UC-06 | Yes |
| 18 | GET | `/api/dashboard/leakage-history` | UC-06 | Yes |
| 19 | GET | `/api/dashboard/crew-positions` | UC-06 | Yes |

> Endpoints 9-19 are implemented in `backend/src/controllers/memoReviewController.js` and `backend/src/controllers/dashboardController.js` respectively (Wave 3, Kwan Hua/Jasper). They are documented here because they live in the routers this document owns (`serviceMemoRoutes.js`, `dashboardRoutes.js`).

---

## Memo Submission Flow

The field memo follows a client-driven draft pattern. Form data is held in the browser's local storage (UC-01) rather than persisted as a partial DB record. The two upload endpoints exist to handle Cloudinary uploads for the signature and hospital stamp before final submission. The client stores the returned URLs locally and sends them as fields in the final `POST /api/service-memos` call, which creates both the `service_memos` and `memo_signatures` records atomically.

```
1. POST /upload-signature   → returns signature_image_url (no DB write)
2. POST /upload-hospital-stamp (optional) → returns hospital_stamp_image_url (no DB write)
3. POST /service-memos      → creates memo + signature in one transaction
```

---

## 1. POST `/api/service-memos/upload-signature`

**Purpose:** Accepts the signature image drawn on the canvas (UC-02), uploads it to Cloudinary via the backend, and returns the secure URL. No database record is created at this point - the URL is held client-side until the memo is submitted in step 3. Supports both a normal captured signature and the "signature unavailable" waiver flow by accepting any image upload; the waiver flag is declared at submission time.

**Auth required:** Yes - roles: `field_crew`, `managing_director`

**Request body:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | Signature image (PNG, JPG). Max 5 MB. |

**Success response `200 OK`:**
```json
{
  "signature_image_url": "https://res.cloudinary.com/efar/image/upload/v1750120000/signatures/sig-crew5-job88.png"
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `INVALID_FILE_TYPE` | Only PNG and JPG image files are accepted for signatures. |
| 400 | `FILE_TOO_LARGE` | Signature image exceeds the 5 MB limit. |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 502 | `CLOUDINARY_UPLOAD_FAILED` | Failed to upload signature to storage. Please retry. |

---

## 2. POST `/api/service-memos/upload-hospital-stamp`

**Purpose:** Accepts a photo of the hospital rubber-stamped document (UC-04), uploads it to Cloudinary, and returns the secure URL. This field is optional - not all hospitals require a stamp. The returned URL is held client-side and included in the final memo submission body if present.

**Auth required:** Yes - roles: `field_crew`, `managing_director`

**Request body:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | Stamped document photo (PNG, JPG). Max 10 MB. |

**Success response `200 OK`:**
```json
{
  "hospital_stamp_image_url": "https://res.cloudinary.com/efar/image/upload/v1750120001/hospital-stamps/stamp-job88.jpg"
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `INVALID_FILE_TYPE` | Only PNG and JPG image files are accepted for hospital stamps. |
| 400 | `FILE_TOO_LARGE` | Hospital stamp image exceeds the 10 MB limit. |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 502 | `CLOUDINARY_UPLOAD_FAILED` | Failed to upload hospital stamp to storage. Please retry. |

---

## 3. POST `/api/service-memos`

**Purpose:** Submits the completed field memo (UC-01 through UC-05) in a single atomic request. The server runs all revenue field validations (UC-03), creates the `service_memos` record with status `submitted`, creates the linked `memo_signatures` record, and updates the parent `bookings` record status from `in_progress` to `completed` - all in one database transaction. On success, an in-app notification is queued for the AR Specialist (Sarah).

A memo requires either a captured signature (`is_waived: false`, `signature_image_url` present) or a documented waiver (`is_waived: true`, `waiver_reason` present). The request body must satisfy exactly one of these two forms.

> **Conditional field note (client feedback item 4, 2026-07-17):** `patient_name` and `hospital_destination` are required only when `service_type` is `eas` or `mts` (the two service types that always involve an ambulance and a patient). For `event_standby` and `workplace_standby` jobs - manpower-only assignments with no ambulance run - both fields are optional; an empty string is coerced to `null`. A standby job that does happen to have a patient (e.g. an event casualty) may still supply a value, so the fields are not blocked for standby types, only not mandatory. This is enforced in `backend/src/validators/serviceMemoValidators.js` (`requiredForAmbulanceOnly`), and the underlying `service_memos.patient_name` / `hospital_destination` columns are `allowNull: true` to match.

**Auth required:** Yes - roles: `field_crew`, `managing_director`

**Request body:**
```json
{
  "booking_id": 88,
  "job_start_time": "2026-06-22T08:00:00.000Z",
  "job_end_time": "2026-06-22T10:45:00.000Z",
  "overtime_hours": 0.75,
  "evacuation_floors": 3,
  "patient_name": "Tan Ah Kow",
  "hospital_destination": "Tan Tock Seng Hospital A&E",
  "service_type": "eas",
  "transfer_type": "one_way_hospital",
  "is_office_hours": true,
  "oxygen_litres_used": 12.5,
  "has_inconvenience_fee": true,
  "disposables_used": true,
  "resuscitation_performed": false,
  "suction_performed": false,
  "waiting_time_minutes": 30,
  "patient_weight_kg": 85.0,
  "is_jurong_island": false,
  "additional_charges_notes": "Patient on 3rd floor, no lift access.",
  "hospital_stamp_image_url": "https://res.cloudinary.com/efar/image/upload/v1750120001/hospital-stamps/stamp-job88.jpg",
  "signature": {
    "signer_name": "Lim Wei Jie",
    "signature_image_url": "https://res.cloudinary.com/efar/image/upload/v1750120000/signatures/sig-crew5-job88.png",
    "signed_at": "2026-06-22T10:48:00.000Z",
    "is_waived": false,
    "waiver_reason": null
  }
}
```

**Waiver variant** (signature unavailable - UC-02 edge case):
```json
{
  "signature": {
    "signer_name": "Patient",
    "signature_image_url": null,
    "signed_at": "2026-06-22T10:48:00.000Z",
    "is_waived": true,
    "waiver_reason": "Patient unconscious - ICU transfer"
  }
}
```

**Success response `201 Created`:**
```json
{
  "id": 55,
  "booking_id": 88,
  "submitted_by": 5,
  "status": "submitted",
  "job_start_time": "2026-06-22T08:00:00.000Z",
  "job_end_time": "2026-06-22T10:45:00.000Z",
  "overtime_hours": "0.75",
  "evacuation_floors": 3,
  "patient_name": "Tan Ah Kow",
  "hospital_destination": "Tan Tock Seng Hospital A&E",
  "service_type": "eas",
  "transfer_type": "one_way_hospital",
  "is_office_hours": true,
  "oxygen_litres_used": "12.50",
  "has_inconvenience_fee": true,
  "disposables_used": true,
  "resuscitation_performed": false,
  "suction_performed": false,
  "waiting_time_minutes": 30,
  "patient_weight_kg": "85.0",
  "is_jurong_island": false,
  "additional_charges_notes": "Patient on 3rd floor, no lift access.",
  "hospital_stamp_image_url": "https://res.cloudinary.com/efar/image/upload/v1750120001/hospital-stamps/stamp-job88.jpg",
  "ar_note": null,
  "returned_at": null,
  "resubmitted_at": null,
  "signature": {
    "id": 33,
    "signer_name": "Lim Wei Jie",
    "signature_image_url": "https://res.cloudinary.com/efar/image/upload/v1750120000/signatures/sig-crew5-job88.png",
    "signed_at": "2026-06-22T10:48:00.000Z",
    "is_waived": false,
    "waiver_reason": null
  },
  "created_at": "2026-06-22T10:48:05.000Z"
}
```

`ar_note`, `returned_at`, and `resubmitted_at` are always `null` on a freshly created memo - they are only ever set by the AR review return/resubmit loop (see UC-08 below and endpoints 9-11). `patient_name` and `hospital_destination` are `null` in this response whenever the submitted `service_type` is `event_standby` or `workplace_standby` and no value was supplied (see the conditional field note above).

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `VALIDATION_ERROR` | One or more revenue fields failed validation. See `errors` array. |
| 400 | `INVALID_TIME_RANGE` | `job_end_time` must be after `job_start_time`. |
| 400 | `OVERTIME_INCONSISTENT` | Job duration implies overtime but `overtime_hours` is 0. Add a note or correct the hours. |
| 400 | `NEGATIVE_VALUE` | `overtime_hours` and `evacuation_floors` cannot be negative. |
| 400 | `SIGNATURE_REQUIRED` | A signature image URL or a documented waiver with `waiver_reason` is required. |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Role not permitted to submit field memos. |
| 404 | `BOOKING_NOT_FOUND` | Booking not found or not assigned to this crew member. |
| 409 | `MEMO_ALREADY_EXISTS` | A memo has already been submitted for this booking. Contact AR if a correction is needed. |
| 409 | `BOOKING_ALREADY_INVOICED` | This booking has already been invoiced. Contact AR if a correction is required. |

> On `400 VALIDATION_ERROR`, the response also includes an `errors` array:
> ```json
> {
>   "code": "VALIDATION_ERROR",
>   "message": "One or more revenue fields failed validation.",
>   "errors": [
>     { "field": "evacuation_floors", "message": "Evacuation floor count cannot be blank. Enter 0 if no evacuation occurred." }
>   ]
> }
> ```

---

## 4. GET `/api/service-memos`

**Purpose:** Returns a paginated list of service memos. AR Specialists use this as their review queue. Field crew see only their own submitted memos. The Managing Director sees all memos and can filter for the fleet overview drill-down (UC-06 - "clicking a status figure drills down to the filtered booking list").

**Auth required:** Yes - roles: `field_crew`, `ar_specialist`, `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | Filter by status: `submitted`, `returned`, `reviewed`, `invoiced` |
| `booking_id` | integer | No | Filter by a specific booking |
| `submitted_by` | integer | No | Filter by crew member user ID. Field crew can only filter by their own ID. |
| `date_from` | date (YYYY-MM-DD) | No | Filter by `created_at` from this date |
| `date_to` | date (YYYY-MM-DD) | No | Filter by `created_at` up to this date |
| `page` | integer | No | Page number, default `1` |
| `limit` | integer | No | Results per page, default `20`, max `100` |

**Success response `200 OK`:**
```json
{
  "data": [
    {
      "id": 55,
      "booking_id": 88,
      "submitted_by": {
        "id": 5,
        "name": "Crew Member Name"
      },
      "patient_name": "Tan Ah Kow",
      "hospital_destination": "Tan Tock Seng Hospital A&E",
      "service_type": "eas",
      "status": "submitted",
      "has_hospital_stamp": true,
      "created_at": "2026-06-22T10:48:05.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "total_pages": 1
  }
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `INVALID_DATE_RANGE` | `date_from` must be before or equal to `date_to`. |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Role not permitted to list service memos. |

---

## 5. GET `/api/service-memos/:id`

**Purpose:** Returns the full detail of one service memo including its signatures. Used by the AR Specialist to review a memo before triggering the pricing match, and by the crew member to confirm a submitted memo.

**Auth required:** Yes - roles: `field_crew`, `ar_specialist`, `managing_director`

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | integer | Service memo ID |

**Success response `200 OK`:**
```json
{
  "id": 55,
  "booking_id": 88,
  "submitted_by": {
    "id": 5,
    "name": "Crew Member Name"
  },
  "reviewed_by": null,
  "status": "submitted",
  "job_start_time": "2026-06-22T08:00:00.000Z",
  "job_end_time": "2026-06-22T10:45:00.000Z",
  "overtime_hours": "0.75",
  "evacuation_floors": 3,
  "patient_name": "Tan Ah Kow",
  "hospital_destination": "Tan Tock Seng Hospital A&E",
  "service_type": "eas",
  "transfer_type": "one_way_hospital",
  "is_office_hours": true,
  "oxygen_litres_used": "12.50",
  "has_inconvenience_fee": true,
  "disposables_used": true,
  "resuscitation_performed": false,
  "suction_performed": false,
  "waiting_time_minutes": 30,
  "patient_weight_kg": "85.0",
  "is_jurong_island": false,
  "additional_charges_notes": "Patient on 3rd floor, no lift access.",
  "hospital_stamp_image_url": "https://res.cloudinary.com/efar/image/upload/v1750120001/hospital-stamps/stamp-job88.jpg",
  "ar_note": null,
  "returned_at": null,
  "resubmitted_at": null,
  "signatures": [
    {
      "id": 33,
      "signer_name": "Lim Wei Jie",
      "signature_image_url": "https://res.cloudinary.com/efar/image/upload/v1750120000/signatures/sig-crew5-job88.png",
      "signed_at": "2026-06-22T10:48:00.000Z",
      "is_waived": false,
      "waiver_reason": null
    }
  ],
  "created_at": "2026-06-22T10:48:05.000Z",
  "updated_at": "2026-06-22T10:48:05.000Z"
}
```

> `status` can also be `returned` when the AR Specialist has sent the memo back for correction (see UC-08 below). While `status` is `returned`, `ar_note` holds AR's correction note and `returned_at` is set; `resubmitted_at` is set once the crew corrects and resubmits (endpoint 11), at which point `status` reverts to `submitted` and `ar_note` is cleared back to `null`.

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Role not permitted to view this service memo. |
| 404 | `NOT_FOUND` | Service memo not found. |

---

## 6. GET `/api/dashboard/fleet-overview`

**Purpose:** Returns aggregated fleet and job status metrics for the executive dashboard (UC-06). Aggregates across `bookings` (Zheng Bao), `service_memos` (own), and `invoices` (Jasper). Supports date range filtering and a breakdown by booking status for the status distribution chart.

**Auth required:** Yes - roles: `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `period` | string | No | Shorthand: `today` (default), `this_week`, `this_month` |
| `date_from` | date (YYYY-MM-DD) | No | Custom range start. Overrides `period`. |
| `date_to` | date (YYYY-MM-DD) | No | Custom range end. Overrides `period`. |

**Success response `200 OK`:**
```json
{
  "period": {
    "from": "2026-06-22",
    "to": "2026-06-22"
  },
  "totals": {
    "bookings_total": 14,
    "active_jobs": 3,
    "pending_memo_submission": 2,
    "invoices_synced_to_xero": 8
  },
  "booking_status_breakdown": [
    { "status": "confirmed",   "count": 1 },
    { "status": "in_progress", "count": 3 },
    { "status": "completed",   "count": 4 },
    { "status": "invoiced",    "count": 6 }
  ],
  "revenue_risk": {
    "completed_without_memo": 2,
    "warning": true
  }
}
```

> `revenue_risk.warning` is `true` when `completed_without_memo > 0`. The frontend uses this to highlight the "Pending Memo" figure in a warning colour (UC-06 edge case).

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `INVALID_DATE_RANGE` | `date_from` must be before or equal to `date_to`. |
| 400 | `INVALID_PERIOD` | `period` must be one of: `today`, `this_week`, `this_month`. |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Only the Managing Director can access the fleet overview dashboard. |

---

## 7. GET `/api/dashboard/vendor-expenses`

**Purpose:** Returns aggregated vendor expenditure metrics for the executive overhead dashboard (UC-07). Reads from `vendor_invoices` (Kwan Hua) filtered to `approved` and `synced_to_xero` statuses only. Returns both the flat summary figures and the data arrays needed for the bar chart (by vendor) and line chart (monthly trend).

**Auth required:** Yes - roles: `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date_from` | date (YYYY-MM-DD) | No | Filter by `invoice_date` from this date. Defaults to start of current financial year. |
| `date_to` | date (YYYY-MM-DD) | No | Filter by `invoice_date` up to this date. Defaults to today. |
| `vendor_name` | string | No | Partial match filter on vendor name. |

**Success response `200 OK`:**
```json
{
  "period": {
    "from": "2026-01-01",
    "to": "2026-06-22"
  },
  "summary": {
    "total_expenditure": "48320.00",
    "total_rebates_applied": "483.20",
    "net_payable": "47836.80",
    "invoice_count": 26
  },
  "by_vendor": [
    {
      "vendor_name": "Esso Petroleum Pte Ltd",
      "total_expenditure": "28800.00",
      "total_rebates": "288.00",
      "net_payable": "28512.00",
      "invoice_count": 12
    },
    {
      "vendor_name": "SBS Transit Parts",
      "total_expenditure": "19520.00",
      "total_rebates": "195.20",
      "net_payable": "19324.80",
      "invoice_count": 14
    }
  ],
  "monthly_trend": [
    { "month": "2026-01", "total_expenditure": "7200.00", "net_payable": "7128.00" },
    { "month": "2026-02", "total_expenditure": "8100.00", "net_payable": "8019.00" },
    { "month": "2026-03", "total_expenditure": "7650.00", "net_payable": "7573.50" },
    { "month": "2026-04", "total_expenditure": "9200.00", "net_payable": "9108.00" },
    { "month": "2026-05", "total_expenditure": "8870.00", "net_payable": "8781.30" },
    { "month": "2026-06", "total_expenditure": "7300.00", "net_payable": "7227.00" }
  ]
}
```

> `by_vendor` is sorted descending by `total_expenditure` so the largest cost contributor appears first in the bar chart.

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `INVALID_DATE_RANGE` | `date_from` must be before or equal to `date_to`. |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Only the Managing Director can access the vendor expense dashboard. |

---

## AR Review Loop (Wave 3 - UC-08)

> **Implementation note:** Endpoints 8-11 were built by Kwan Hua in `backend/src/controllers/memoReviewController.js`, but are registered on this document's `serviceMemoRoutes.js` router, so they are documented here to keep the route file and its docs in sync. See `design/kwan-hua/` for the AR-side design of the pricing match itself; this section only covers the memo review/return/resubmit surface that touches `service_memos`.

## 8. GET `/api/service-memos/pending-review`

**Purpose:** Returns the AR Specialist's review queue - memos with `status: 'submitted'`, i.e. awaiting a first review or a re-review after correction. This is distinct from `GET /api/service-memos?status=submitted` (endpoint 4) in that it always returns Booking/Client context needed for the review list UI and computes a queue age from the *resubmission* time (not the original creation time) when the memo was previously returned and corrected, so time spent with the crew fixing it isn't charged against Sarah's SLA.

**Auth required:** Yes - roles: `ar_specialist`, `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `page` | integer | No | Page number, default `1` |
| `limit` | integer | No | Results per page, default `20`, max `100` |

**Success response `200 OK`:**
```json
{
  "data": [
    {
      "id": 55,
      "booking_id": 88,
      "booking_reference": "BK-2026-0088",
      "client_name": "Tan Tock Seng Hospital",
      "job_date": "2026-06-22",
      "service_type": "eas",
      "transfer_type": "one_way_hospital",
      "submitted_at": "2026-06-22T10:48:05.000Z",
      "was_returned": false,
      "resubmitted_at": null,
      "queued_since": "2026-06-22T10:48:05.000Z",
      "hours_since_submission": 2.3
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20 }
}
```

> `was_returned` is `true` when the memo has been through at least one return/resubmit cycle (`returned_at` is set). `queued_since` is `resubmitted_at` when present, otherwise the memo's original `created_at`.

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Role not permitted to view the memo review queue. |
| 500 | `INTERNAL_ERROR` | Unexpected server error. |

---

## 9. PATCH `/api/service-memos/:id/approve`

**Purpose:** Approves a memo in `submitted` status and runs the pricing engine in one transaction, creating the linked `invoices` (and `invoice_line_items`) record. Memo status advances to `reviewed`. Several outcomes are possible depending on whether an active pricing contract/rate/quotation match exists - all are returned as `200 OK` with a `warning` object rather than an error, because the memo has genuinely been approved and an invoice genuinely was created even when the base charge could not be auto-priced.

**Auth required:** Yes - roles: `ar_specialist`

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | integer | Service memo ID |

**Success response `200 OK`** (fully matched):
```json
{
  "memo_id": 55,
  "memo_status": "reviewed",
  "invoice": {
    "id": 12,
    "status": "matched",
    "subtotal": "480.00",
    "gst_rate_percent": "9.00",
    "gst_effective_date": "2024-01-01",
    "tax_amount": "43.20",
    "total_amount": "523.20",
    "unpriced_surcharges": [],
    "line_items": [
      {
        "id": 1,
        "description": "EAS one-way hospital transfer (office hours)",
        "quantity": "1.00",
        "unit_price": "480.00",
        "amount": "480.00",
        "is_manual_adjustment": false,
        "was_manually_edited": false
      }
    ]
  }
}
```

**Success response `200 OK`** (no active contract / no matching rate / quotation mismatch - base left unpriced, recorded surcharges still priced):
```json
{
  "memo_id": 55,
  "memo_status": "reviewed",
  "invoice": {
    "id": 12,
    "status": "unmatched",
    "unpriced_surcharges": [],
    "line_items": []
  },
  "warning": {
    "code": "NO_ACTIVE_CONTRACT",
    "message": "Invoice #12 needs the base charge because no active contract covers this client's service date. Recorded surcharges have been priced. Create or activate the contract, then retry matching from the invoice; alternatively, price the base manually."
  }
}
```

> Other possible `warning.code` values: `QUOTATION_MISMATCH` (the completed service doesn't match the service combination a one-off quotation was sold for), `NO_MATCHING_RATE` (an active contract exists but has no rate row for this service/transfer/time-of-day combination), and `UNPRICED_SURCHARGES` (a quoted booking recorded surcharges the published schedule has no rate for).

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 404 | `NOT_FOUND` | No memo with this id. |
| 409 | `MEMO_RETURNED` | Memo was returned to the crew for correction and has not been resubmitted yet - it cannot be approved. |
| 409 | `MEMO_ALREADY_REVIEWED` | Memo has already been approved or an invoice already exists for it. |
| 409 | `INVOICE_SOURCE_MISSING` | The memo has no scheduled service date, so the applicable GST rate cannot be determined. |
| 422 | `GST_RATE_NOT_CONFIGURED` / `INVALID_GST_DATE` | No GST rate is configured for the invoice's tax date, or the date is invalid. |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Role not permitted to approve memos. |
| 500 | `INTERNAL_ERROR` | Unexpected server error. |

---

## 10. PATCH `/api/service-memos/:id/return`

**Purpose:** Returns a `submitted` memo to the field crew with a mandatory correction note (UC-08). Sets `status: 'returned'`, `ar_note` to the supplied note, `reviewed_by` to the reviewing AR Specialist, and `returned_at` to now. The memo leaves the review queue (`GET /pending-review`, endpoint 8) until the crew resubmits it. Queues an in-app notification (`memo_returned`) for the submitting crew member.

A memo that already has *any* invoice record - not only an approved/synced one - cannot be returned; the return is rejected outright rather than allowed to strand the invoice.

**Auth required:** Yes - roles: `ar_specialist`

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | integer | Service memo ID |

**Request body:**
```json
{
  "note": "Overtime hours don't match the job start/end times recorded - please confirm and correct."
}
```

**Success response `200 OK`:**
```json
{
  "memo_id": 55,
  "memo_status": "returned",
  "note_recorded": true
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `VALIDATION_ERROR` | `note` is required to return a memo. |
| 404 | `NOT_FOUND` | No memo with this id. |
| 409 | `MEMO_ALREADY_INVOICED` | Memo is linked to invoice #N, which has already been approved/synced to Xero - it cannot be returned (raise a credit note in Xero instead); or, if the invoice is not yet approved/synced, that the memo has already generated an invoice and should be corrected via that invoice or a rejected match instead. |
| 409 | `MEMO_ALREADY_RETURNED` | Memo has already been returned to the crew and is awaiting their correction. |
| 409 | `MEMO_NOT_SUBMITTED` | Only a memo in `submitted` status can be returned (this one is `<current status>`). |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Role not permitted to return memos. |
| 500 | `INTERNAL_ERROR` | Unexpected server error. |

---

## 11. PATCH `/api/service-memos/:id/resubmit`

**Purpose:** The field crew's half of the return loop (UC-08). Corrects a `returned` memo's billing-relevant fields and puts it back into the AR review queue. Sets `status: 'submitted'`, clears `ar_note` back to `null`, and sets `resubmitted_at` to now. `returned_at` is retained as the permanent audit record that the memo was bounced at least once. Queues an in-app notification (`memo_submitted`) for the AR Specialist.

Only pricing-relevant fields are correctable - identity fields (`booking_id`, `submitted_by`) and the signature cannot be changed, since a correction restates what happened on the job rather than creating a new memo. Correctable fields: `job_start_time`, `job_end_time`, `overtime_hours`, `evacuation_floors`, `patient_name`, `hospital_destination`, `additional_charges_notes`, `hospital_stamp_image_url`, `service_type`, `transfer_type`, `is_office_hours`, `oxygen_litres_used`, `has_inconvenience_fee`, `disposables_used`, `resuscitation_performed`, `suction_performed`, `waiting_time_minutes`, `patient_weight_kg`, `is_jurong_island`. Only fields present in the request body are updated - omitted fields keep their existing value.

**Auth required:** Yes - roles: `field_crew`, `managing_director` (MD included so a stuck memo can be unblocked without the original crew member)

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | integer | Service memo ID |

**Request body** (only the corrected fields need to be sent):
```json
{
  "overtime_hours": 1.25,
  "additional_charges_notes": "Corrected per AR note - end time confirmed with dispatch log."
}
```

**Success response `200 OK`:**
```json
{
  "memo_id": 55,
  "memo_status": "submitted",
  "fields_updated": ["overtime_hours", "additional_charges_notes"]
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 404 | `NOT_FOUND` | No memo with this id (also returned when a field crew member requests a memo id that isn't their own, so the endpoint can't be used to probe which ids exist). |
| 409 | `MEMO_NOT_RETURNED` | Only a memo in `returned` status can be resubmitted (this one is `<current status>`). |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Role not permitted to resubmit memos. |
| 500 | `INTERNAL_ERROR` | Unexpected server error. |

---

## 12. GET `/api/dashboard/revenue-leakage`

**Purpose:** Reports estimated unbilled revenue from surcharges the field crew recorded on a memo that the client's active contract (or the published schedule) had no rate for (`invoices.unpriced_surcharges`). Values are explicitly labelled as **estimates**: each unpriced surcharge is priced at the median rate other active contracts charge for the same surcharge type; items with no reference rate anywhere in the system are counted but valued at zero.

**Auth required:** Yes - roles: `managing_director`, `ar_specialist` (the AR Specialist is the one who fixes the flagged contracts, so the report isn't gated to a role that can't act on it)

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date_from` | string (YYYY-MM-DD) | No | Filter by invoice `created_at` from this date. Defaults to start of current calendar year. |
| `date_to` | string (YYYY-MM-DD) | No | Filter by invoice `created_at` up to this date. Defaults to today. |

**Success response `200 OK`:**
```json
{
  "period": { "from": "2026-01-01", "to": "2026-06-22" },
  "summary": {
    "estimated_leakage": "640.00",
    "affected_invoice_count": 4,
    "unpriced_item_count": 5,
    "top_recommendation": "Acme Corp Contract is missing 2 surcharge rate(s), accounting for an estimated $420.00 of unbilled charges across 3 invoice(s)."
  },
  "by_surcharge_type": [
    {
      "surcharge_type": "oxygen_per_litre",
      "label": "Oxygen (per litre above 10L)",
      "occurrences": 3,
      "total_quantity": 15,
      "unit_rate": "2.50",
      "basis": "peer_median",
      "estimated_amount": "220.00"
    }
  ],
  "by_contract": [
    {
      "contract_id": 4,
      "contract_name": "Acme Corp Contract",
      "client_id": 9,
      "client_name": "Acme Corp",
      "affected_invoices": 3,
      "missing_surcharge_types": ["oxygen_per_litre", "suction_fee"],
      "estimated_amount": "420.00"
    }
  ],
  "affected_invoices": [
    {
      "invoice_id": 12,
      "client_id": 9,
      "client_name": "Acme Corp",
      "contract_id": 4,
      "created_at": "2026-06-22T10:48:05.000Z",
      "unpriced_count": 2,
      "estimated_amount": "220.00"
    }
  ],
  "reference_rates": {
    "oxygen_per_litre": { "median": 2.50, "sampleSize": 6, "min": 2.00, "max": 3.00 }
  },
  "basis_note": "Amounts are estimates. Unpriced surcharges have no contracted rate by definition, so each is valued at the median rate other contracts charge for the same surcharge type. Items with no reference rate anywhere in the system are counted but valued at zero."
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `date_from must be in YYYY-MM-DD format` / `date_to must be in YYYY-MM-DD format` | Malformed date query param. |
| 400 | `date_from must be before or equal to date_to.` | Invalid range. |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Role not permitted to view the revenue leakage report. |

---

## 13. GET `/api/dashboard/cycle-time`

**Purpose:** Reports the average time, per stage, from job completion through to a successful Xero sync (`job_to_memo`, `memo_to_invoice`, `invoice_to_sync`), plus an overall average. Backs both the Fleet Overview KPI and the Reports "Billing Cycle" tab (the latter renders the `rows` array as a table instead of only the averages). A booking only appears once its `job_completed` milestone has been recorded; unresolved later stages report `null` rather than a partial duration.

**Auth required:** Yes - roles: `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date_from` | string (YYYY-MM-DD) | No | Filter by `job_completed` milestone date. Defaults to start of current calendar year. |
| `date_to` | string (YYYY-MM-DD) | No | Filter by `job_completed` milestone date. Defaults to today. |

**Success response `200 OK`:**
```json
{
  "period": { "from": "2026-01-01", "to": "2026-06-22" },
  "booking_count": 1,
  "stage_averages_days": { "job_to_memo": 0.08, "memo_to_invoice": 0.5, "invoice_to_sync": 0.2 },
  "overall_average_days": 0.78,
  "rows": [
    {
      "booking_id": 88,
      "job_completed_at": "2026-06-22T10:45:00.000Z",
      "memo_submitted_at": "2026-06-22T10:48:05.000Z",
      "invoice_approved_at": "2026-06-22T11:20:00.000Z",
      "synced_at": "2026-06-22T11:35:00.000Z",
      "total_days": 0.78
    }
  ]
}
```

> If no `job_completed` milestones fall in the window, the response is the same shape with `booking_count: 0`, all `stage_averages_days`/`overall_average_days` set to `null`, and `rows: []`.

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `date_from must be in YYYY-MM-DD format` / `date_to must be in YYYY-MM-DD format` | Malformed date query param. |
| 400 | `date_from must be before or equal to date_to.` | Invalid range. |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Only the Managing Director can access the billing cycle report. |

---

## 14. GET `/api/dashboard/xero-health`

**Purpose:** Surfaces Xero sync health on the Executive Dashboard: counts of invoices `synced_to_xero`, `approved` (pending sync), and `failed`; the timestamp of the most recent successful sync; and whether the integration is currently running in simulated or live mode.

**Auth required:** Yes - roles: `managing_director`

**Success response `200 OK`:**
```json
{
  "counts": { "synced": 8, "pending": 2, "failed": 0 },
  "last_synced_at": "2026-06-22T11:35:00.000Z",
  "mode": "simulated"
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Only the Managing Director can access Xero health. |

---

## 15. GET `/api/dashboard/revenue-trend`

**Purpose:** Invoiced revenue over time, bucketed by week or month. Only counts invoices that reached `synced_to_xero`, since anything earlier in the pipeline is not confirmed revenue. Defaults to the trailing 12 months (or trailing 12 weeks when `granularity=week`).

**Auth required:** Yes - roles: `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `granularity` | string | No | `month` (default) or `week` |

**Success response `200 OK`:**
```json
{
  "granularity": "month",
  "from": "2025-06-22",
  "to": "2026-06-22",
  "trend": [
    { "bucket": "2026-05", "total_revenue": "8200.00" },
    { "bucket": "2026-06", "total_revenue": "523.20" }
  ]
}
```

> `bucket` is `YYYY-MM` for `granularity=month`, or the Monday date (`YYYY-MM-DD`) of the ISO week for `granularity=week`.

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `granularity must be one of: month, week` | Invalid `granularity` value. |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Only the Managing Director can access the revenue trend. |

---

## 16. GET `/api/dashboard/top-clients`

**Purpose:** Top 5 clients by invoiced (`synced_to_xero`) revenue, all-time. Each client's `booking_count` counts only bookings that reached `invoiced` status - not total booking volume - so a cancelled or never-invoiced booking doesn't skew the revenue-per-booking read.

**Auth required:** Yes - roles: `managing_director`

**Success response `200 OK`:**
```json
{
  "top_clients": [
    {
      "client_id": 9,
      "client_name": "Acme Corp",
      "total_revenue": "12400.00",
      "invoice_count": 6,
      "booking_count": 6
    }
  ]
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Only the Managing Director can access the top clients list. |

---

## 17. GET `/api/dashboard/revenue-by-service-type`

**Purpose:** Backs the Reports "Revenue by Service Type" donut chart - revenue breakdown by the booking's `service_type`, joined in via the memo's linked booking (implemented here rather than extending `GET /api/invoices` so the change stays inside this feature area's owned files).

**Auth required:** Yes - roles: `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date_from` | string (YYYY-MM-DD) | No | Filter by invoice `created_at` from this date. Defaults to start of current calendar year. |
| `date_to` | string (YYYY-MM-DD) | No | Filter by invoice `created_at` up to this date. Defaults to today. |

**Success response `200 OK`:**
```json
{
  "period": { "from": "2026-01-01", "to": "2026-06-22" },
  "breakdown": [
    { "service_type": "eas", "label": "Emergency Ambulance Services (EAS)", "total_revenue": "8200.00" },
    { "service_type": "mts", "label": "Medical Transport Service (MTS)", "total_revenue": "2100.00" }
  ]
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `date_from must be in YYYY-MM-DD format` / `date_to must be in YYYY-MM-DD format` | Malformed date query param. |
| 400 | `date_from must be before or equal to date_to.` | Invalid range. |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Only the Managing Director can access the revenue by service type report. |

---

## 18. GET `/api/dashboard/leakage-history`

**Purpose:** The same unpriced-surcharge data as `revenue-leakage` (endpoint 12), grouped into monthly buckets instead of a single aggregate. Backs the Reports "Leakage History" tab.

**Auth required:** Yes - roles: `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date_from` | string (YYYY-MM-DD) | No | Filter by invoice `created_at` from this date. Defaults to start of current calendar year. |
| `date_to` | string (YYYY-MM-DD) | No | Filter by invoice `created_at` up to this date. Defaults to today. |

**Success response `200 OK`:**
```json
{
  "period": { "from": "2026-01-01", "to": "2026-06-22" },
  "history": [
    {
      "month": "2026-06",
      "estimated_leakage": 220.00,
      "affected_invoice_count": 1,
      "rows": [
        {
          "invoice_id": 12,
          "booking_reference": "BK-2026-0088",
          "client_name": "Acme Corp",
          "created_at": "2026-06-22T10:48:05.000Z",
          "unpriced_count": 2,
          "estimated_amount": 220.00
        }
      ]
    }
  ]
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `date_from must be in YYYY-MM-DD format` / `date_to must be in YYYY-MM-DD format` | Malformed date query param. |
| 400 | `date_from must be before or equal to date_to.` | Invalid range. |
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Only the Managing Director can access the leakage history report. |

---

## 19. GET `/api/dashboard/crew-positions`

**Purpose:** Backs the Live Fleet Tracker map - one row per field crew member (`role: 'field_crew'`) with a status derived from their current job (if any) and a simulated GPS position. A crew member with no active job renders at HQ (`available` if recently active, `off_duty` otherwise, "online" using the same 5-minute threshold as Accounts Management's "Currently Online"). A crew member on an `in_progress` booking renders `on_scene` (at pickup or destination) or `en_route` (between the two), positioned from the booking's recorded `JobMilestone` events rather than a fabricated animation timer - the pin only moves when a real milestone was tapped.

**Auth required:** Yes - roles: `managing_director`

**Success response `200 OK`:**
```json
[
  {
    "id": 3,
    "name": "Ravi Kumar",
    "status": "en_route",
    "position": { "lat": 1.3521, "lng": 103.8198 },
    "current_job_reference": "BK-2026-0088",
    "last_updated": "2026-06-22T10:50:00.000Z"
  },
  {
    "id": 7,
    "name": "Ah Huat",
    "status": "available",
    "position": { "lat": 1.3644, "lng": 103.9915 },
    "current_job_reference": null,
    "last_updated": "2026-06-22T10:50:00.000Z"
  }
]
```

> Unlike every other endpoint in this document, the success response is a bare array, not `{ data: [...] }` - this matches the controller's actual `success(res, results)` call.

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid token. |
| 403 | `FORBIDDEN` | Only the Managing Director can access the fleet tracker. |

---

## Dev Authentication Reference

### Shared Secret

Add the following to your local `.env` file. All teammates must use this same value so test tokens work across every local setup.

```
DEV_JWT_SECRET=dev-secret-efar-2026
```

### JWT Payload Shape

All tokens use the following payload structure:

```json
{
  "sub":   <integer - user ID>,
  "name":  "<display name>",
  "email": "<email>",
  "role":  "<role slug>",
  "iat":   <unix timestamp - issued at>,
  "exp":   <unix timestamp - expires at>
}
```

### Canonical User ID Map

| `users.id` | Name | Role |
|-----------|------|------|
| 1 | Sarah Tan | `ar_specialist` |
| 2 | Doris Ching | `managing_director` |
| 3 | Ravi Kumar | `field_crew` |
| 4 | Chloe Lim | `ap_specialist` |
| 5 | Camilla Ng | `quotations_specialist` |

This mapping is shared across all teammates. All seed files and JWT tokens use these IDs.

### Pre-signed Test Tokens

All tokens are signed with `HS256` using `DEV_JWT_SECRET=dev-secret-efar-2026` and expire **2027-06-22**.

---

#### Field Crew - Ravi Kumar (`sub: 3`)

Use this token to test `POST /api/service-memos`, `POST /api/service-memos/upload-signature`, `POST /api/service-memos/upload-hospital-stamp`, and `PATCH /api/bookings/:id/status` (`confirmed → in_progress`, `in_progress → completed` transitions).

**Payload:**
```json
{
  "sub": 3,
  "name": "Ravi Kumar",
  "email": "ravi@efar.sg",
  "role": "field_crew",
  "iat": 1782114425,
  "exp": 1813650425
}
```

**Token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsIm5hbWUiOiJSYXZpIEt1bWFyIiwiZW1haWwiOiJyYXZpQGVmYXIuc2ciLCJyb2xlIjoiZmllbGRfY3JldyIsImlhdCI6MTc4MjExNDQyNSwiZXhwIjoxODEzNjUwNDI1fQ.9Ot7uSJ_sLL-pGT_yaVkQwBGyVZkhmVjAQr7o6Nqx7g
```

---

#### AR Specialist - Sarah Tan (`sub: 1`)

Use this token to test `GET /api/service-memos` (review queue) and `GET /api/service-memos/:id`.

**Payload:**
```json
{
  "sub": 1,
  "name": "Sarah Tan",
  "email": "sarah@efar.sg",
  "role": "ar_specialist",
  "iat": 1782114425,
  "exp": 1813650425
}
```

**Token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsIm5hbWUiOiJTYXJhaCBUYW4iLCJlbWFpbCI6InNhcmFoQGVmYXIuc2ciLCJyb2xlIjoiYXJfc3BlY2lhbGlzdCIsImlhdCI6MTc4MjExNDQyNSwiZXhwIjoxODEzNjUwNDI1fQ.ESzmUh8-f6nRvC0MH0c3t13hSEfeapsAYD4ResqL4pM
```

---

#### Managing Director - Doris Ching (`sub: 2`)

**Payload:**
```json
{
  "sub": 2,
  "name": "Doris Ching",
  "email": "doris@efar.sg",
  "role": "managing_director",
  "iat": 1782114425,
  "exp": 1813650425
}
```

**Token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsIm5hbWUiOiJEb3JpcyBDaGluZyIsImVtYWlsIjoiZG9yaXNAZWZhci5zZyIsInJvbGUiOiJtYW5hZ2luZ19kaXJlY3RvciIsImlhdCI6MTc4MjExNDQyNSwiZXhwIjoxODEzNjUwNDI1fQ.k452ZYTHp373ilcJKalsXLlKWQ7Df1c_kJ9F2JIsJzM
```
