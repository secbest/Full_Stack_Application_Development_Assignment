# API Documentation - Zheng Bao

**Feature Area:** Customer Intake & Booking Management

All endpoints are prefixed with `/api`. All endpoints require a valid JWT in the `Authorization: Bearer <token>` header **unless stated otherwise** (the intake submission endpoint is public).

Error responses always use the shape:
```json
{ "error": "ERROR_CODE", "message": "Human-readable description" }
```

---

## Table of Contents

1. [Intake Submissions](#1-intake-submissions)
2. [Bookings](#2-bookings)
3. [Job Status Transitions - Cross-Team Endpoints](#3-job-status-transitions---cross-team-endpoints)
4. [Notifications](#4-notifications)
5. [Dev Auth Reference](#5-dev-auth-reference)

---

## 1. Intake Submissions

### `POST /api/intake`

**Purpose:** Customer submits a service request through the public intake portal (UC-01). Creates a new `intake_submissions` record with status `pending` and `service_tier` set to `null`, and fires an in-app notification to Camilla (UC-09-A).

**Auth required:** No - this is a public endpoint. No JWT needed.

**Request body:**
```json
{
  "customer_name": "John Tan",
  "organisation": "Changi General Hospital",
  "contact_email": "john.tan@cgh.com.sg",
  "contact_phone": "91234567",
  "service_type": "eas",
  "preferred_date": "2026-07-05",
  "preferred_time": "14:30",
  "pickup_location": "Changi General Hospital, 2 Simei Street 3, Singapore 529889",
  "destination": "Singapore General Hospital, Outram Road, Singapore 169608",
  "additional_notes": "Patient requires oxygen support during transfer."
}
```

**Field validation rules:**

| Field | Rule |
|-------|------|
| `customer_name` | Required, non-empty string |
| `contact_email` | Required, valid email format |
| `contact_phone` | Required, 8-digit Singapore number |
| `service_type` | Required, one of `eas`, `mts`, `event_standby`, `workplace_standby` |
| `preferred_date` | Required, `YYYY-MM-DD`, must not be in the past |
| `preferred_time` | Required, `HH:MM` format |
| `pickup_location` | Required, non-empty string |
| `destination` | Required, non-empty string |
| `organisation` | Optional |
| `additional_notes` | Optional |

**Note:** The customer never submits `service_tier`. The backend hardcodes it to `null` on creation - Camilla (Quotations) assigns the tier later when confirming the intake (see `POST /api/intake/:id/confirm` below and UC-05).

**Success response `201`:**
```json
{
  "data": {
    "id": 7,
    "reference_number": "EFAR-2026-00007",
    "status": "pending",
    "message": "Your request has been received. Our team will be in touch shortly.",
    "created_at": "2026-06-22T10:15:00.000Z"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | Any required field missing or failing format checks; response includes field-level errors |
| `400` | `PAST_DATE` | `preferred_date` is before today |
| `409` | `DUPLICATE_SUBMISSION` | A submission with the same `contact_email`, `preferred_date`, and `pickup_location` was received within the last 10 minutes; response includes the existing `reference_number` |

---

### `GET /api/intake`

**Purpose:** List all intake submissions in the queue. Defaults to `pending` status to show Camilla's active workload. Supports filtering and search (UC-02).

**Auth required:** Yes

**Allowed roles:** `quotations_specialist`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | One of `pending`, `confirmed`, `rejected`. Default: `pending` |
| `service_type` | string | No | Filter by service type |
| `service_tier` | string | No | Filter by service tier |
| `search` | string | No | Partial match on `customer_name` or `reference_number` |
| `page` | integer | No | Default `1` |
| `limit` | integer | No | Default `20` |

**Success response `200`:**
```json
{
  "data": [
    {
      "id": 7,
      "reference_number": "EFAR-2026-00007",
      "customer_name": "John Tan",
      "organisation": "Changi General Hospital",
      "service_type": "eas",
      "service_tier": null,
      "preferred_date": "2026-07-05",
      "preferred_time": "14:30",
      "status": "pending",
      "hours_since_submission": 1.2,
      "created_at": "2026-06-22T10:15:00.000Z"
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20 }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `INVALID_STATUS` | `status` value is not a valid ENUM |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `GET /api/intake/:id`

**Purpose:** Get the full detail of a single intake submission before Camilla takes action (UC-02, UC-03, UC-04).

**Auth required:** Yes

**Allowed roles:** `quotations_specialist`

**Success response `200`:**
```json
{
  "data": {
    "id": 7,
    "reference_number": "EFAR-2026-00007",
    "customer_name": "John Tan",
    "organisation": "Changi General Hospital",
    "contact_email": "john.tan@cgh.com.sg",
    "contact_phone": "91234567",
    "service_type": "eas",
    "service_tier": null,
    "preferred_date": "2026-07-05",
    "preferred_time": "14:30",
    "pickup_location": "Changi General Hospital, 2 Simei Street 3, Singapore 529889",
    "destination": "Singapore General Hospital, Outram Road, Singapore 169608",
    "additional_notes": "Patient requires oxygen support during transfer.",
    "status": "pending",
    "rejection_reason": null,
    "reviewed_by": null,
    "reviewed_at": null,
    "linked_booking": null,
    "created_at": "2026-06-22T10:15:00.000Z"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `SUBMISSION_NOT_FOUND` | No intake submission with this id |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `POST /api/intake/:id/confirm`

**Purpose:** Camilla confirms a valid intake submission, which creates a new `bookings` record linked to it (UC-03). The customer never chose a `service_tier` at submission - Camilla assigns it here for the first time as part of confirmation (UC-05). The intake status updates to `confirmed`.

**Auth required:** Yes

**Allowed roles:** `quotations_specialist`

**Request body:**
```json
{
  "service_tier": "critical",
  "pricing_source": "one_off_quote",
  "quoted_transfer_type": "one_way_hospital",
  "quoted_time_of_day": "office_hours",
  "quoted_base_amount": 725.50,
  "scheduled_date": "2026-07-05",
  "scheduled_time": "14:30",
  "pickup_location": "Changi General Hospital, 2 Simei Street 3, Singapore 529889",
  "destination": "Singapore General Hospital, Outram Road, Singapore 169608",
  "notes": "Upgraded to Critical - ICU transfer confirmed with patient's doctor."
}
```

**Field notes:**
- `service_tier` is required. Since the intake submission itself never has a tier (it is `null` until this point), `service_tier` here is Camilla's first and only assignment of the tier, not an edit of a customer-selected value. `original_service_tier` on the resulting booking is only ever populated if `intake.service_tier` was non-null and differs from the confirmed value - in the current flow that means it stays `null` for submissions created through the public intake form.
- `pricing_source` is required: `contract` resolves the active client contract rate, while `one_off_quote` freezes the explicitly agreed `quoted_base_amount`.
- `quoted_transfer_type` and `quoted_time_of_day` are required and become the service combination AR checks against the completed memo.
- `quoted_base_amount` is required and positive for `one_off_quote`; it is ignored for `contract` because the backend resolves the matching contract rate.
- `scheduled_date` and `scheduled_time` default to `preferred_date` and `preferred_time` from the intake if omitted.
- `pickup_location` and `destination` default to the intake values if omitted.
- `notes` is optional.

**Success response `201`:**
```json
{
  "data": {
    "intake_submission": {
      "id": 7,
      "reference_number": "EFAR-2026-00007",
      "status": "confirmed"
    },
    "booking": {
      "id": 8,
      "reference_number": "BKG-2026-00008",
      "client_id": 3,
      "service_type": "eas",
      "service_tier": "critical",
      "original_service_tier": null,
      "scheduled_date": "2026-07-05",
      "scheduled_time": "14:30",
      "pickup_location": "Changi General Hospital, 2 Simei Street 3, Singapore 529889",
      "destination": "Singapore General Hospital, Outram Road, Singapore 169608",
      "assigned_crew_id": null,
      "status": "confirmed",
      "notes": "Upgraded to Critical - ICU transfer confirmed with patient's doctor.",
      "created_at": "2026-06-22T11:00:00.000Z"
    }
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | `service_tier` is missing or invalid |
| `422` | `NO_ACTIVE_CONTRACT` | Contract pricing was selected but no active client contract covers the service date |
| `422` | `NO_MATCHING_RATE` | The active contract does not price the selected service, transfer, and time combination |
| `400` | `PAST_DATE` | `scheduled_date` is before today |
| `404` | `SUBMISSION_NOT_FOUND` | No intake submission with this id |
| `409` | `ALREADY_ACTIONED` | Intake has already been confirmed or rejected |
| `409` | `DUPLICATE_BOOKING` | The same client already has an active booking on the same date and location; response includes the existing `booking_reference` for Camilla to verify |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `POST /api/intake/:id/reject`

**Purpose:** Camilla rejects an intake submission with a mandatory reason (UC-04). The intake status updates to `rejected`. A rejection email is sent to the customer.

**Auth required:** Yes

**Allowed roles:** `quotations_specialist`

**Request body:**
```json
{
  "rejection_reason": "Location is outside EFAR service area."
}
```

**Success response `200`:**
```json
{
  "data": {
    "id": 7,
    "reference_number": "EFAR-2026-00007",
    "status": "rejected",
    "rejection_reason": "Location is outside EFAR service area.",
    "reviewed_by": 5,
    "reviewed_at": "2026-06-22T11:30:00.000Z"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | `rejection_reason` is missing or empty |
| `404` | `SUBMISSION_NOT_FOUND` | No intake submission with this id |
| `409` | `ALREADY_ACTIONED` | Intake has already been confirmed or rejected |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `DELETE /api/intake/:id`

**Purpose:** Camilla permanently removes a rejected intake submission that is no longer needed (e.g. clearing test data or a duplicate rejected entry). Only rejected submissions can be deleted - a `pending` submission is still awaiting a decision, and a `confirmed` submission already produced a linked `Booking`, so deleting either out from under the Intake Queue would destroy work in progress or leave a booking pointing at nothing.

**Auth required:** Yes

**Allowed roles:** `quotations_specialist`

**Request body:** None required.

**Success response `200`:**
```json
{
  "data": {
    "id": 7,
    "reference_number": "EFAR-2026-00007"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `SUBMISSION_NOT_FOUND` | No intake submission with this id |
| `409` | `INTAKE_NOT_REJECTED` | Submission is not in `rejected` status - only rejected submissions can be deleted |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

## 2. Bookings

### `GET /api/bookings`

**Purpose:** List all bookings with optional filtering and sorting. Used by Camilla (operations), Sarah (AR status tracking), and Doris (executive overview) (UC-07).

**Auth required:** Yes

**Allowed roles:** `quotations_specialist`, `ar_specialist`, `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | One of `confirmed`, `in_progress`, `completed`, `invoiced` |
| `service_type` | string | No | Filter by service type |
| `service_tier` | string | No | Filter by service tier |
| `client_id` | integer | No | Filter by client |
| `assigned_crew_id` | integer | No | Filter by assigned crew member |
| `from_date` | date | No | Filter `scheduled_date` range start (`YYYY-MM-DD`) |
| `to_date` | date | No | Filter `scheduled_date` range end (`YYYY-MM-DD`) |
| `search` | string | No | Partial match on `reference_number` or client name |
| `page` | integer | No | Default `1` |
| `limit` | integer | No | Default `20` |

**Success response `200`:**
```json
{
  "data": [
    {
      "id": 8,
      "reference_number": "BKG-2026-00008",
      "client_name": "Changi General Hospital",
      "service_type": "eas",
      "service_tier": "critical",
      "scheduled_date": "2026-07-05",
      "scheduled_time": "14:30",
      "assigned_crew_name": null,
      "status": "confirmed",
      "has_memo": false,
      "has_invoice": false,
      "memo_pending_hours": null,
      "created_at": "2026-06-22T11:00:00.000Z"
    }
  ],
  "meta": { "total": 8, "page": 1, "limit": 20 }
}
```

**Notes on response fields:**
- `has_memo` - `true` if a `service_memos` record is linked to this booking (Liang Yi's table).
- `memo_pending_hours` - number of hours since the booking reached `completed` status with no linked memo. Null if memo exists or booking is not yet completed. Used to render the revenue leakage highlight in the booking list (UC-07 edge case).

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `INVALID_STATUS` | `status` value is not a valid ENUM |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `GET /api/bookings/my-jobs`

**Purpose:** Field Crew's "My Jobs" screen - returns only the authenticated crew member's own assigned bookings, with their recorded job milestones, so a crew member never needs to page through the full booking list to find their work.

**Auth required:** Yes

**Allowed roles:** `field_crew`, `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `date_filter` | string | No | One of `today`, `tomorrow`, `this_week`. Omit to return all upcoming jobs. |

**Success response `200`:**
```json
{
  "data": [
    {
      "id": 8,
      "reference_number": "BKG-2026-00008",
      "client": { "id": 3, "name": "Changi General Hospital" },
      "service_type": "eas",
      "service_tier": "critical",
      "scheduled_date": "2026-07-05",
      "scheduled_time": "14:30",
      "pickup_location": "Changi General Hospital, 2 Simei Street 3, Singapore 529889",
      "destination": "Singapore General Hospital, Outram Road, Singapore 169608",
      "status": "confirmed",
      "milestones": [
        { "milestone_type": "activated", "recorded_at": "2026-07-05T14:32:00.000Z" }
      ]
    }
  ]
}
```

**Notes on response fields:**
- `milestones` is sorted by the fixed job sequence (`activated` → `arrived_at_location` → `en_route` → `arrived_at_destination` → `job_completed`), not by database insertion order.
- The query is scoped to `assigned_crew_id = req.user.sub` - there is no way for one crew member to list another's jobs through this endpoint.

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `GET /api/bookings/:id`

**Purpose:** Get the full detail of a single booking including linked intake, memo, and invoice references (UC-08).

**Auth required:** Yes

**Allowed roles:** `field_crew`, `ar_specialist`, `managing_director`. Note: `quotations_specialist` is **not** in this route's role list - Camilla does not have direct access to single-booking detail via this endpoint, only the list view (`GET /api/bookings`). `field_crew` is allowed, but scoped to their own assigned booking only - a crew member requesting another crew's booking id gets `403 FORBIDDEN`.

**Success response `200`:**
```json
{
  "data": {
    "id": 8,
    "reference_number": "BKG-2026-00008",
    "intake_submission_id": 7,
    "intake_reference": "EFAR-2026-00007",
    "client_id": 3,
    "client_name": "Changi General Hospital",
    "service_type": "eas",
    "service_tier": "critical",
    "original_service_tier": null,
    "scheduled_date": "2026-07-05",
    "scheduled_time": "14:30",
    "pickup_location": "Changi General Hospital, 2 Simei Street 3, Singapore 529889",
    "destination": "Singapore General Hospital, Outram Road, Singapore 169608",
    "assigned_crew_id": null,
    "assigned_crew_name": null,
    "status": "confirmed",
    "notes": "Upgraded to Critical - ICU transfer confirmed with patient's doctor.",
    "linked_memo": null,
    "linked_invoice": null,
    "created_by": 5,
    "created_at": "2026-06-22T11:00:00.000Z",
    "updated_at": "2026-06-22T11:00:00.000Z"
  }
}
```

**Notes on response fields:**
- `linked_memo` - if a memo exists, returns `{ "memo_id": 3, "status": "reviewed" }`. Null otherwise.
- `linked_invoice` - if an invoice exists, returns `{ "invoice_id": 3, "status": "synced_to_xero", "xero_sync_failed": false }`. Null otherwise.
- `original_service_tier` - null when Camilla confirmed the booking without changing the tier.

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `BOOKING_NOT_FOUND` | No booking with this id |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `PATCH /api/bookings/:id/crew`

**Purpose:** Camilla assigns or reassigns a crew member to a confirmed booking (UC-06). Can also be called to clear the assignment (set to null) if a crew member becomes unavailable.

**Auth required:** Yes

**Allowed roles:** `quotations_specialist`

**Request body:**
```json
{ "assigned_crew_id": 3 }
```

Send `"assigned_crew_id": null` to remove the current assignment.

**Success response `200`:**
```json
{
  "data": {
    "id": 8,
    "reference_number": "BKG-2026-00008",
    "assigned_crew_id": 3,
    "assigned_crew_name": "Ravi Kumar",
    "status": "confirmed"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | `assigned_crew_id` is provided but not a valid integer |
| `404` | `BOOKING_NOT_FOUND` | No booking with this id |
| `404` | `CREW_NOT_FOUND` | `assigned_crew_id` does not exist or the user does not have a `field_crew` role |
| `409` | `BOOKING_COMPLETED` | Booking is in `completed` or `invoiced` status - crew reassignment not permitted |
| `422` | `CREW_DEACTIVATED` | The crew member's account is inactive |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `DELETE /api/bookings/:id`

**Purpose:** Camilla removes a completed, fully-invoiced booking to clear it from the operational Bookings table. Only bookings in `invoiced` status can be deleted - by that stage Xero holds the master copy of the invoice, so deleting the local record just clears completed clutter. Deleting cascades to the booking's linked `ServiceMemo`, `Invoice` (and its `InvoiceLineItem`s), and `JobMilestone` rows. `XeroSyncLog` rows are deliberately left untouched, since they're the last local breadcrumb that a sync happened even after the booking/invoice/memo behind it is gone.

**Auth required:** Yes

**Allowed roles:** `quotations_specialist`

**Request body:** None required.

**Success response `200`:**
```json
{
  "data": {
    "id": 8,
    "reference_number": "BKG-2026-00008"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `BOOKING_NOT_FOUND` | No booking with this id |
| `409` | `BOOKING_NOT_INVOICED` | Booking is not in `invoiced` status - only invoiced bookings can be deleted |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

## 3. Job Status Transitions - Cross-Team Endpoints

There is no generic `PATCH /api/bookings/:id/status` endpoint. Instead, two purpose-built endpoints drive a booking's status forward or send it back for reassignment. Zheng Bao owns the `bookings` table, but both endpoints are implemented and called by **Jasper's** field ops work (client feedback item 1: live job milestones).

### `POST /api/bookings/:id/milestone`

**Purpose:** Field Crew taps a button as each job stage happens on site, and the server timestamps it server-side (the tap IS the event - no client-supplied timestamp is accepted). Recording the `activated` milestone is also the real "start job" trigger: it moves a `confirmed` booking to `in_progress`. This replaces end-of-day hand-typed times, which were a source of pricing errors and revenue leakage.

**Auth required:** Yes

**Allowed roles:** `field_crew`, `managing_director`. `field_crew` is scoped to their own assigned booking - "booking doesn't exist" and "not this crew member's job" are deliberately returned as the same `404` so booking ids can't be probed.

**Milestone sequence (enforced server-side, in order):** `activated` → `arrived_at_location` → `en_route` → `arrived_at_destination` → `job_completed`

**Request body:**
```json
{ "milestone_type": "activated" }
```

**Success response `201`:**
```json
{
  "data": {
    "booking_id": 8,
    "status": "in_progress",
    "milestones": [
      { "milestone_type": "activated", "recorded_at": "2026-07-05T14:32:00.000Z" }
    ]
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | `milestone_type` is missing or not a valid ENUM, or `:id` is not a valid positive integer |
| `404` | `BOOKING_NOT_FOUND` | No booking with this id, or it is not assigned to the requesting crew member |
| `409` | `BOOKING_ALREADY_COMPLETED` | The booking is not `confirmed` or `in_progress` - milestones can no longer be recorded |
| `409` | `MILESTONE_ALREADY_RECORDED` | This `milestone_type` was already recorded for this job |
| `409` | `MILESTONE_OUT_OF_ORDER` | An earlier milestone in the sequence has not been recorded yet; message names which one to record first |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

### `POST /api/bookings/:id/reject`

**Purpose:** Field Crew declines a job (current or upcoming) they were assigned to. Sends it back to Quotations for reassignment rather than leaving it stuck on a crew member who can't do it - unassigns the crew, resets `status` back to `confirmed`, appends a timestamped rejection note, wipes any milestones already recorded (so the next crew starts from a clean slate), and notifies all Quotations Specialists.

**Auth required:** Yes

**Allowed roles:** `field_crew`, `managing_director`. Same own-booking-only scoping and blurred `404` as `POST /api/bookings/:id/milestone`.

**Request body:**
```json
{ "reason": "Vehicle broke down en route to pickup." }
```

**Success response `200`:**
```json
{
  "data": {
    "id": 8,
    "reference_number": "BKG-2026-00008",
    "status": "confirmed",
    "assigned_crew_id": null
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | `reason` is missing or empty, or `:id` is not a valid positive integer |
| `404` | `BOOKING_NOT_FOUND` | No booking with this id, or it is not assigned to the requesting crew member |
| `409` | `BOOKING_ALREADY_COMPLETED` | The booking is not `confirmed` or `in_progress` - it can no longer be rejected |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Role not permitted |

---

## 4. Notifications

Notifications are created internally by the backend when trigger events occur (new intake submission, memo submitted, etc.). These endpoints allow the frontend to fetch and manage a user's notification list.

### `GET /api/notifications/unread-count`

**Purpose:** Lightweight count-only endpoint for the nav bell badge, so the frontend doesn't need to fetch and count the full notification list just to render a badge number.

**Auth required:** Yes

**Allowed roles:** All authenticated roles. No role check beyond authentication - the count is always scoped to the requesting user's own notifications (`user_id = req.user.sub`), so there is no way to read another user's count.

**Success response `200`:**
```json
{
  "data": { "count": 3 }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `401` | `UNAUTHORISED` | Missing or invalid JWT |

---

### `GET /api/notifications`

**Purpose:** Get the authenticated user's notifications, ordered newest first. Unread count is shown in the nav badge (UC-09-A, UC-09-B, UC-09-C, UC-09-D).

**Auth required:** Yes

**Allowed roles:** All authenticated roles

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `unread_only` | boolean | No | If `true`, return only unread notifications |
| `page` | integer | No | Default `1` |
| `limit` | integer | No | Default `30` |

**Success response `200`:**
```json
{
  "data": [
    {
      "id": 14,
      "type": "new_intake_submission",
      "title": "New intake submission from John Tan",
      "body": "EAS - Advanced on 2026-07-05",
      "link": "/intake/7",
      "is_read": false,
      "created_at": "2026-06-22T10:15:00.000Z"
    },
    {
      "id": 13,
      "type": "memo_submitted",
      "title": "New memo submitted for BKG-2026-00006",
      "body": "Tan Tock Seng Hospital - 2026-06-20",
      "link": "/memos/6",
      "is_read": true,
      "created_at": "2026-06-20T18:45:00.000Z"
    }
  ],
  "meta": { "total": 5, "unread_count": 1, "page": 1, "limit": 30 }
}
```

**Notification `type` values:**

| Type | Recipient role | Trigger |
|------|----------------|---------|
| `new_intake_submission` | `quotations_specialist` | Customer submits intake (UC-09-A) |
| `memo_submitted` | `ar_specialist` | Field crew submits memo (UC-09-B) |
| `xero_sync_failed` | `ar_specialist`, `ap_specialist` | Xero sync fails after retries (UC-09-C) |
| `ocr_low_confidence` | `ap_specialist` | Gemini extraction confidence below threshold (UC-09-D) |

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `401` | `UNAUTHORISED` | Missing or invalid JWT |

---

### `PATCH /api/notifications/:id/read`

**Purpose:** Mark a single notification as read when the user clicks it or opens the linked resource.

**Auth required:** Yes

**Allowed roles:** All authenticated roles

**Request body:** None required.

**Success response `200`:**
```json
{
  "data": { "id": 14, "is_read": true }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOTIFICATION_NOT_FOUND` | No notification with this id belonging to the authenticated user |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |

---

### `PATCH /api/notifications/read-all`

**Purpose:** Mark all of the authenticated user's unread notifications as read (e.g. when Camilla clicks "Dismiss All").

**Auth required:** Yes

**Allowed roles:** All authenticated roles

**Request body:** None required.

**Success response `200`:**
```json
{
  "data": { "marked_read": 3 }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `401` | `UNAUTHORISED` | Missing or invalid JWT |

---

## 5. Dev Auth Reference

All JWT tokens below are signed with `HS256` and use the shared dev secret. They expire **2027-06-22** (1 year from the date they were generated).

Add the following to `backend/.env` (already in `.env.example`):

```
DEV_JWT_SECRET=dev-secret-efar-2026
```

**These are the same tokens used across all teammates' local setups.** The tokens are signed with the shared secret so any teammate's backend will accept them. To verify or decode a token locally:

```js
const jwt = require('jsonwebtoken')
jwt.verify(token, process.env.DEV_JWT_SECRET)
```

---

### Token Payload Shape

```json
{
  "sub":   5,
  "name":  "Camilla Ng",
  "email": "camilla@efar.sg",
  "role":  "quotations_specialist",
  "iat":   1782114425,
  "exp":   1813650425
}
```

**`sub`** maps to `users.id` in the shared users table. Middleware reads `req.user.role` for access control and `req.user.sub` as the acting user id (written to `reviewed_by`, `created_by`, `assigned_crew_id` where applicable).

---

### Pre-signed Test Tokens

Copy the token for the role you are testing and paste it as the `Authorization: Bearer <token>` header in Postman, Insomnia, or curl.

#### Quotations Specialist - Camilla Ng (`sub: 5`)

Use this for all intake and booking management endpoints.

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjUsIm5hbWUiOiJDYW1pbGxhIE5nIiwiZW1haWwiOiJjYW1pbGxhQGVmYXIuc2ciLCJyb2xlIjoicXVvdGF0aW9uc19zcGVjaWFsaXN0IiwiaWF0IjoxNzgyMTE0NDI1LCJleHAiOjE4MTM2NTA0MjV9.tYNXbCvGiUFz-uu1a4Y5fE_GMzWEjLMkBO7KABeMi1w
```

#### AR Specialist - Sarah Tan (`sub: 1`)

Use this to test `GET /api/bookings` and `GET /api/bookings/:id` (read-only access for AR).

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsIm5hbWUiOiJTYXJhaCBUYW4iLCJlbWFpbCI6InNhcmFoQGVmYXIuc2ciLCJyb2xlIjoiYXJfc3BlY2lhbGlzdCIsImlhdCI6MTc4MjExNDQyNSwiZXhwIjoxODEzNjUwNDI1fQ.ESzmUh8-f6nRvC0MH0c3t13hSEfeapsAYD4ResqL4pM
```

#### Managing Director - Doris Ching (`sub: 2`)

Use this to test read-only booking list and detail views.

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsIm5hbWUiOiJEb3JpcyBDaGluZyIsImVtYWlsIjoiZG9yaXNAZWZhci5zZyIsInJvbGUiOiJtYW5hZ2luZ19kaXJlY3RvciIsImlhdCI6MTc4MjExNDQyNSwiZXhwIjoxODEzNjUwNDI1fQ.k452ZYTHp373ilcJKalsXLlKWQ7Df1c_kJ9F2JIsJzM
```

#### AP Specialist - Chloe Lim (`sub: 4`)

AP has no direct access to intake or bookings, but this token is provided for notification endpoint testing (all roles can read their own notifications).

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjQsIm5hbWUiOiJDaGxvZSBMaW0iLCJlbWFpbCI6ImNobG9lQGVmYXIuc2ciLCJyb2xlIjoiYXBfc3BlY2lhbGlzdCIsImlhdCI6MTc4MjExNDQyNSwiZXhwIjoxODEzNjUwNDI1fQ.hHKZGVrmB6jmPcm52HnUg5lbxkSPMZe7FhreLrE1eZI
```

#### Field Crew - Ravi Kumar (`sub: 3`)

Use this to test `GET /api/bookings/my-jobs`, `POST /api/bookings/:id/milestone` (crew-recorded job stage transitions, including the `activated` milestone that moves a booking from `confirmed` to `in_progress`), `POST /api/bookings/:id/reject`, and the `GET /api/notifications` endpoint.

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsIm5hbWUiOiJSYXZpIEt1bWFyIiwiZW1haWwiOiJyYXZpQGVmYXIuc2ciLCJyb2xlIjoiZmllbGRfY3JldyIsImlhdCI6MTc4MjExNDQyNSwiZXhwIjoxODEzNjUwNDI1fQ.9Ot7uSJ_sLL-pGT_yaVkQwBGyVZkhmVjAQr7o6Nqx7g
```

---

### Role Access Matrix

| Endpoint | `quotations_specialist` | `ar_specialist` | `managing_director` | `ap_specialist` | `field_crew` | No auth |
|----------|:-:|:-:|:-:|:-:|:-:|:-:|
| `POST /api/intake` | - | - | - | - | - | Yes (public) |
| `GET /api/intake` | Yes | - | - | - | - | - |
| `GET /api/intake/:id` | Yes | - | - | - | - | - |
| `POST /api/intake/:id/confirm` | Yes | - | - | - | - | - |
| `POST /api/intake/:id/reject` | Yes | - | - | - | - | - |
| `DELETE /api/intake/:id` | Yes | - | - | - | - | - |
| `GET /api/bookings` | Yes | Yes | Yes | - | - | - |
| `GET /api/bookings/my-jobs` | - | - | Yes | - | Yes | - |
| `GET /api/bookings/:id` | - | Yes | Yes | - | Yes (own booking only) | - |
| `PATCH /api/bookings/:id/crew` | Yes | - | - | - | - | - |
| `DELETE /api/bookings/:id` | Yes | - | - | - | - | - |
| `POST /api/bookings/:id/milestone` | - | - | Yes | - | Yes (own booking only) | - |
| `POST /api/bookings/:id/reject` | - | - | Yes | - | Yes (own booking only) | - |
| `GET /api/notifications/unread-count` | Yes | Yes | Yes | Yes | Yes | - |
| `GET /api/notifications` | Yes | Yes | Yes | Yes | Yes | - |
| `PATCH /api/notifications/:id/read` | Yes | Yes | Yes | Yes | Yes | - |
| `PATCH /api/notifications/read-all` | Yes | Yes | Yes | Yes | Yes | - |
