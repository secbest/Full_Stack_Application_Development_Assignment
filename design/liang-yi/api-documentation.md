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
| `status` | string | No | Filter by status: `submitted`, `reviewed`, `invoiced` |
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
