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
3. [Booking Status - Cross-Team Endpoint](#3-booking-status---cross-team-endpoint)
4. [Notifications](#4-notifications)
5. [Dev Auth Reference](#5-dev-auth-reference)

---

## 1. Intake Submissions

### `POST /api/intake`

**Purpose:** Customer submits a service request through the public intake portal (UC-01). Creates a new `intake_submissions` record with status `pending` and fires an in-app notification to Camilla (UC-09-A).

**Auth required:** No - this is a public endpoint. No JWT needed.

**Request body:**
```json
{
  "customer_name": "John Tan",
  "organisation": "Changi General Hospital",
  "contact_email": "john.tan@cgh.com.sg",
  "contact_phone": "91234567",
  "service_type": "eas",
  "service_tier": "advanced",
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
| `service_tier` | Required, one of `basic`, `advanced`, `critical` |
| `preferred_date` | Required, `YYYY-MM-DD`, must not be in the past |
| `preferred_time` | Required, `HH:MM` format |
| `pickup_location` | Required, non-empty string |
| `destination` | Required, non-empty string |
| `organisation` | Optional |
| `additional_notes` | Optional |

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
      "service_tier": "advanced",
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
    "service_tier": "advanced",
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

**Purpose:** Camilla confirms a valid intake submission, which creates a new `bookings` record linked to it (UC-03). Camilla may adjust `service_tier` before confirming (UC-05). The intake status updates to `confirmed`. A booking confirmation email is sent to the customer.

**Auth required:** Yes

**Allowed roles:** `quotations_specialist`

**Request body:**
```json
{
  "service_tier": "critical",
  "scheduled_date": "2026-07-05",
  "scheduled_time": "14:30",
  "pickup_location": "Changi General Hospital, 2 Simei Street 3, Singapore 529889",
  "destination": "Singapore General Hospital, Outram Road, Singapore 169608",
  "notes": "Upgraded to Critical - ICU transfer confirmed with patient's doctor."
}
```

**Field notes:**
- `service_tier` is required. If Camilla confirms without changing it, send the same value from the intake submission. The backend records the original value in `original_service_tier` when they differ.
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
      "original_service_tier": "advanced",
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

### `POST /api/intake/:id/reopen`

**Purpose:** Camilla reopens a rejected submission back to `pending` for re-review (UC-04 alternative flow). Only allowed if no booking has been created from this submission and the rejection is recent (within a configurable time window).

**Auth required:** Yes

**Allowed roles:** `quotations_specialist`

**Request body:** None required.

**Success response `200`:**
```json
{
  "data": {
    "id": 7,
    "reference_number": "EFAR-2026-00007",
    "status": "pending",
    "rejection_reason": null,
    "reviewed_by": null,
    "reviewed_at": null
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `SUBMISSION_NOT_FOUND` | No intake submission with this id |
| `409` | `NOT_REJECTED` | Submission is not in `rejected` status |
| `409` | `REOPEN_WINDOW_EXPIRED` | Too much time has passed since rejection - Camilla must create a new intake manually |
| `409` | `BOOKING_EXISTS` | A booking was already created from this submission - cannot reopen |
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

### `GET /api/bookings/:id`

**Purpose:** Get the full detail of a single booking including linked intake, memo, and invoice references (UC-08).

**Auth required:** Yes

**Allowed roles:** `quotations_specialist`, `ar_specialist`, `managing_director`

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
    "original_service_tier": "advanced",
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

## 3. Booking Status - Cross-Team Endpoint

This endpoint is called by **Liang Yi's** field memo service and **Jasper's** invoice service to advance the booking status. Zheng Bao owns the `bookings` table, so all status updates must go through this endpoint rather than each teammate writing directly to the table.

### `PATCH /api/bookings/:id/status`

**Purpose:** Update a booking's `status`. The allowed transitions are enforced server-side to prevent invalid state changes.

**Auth required:** Yes

**Allowed roles:** `quotations_specialist`, `ar_specialist`, `field_crew`

**Allowed status transitions:**

| From | To | Who |
|------|----|-----|
| `confirmed` | `in_progress` | `field_crew` (crew activates job on site) |
| `in_progress` | `completed` | `field_crew` (crew submits field memo - Liang Yi's UC-05) |
| `completed` | `invoiced` | `ar_specialist` (Jasper's system calls this after successful Xero sync - Jasper's UC-07) |
| `confirmed` | `completed` | `quotations_specialist` (Camilla manually closes a booking e.g. cancelled job) |

**Request body:**
```json
{ "status": "in_progress" }
```

**Success response `200`:**
```json
{
  "data": {
    "id": 8,
    "reference_number": "BKG-2026-00008",
    "previous_status": "confirmed",
    "status": "in_progress",
    "updated_at": "2026-07-05T14:35:00.000Z"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | `status` value is missing or not a valid ENUM |
| `404` | `BOOKING_NOT_FOUND` | No booking with this id |
| `409` | `INVALID_TRANSITION` | The requested `status` is not a valid transition from the current status; response includes `current_status` and the list of valid next statuses |
| `409` | `ALREADY_INVOICED` | Booking is already `invoiced` - terminal state, no further transitions allowed |
| `401` | `UNAUTHORISED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Caller's role is not permitted to make this specific transition (e.g. `field_crew` cannot set `invoiced`) |

---

## 4. Notifications

Notifications are created internally by the backend when trigger events occur (new intake submission, memo submitted, etc.). These endpoints allow the frontend to fetch and manage a user's notification list.

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

Use this to test `GET /api/bookings` and `GET /api/bookings/:id` (read-only access for AR), and to test the `PATCH /api/bookings/:id/status` `completed → invoiced` transition.

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

Use this to test the `PATCH /api/bookings/:id/status` transitions (`confirmed → in_progress`, `in_progress → completed`) and the `GET /api/notifications` endpoint.

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsIm5hbWUiOiJSYXZpIEt1bWFyIiwiZW1haWwiOiJyYXZpQGVmYXIuc2ciLCJyb2xlIjoiZmllbGRfY3JldyIsImlhdCI6MTc4MjExNDQyNSwiZXhwIjoxODEzNjUwNDI1fQ.9Ot7uSJ_sLL-pGT_yaVkQwBGyVZkhmVjAQr7o6Nqx7g
```

---

### Role Access Matrix

| Endpoint | `quotations_specialist` | `ar_specialist` | `managing_director` | `ap_specialist` | No auth |
|----------|:-:|:-:|:-:|:-:|:-:|
| `POST /api/intake` | - | - | - | - | Yes (public) |
| `GET /api/intake` | Yes | - | - | - | - |
| `GET /api/intake/:id` | Yes | - | - | - | - |
| `POST /api/intake/:id/confirm` | Yes | - | - | - | - |
| `POST /api/intake/:id/reject` | Yes | - | - | - | - |
| `POST /api/intake/:id/reopen` | Yes | - | - | - | - |
| `GET /api/bookings` | Yes | Yes | Yes | - | - |
| `GET /api/bookings/:id` | Yes | Yes | Yes | - | - |
| `PATCH /api/bookings/:id/crew` | Yes | - | - | - | - |
| `PATCH /api/bookings/:id/status` | Yes | Yes | - | - | - |
| `GET /api/notifications` | Yes | Yes | Yes | Yes | - |
| `PATCH /api/notifications/:id/read` | Yes | Yes | Yes | Yes | - |
| `PATCH /api/notifications/read-all` | Yes | Yes | Yes | Yes | - |
