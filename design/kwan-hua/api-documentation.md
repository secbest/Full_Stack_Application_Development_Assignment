# API Documentation - Kwan Hua

**Feature Area:** Xero Foundation, OCR & AP Processing

All endpoints are prefixed with `/api`. Authentication uses JWT Bearer tokens unless stated otherwise. The `Authorization` header format is:

```
Authorization: Bearer <token>
```

---

## Endpoint Index

| # | Method | Path | UC | Auth |
|---|--------|------|----|------|
| 1 | GET | `/api/xero/status` | UC-01 | Yes |
| 2 | GET | `/api/xero/connect` | UC-01 | Yes |
| 3 | GET | `/api/xero/callback` | UC-01 | No |
| 4 | DELETE | `/api/xero/disconnect` | UC-01 | Yes |
| 5 | POST | `/api/vendor-invoices` | UC-03, UC-04, UC-05 | Yes |
| 6 | GET | `/api/vendor-invoices` | UC-06 | Yes |
| 7 | GET | `/api/vendor-invoices/:id` | UC-06 | Yes |
| 8 | PATCH | `/api/vendor-invoices/:id` | UC-06 | Yes |
| 9 | POST | `/api/vendor-invoices/:id/approve` | UC-06, UC-07 | Yes |
| 10 | POST | `/api/vendor-invoices/:id/reject` | UC-06 | Yes |
| 11 | POST | `/api/vendor-invoices/:id/reextract` | UC-04 | Yes |
| 12 | PATCH | `/api/vendor-invoice-items/:id` | UC-06 | Yes |
| 13 | GET | `/api/xero/sync-logs` | UC-08 | Yes |
| 14 | POST | `/api/xero/sync-logs/:id/retry` | UC-08 | Yes |

---

## 1. GET `/api/xero/status`

**Purpose:** Returns the current Xero connection state for the platform. Used to populate the connection status page (UC-01) and to check whether Xero authentication is valid before a sync operation.

**Auth required:** Yes - roles: `managing_director`, `ap_specialist`, `ar_specialist`

**Query params:** None

**Success response `200 OK` - connected:**
```json
{
  "is_connected": true,
  "xero_org_name": "Emergencies First Aid & Rescue Pte Ltd",
  "xero_tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "connected_at": "2026-06-20T08:15:00.000Z",
  "token_expiry": "2026-07-20T08:15:00.000Z"
}
```

**Success response `200 OK` - not connected:**
```json
{
  "is_connected": false,
  "xero_org_name": null,
  "xero_tenant_id": null,
  "connected_at": null,
  "token_expiry": null
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Role not permitted to view Xero status |

---

## 2. GET `/api/xero/connect`

**Purpose:** Initiates the Xero OAuth2 authorisation flow (UC-01 step 3). Returns the Xero authorisation URL for the frontend to redirect the user to. The backend constructs the URL with the configured `client_id`, `redirect_uri`, and required scopes.

**Auth required:** Yes - roles: `managing_director`

**Query params:** None

**Success response `200 OK`:**
```json
{
  "auth_url": "https://login.xero.com/identity/connect/authorize?response_type=code&client_id=YOUR_CLIENT_ID&redirect_uri=https%3A%2F%2Flocalhost%3A5000%2Fapi%2Fxero%2Fcallback&scope=openid+profile+email+accounting.transactions+accounting.contacts+offline_access&state=random-csrf-state-token"
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Only the Managing Director can initiate Xero connections |
| 500 | `XERO_CONFIG_MISSING` | Xero client_id or redirect_uri not configured in environment |

---

## 3. GET `/api/xero/callback`

**Purpose:** Handles the Xero OAuth2 redirect after the admin approves permissions (UC-01 steps 5-7). Exchanges the authorisation code for access and refresh tokens, persists them to `xero_connections`, and redirects the user back to the settings page with a success or error state.

**Auth required:** No - this endpoint is called by Xero's redirect, not by a logged-in session. CSRF protection is provided by the `state` parameter checked against the session.

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Authorisation code from Xero |
| `state` | string | Yes | CSRF state token issued in step 2 |
| `error` | string | No | Present if the admin denied permissions |

**Success response `302 Found`:**
Redirects to `/settings/xero?connected=true`

**Error responses (all redirect):**

| Scenario | Redirect target |
|----------|----------------|
| Admin denied permissions (`error` param present) | `/settings/xero?error=access_denied` |
| `state` mismatch (CSRF check failed) | `/settings/xero?error=invalid_state` |
| Code already expired | `/settings/xero?error=code_expired` |
| Token exchange failed (Xero error) | `/settings/xero?error=token_exchange_failed` |

---

## 4. DELETE `/api/xero/disconnect`

**Purpose:** Removes the stored Xero connection record and marks `is_connected = false`. The admin must re-run the OAuth2 flow to reconnect.

**Auth required:** Yes - roles: `managing_director`

**Request body:** None

**Success response `200 OK`:**
```json
{
  "message": "Xero disconnected successfully."
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Only the Managing Director can disconnect Xero |
| 404 | `NOT_CONNECTED` | No active Xero connection found |

---

## 5. POST `/api/vendor-invoices`

**Purpose:** Accepts a vendor PDF upload from Chloe (UC-03), forwards it to Cloudinary, creates the `vendor_invoices` record, synchronously runs Gemini OCR (UC-04), calculates the rebate (UC-05), and returns the fully populated invoice record ready for the review interface (UC-06). The response is the single source of truth Chloe's UI uses to pre-fill the review form.

**Auth required:** Yes - roles: `ap_specialist`

**Request body:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | Yes | PDF only, max 10 MB |
| `rebate_percentage` | number | No | Override the default 1% rebate for this vendor. Defaults to `1.00` if omitted. |

**Success response `201 Created`:**
```json
{
  "id": 42,
  "uploaded_by": 3,
  "vendor_name": "Esso Petroleum Pte Ltd",
  "invoice_number": "INV-2026-00891",
  "invoice_date": "2026-06-18",
  "pdf_url": "https://res.cloudinary.com/efar/raw/upload/v1750000000/vendor-invoices/inv-2026-00891.pdf",
  "extracted_total": "1840.00",
  "rebate_percentage": "1.00",
  "rebate_amount": "18.40",
  "verified_total": "1821.60",
  "extraction_confidence": 0.94,
  "is_low_confidence": false,
  "status": "pending_review",
  "xero_bill_id": null,
  "rejection_reason": null,
  "approved_at": null,
  "items": [
    {
      "id": 101,
      "description": "Diesel 50ppm - 1,200 litres",
      "quantity": "1200.00",
      "unit_price": "1.45",
      "amount": "1740.00"
    },
    {
      "id": 102,
      "description": "Delivery surcharge",
      "quantity": "1.00",
      "unit_price": "100.00",
      "amount": "100.00"
    }
  ],
  "created_at": "2026-06-22T09:30:00.000Z"
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `INVALID_FILE_TYPE` | Only PDF files are accepted. Please scan the invoice and upload as a PDF. |
| 400 | `FILE_TOO_LARGE` | File exceeds the 10 MB limit. Please compress or re-scan the document. |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Only the AP Specialist can upload vendor invoices |
| 502 | `CLOUDINARY_UPLOAD_FAILED` | Failed to upload PDF to storage. Please retry. |
| 502 | `OCR_EXTRACTION_FAILED` | Gemini could not extract data from this PDF. The invoice has been saved with status `extraction_failed` - use POST `/api/vendor-invoices/:id/reextract` to retry. |

---

## 6. GET `/api/vendor-invoices`

**Purpose:** Returns a paginated list of vendor invoices for the AP review queue. Supports filtering by status, vendor name, and date range. Used by Chloe's queue view and Doris's executive overhead dashboard (UC-07).

**Auth required:** Yes - roles: `ap_specialist`, `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | Filter by status: `pending_review`, `extraction_failed`, `approved`, `rejected`, `synced_to_xero`, `failed` |
| `vendor_name` | string | No | Partial match on vendor name |
| `date_from` | date (YYYY-MM-DD) | No | Filter by `invoice_date` from this date |
| `date_to` | date (YYYY-MM-DD) | No | Filter by `invoice_date` up to this date |
| `page` | integer | No | Page number, default `1` |
| `limit` | integer | No | Results per page, default `20`, max `100` |

**Success response `200 OK`:**
```json
{
  "data": [
    {
      "id": 42,
      "vendor_name": "Esso Petroleum Pte Ltd",
      "invoice_number": "INV-2026-00891",
      "invoice_date": "2026-06-18",
      "extracted_total": "1840.00",
      "verified_total": "1821.60",
      "is_low_confidence": false,
      "status": "pending_review",
      "created_at": "2026-06-22T09:30:00.000Z"
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
| 400 | `INVALID_DATE_RANGE` | `date_from` must be before or equal to `date_to` |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Role not permitted to list vendor invoices |

---

## 7. GET `/api/vendor-invoices/:id`

**Purpose:** Returns the full detail of one vendor invoice including all line items. This is the data source for Chloe's two-panel AP review interface (UC-06).

**Auth required:** Yes - roles: `ap_specialist`, `managing_director`

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | integer | Vendor invoice ID |

**Success response `200 OK`:**
```json
{
  "id": 42,
  "uploaded_by": {
    "id": 3,
    "name": "Chloe Lim"
  },
  "approved_by": null,
  "vendor_name": "Esso Petroleum Pte Ltd",
  "invoice_number": "INV-2026-00891",
  "invoice_date": "2026-06-18",
  "pdf_url": "https://res.cloudinary.com/efar/raw/upload/v1750000000/vendor-invoices/inv-2026-00891.pdf",
  "extracted_total": "1840.00",
  "rebate_percentage": "1.00",
  "rebate_amount": "18.40",
  "verified_total": "1821.60",
  "extraction_confidence": 0.94,
  "is_low_confidence": false,
  "status": "pending_review",
  "xero_bill_id": null,
  "rejection_reason": null,
  "approved_at": null,
  "items": [
    {
      "id": 101,
      "description": "Diesel 50ppm - 1,200 litres",
      "quantity": "1200.00",
      "unit_price": "1.45",
      "amount": "1740.00"
    },
    {
      "id": 102,
      "description": "Delivery surcharge",
      "quantity": "1.00",
      "unit_price": "100.00",
      "amount": "100.00"
    }
  ],
  "created_at": "2026-06-22T09:30:00.000Z",
  "updated_at": "2026-06-22T09:30:00.000Z"
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Role not permitted to view vendor invoices |
| 404 | `NOT_FOUND` | Vendor invoice not found |

---

## 8. PATCH `/api/vendor-invoices/:id`

**Purpose:** Allows Chloe to correct OCR-extracted header fields on the invoice (UC-06 - "Chloe spots an incorrectly extracted field"). If `extracted_total` is updated, the server recalculates `rebate_amount` and `verified_total` automatically. Only invoices with status `pending_review` or `extraction_failed` can be edited.

**Auth required:** Yes - roles: `ap_specialist`

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | integer | Vendor invoice ID |

**Request body** (all fields optional - send only what changed):
```json
{
  "vendor_name": "Esso Petroleum Singapore Pte Ltd",
  "invoice_number": "INV-2026-00891",
  "invoice_date": "2026-06-18",
  "extracted_total": "1840.00",
  "rebate_percentage": "1.00"
}
```

**Success response `200 OK`:**
```json
{
  "id": 42,
  "vendor_name": "Esso Petroleum Singapore Pte Ltd",
  "invoice_number": "INV-2026-00891",
  "invoice_date": "2026-06-18",
  "extracted_total": "1840.00",
  "rebate_percentage": "1.00",
  "rebate_amount": "18.40",
  "verified_total": "1821.60",
  "status": "pending_review",
  "updated_at": "2026-06-22T10:05:00.000Z"
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `INVALID_TOTAL` | `extracted_total` must be a positive number |
| 400 | `NEGATIVE_VERIFIED_TOTAL` | Rebate calculation results in a negative verified total. Please check the extracted total. |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Only the AP Specialist can edit vendor invoices |
| 404 | `NOT_FOUND` | Vendor invoice not found |
| 409 | `INVALID_STATUS` | Invoice cannot be edited in its current status. Only `pending_review` and `extraction_failed` invoices are editable. |

---

## 9. POST `/api/vendor-invoices/:id/approve`

**Purpose:** Chloe approves the reviewed invoice (UC-06 step 4). The server performs a duplicate check before approval, updates the status to `approved`, then immediately attempts to sync the bill to Xero (UC-07). The response reflects the final status after the sync attempt so the UI can render "Synced" or "Sync Failed" without a separate poll.

**Auth required:** Yes - roles: `ap_specialist`

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | integer | Vendor invoice ID |

**Request body:** None

**Success response `200 OK` - approved and synced:**
```json
{
  "id": 42,
  "status": "synced_to_xero",
  "xero_bill_id": "b1234567-89ab-cdef-0123-456789abcdef",
  "approved_at": "2026-06-22T10:10:00.000Z",
  "sync_log": {
    "id": 15,
    "status": "success",
    "attempt_count": 1,
    "synced_at": "2026-06-22T10:10:02.000Z"
  }
}
```

**Success response `200 OK` - approved but Xero sync failed:**
```json
{
  "id": 42,
  "status": "failed",
  "xero_bill_id": null,
  "approved_at": "2026-06-22T10:10:00.000Z",
  "sync_log": {
    "id": 15,
    "status": "failed",
    "attempt_count": 1,
    "error_message": "ContactNotFound: The contact 'Esso Petroleum Singapore Pte Ltd' does not exist in Xero.",
    "synced_at": null
  }
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Only the AP Specialist can approve vendor invoices |
| 404 | `NOT_FOUND` | Vendor invoice not found |
| 409 | `DUPLICATE_INVOICE` | An invoice with this number from this vendor already exists. Please verify before approving. |
| 409 | `INVALID_STATUS` | Only invoices with status `pending_review` can be approved |
| 409 | `MISSING_TOTAL` | `extracted_total` must be set before the invoice can be approved |
| 503 | `XERO_NOT_CONNECTED` | Xero is not connected. Ask the Managing Director to reconnect before retrying. |

---

## 10. POST `/api/vendor-invoices/:id/reject`

**Purpose:** Chloe rejects an invoice - e.g. it belongs to a different company or is suspected fraudulent (UC-06 edge case). Sets status to `rejected` with a mandatory reason. Rejected invoices are excluded from all AP sync queues but remain visible in the audit log.

**Auth required:** Yes - roles: `ap_specialist`

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | integer | Vendor invoice ID |

**Request body:**
```json
{
  "rejection_reason": "Invoice does not belong to EFAR - vendor address does not match our accounts."
}
```

**Success response `200 OK`:**
```json
{
  "id": 42,
  "status": "rejected",
  "rejection_reason": "Invoice does not belong to EFAR - vendor address does not match our accounts.",
  "updated_at": "2026-06-22T10:15:00.000Z"
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `MISSING_REASON` | `rejection_reason` is required when rejecting an invoice |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Only the AP Specialist can reject vendor invoices |
| 404 | `NOT_FOUND` | Vendor invoice not found |
| 409 | `INVALID_STATUS` | Only invoices with status `pending_review` or `extraction_failed` can be rejected |

---

## 11. POST `/api/vendor-invoices/:id/reextract`

**Purpose:** Re-triggers Gemini OCR extraction on an invoice that previously failed (status `extraction_failed`) or was manually requested for re-processing (UC-04 retry edge case). Replaces any previously extracted data and line items with the new extraction result.

**Auth required:** Yes - roles: `ap_specialist`

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | integer | Vendor invoice ID |

**Request body:** None

**Success response `200 OK`:**
```json
{
  "id": 42,
  "vendor_name": "Esso Petroleum Pte Ltd",
  "invoice_number": "INV-2026-00891",
  "invoice_date": "2026-06-18",
  "extracted_total": "1840.00",
  "rebate_amount": "18.40",
  "verified_total": "1821.60",
  "extraction_confidence": 0.91,
  "is_low_confidence": false,
  "status": "pending_review",
  "items": [
    {
      "id": 105,
      "description": "Diesel 50ppm - 1,200 litres",
      "quantity": "1200.00",
      "unit_price": "1.45",
      "amount": "1740.00"
    }
  ],
  "updated_at": "2026-06-22T10:20:00.000Z"
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Only the AP Specialist can trigger re-extraction |
| 404 | `NOT_FOUND` | Vendor invoice not found |
| 409 | `INVALID_STATUS` | Re-extraction is only available for invoices with status `pending_review` or `extraction_failed` |
| 502 | `OCR_EXTRACTION_FAILED` | Gemini failed to extract data again. Invoice status has been set to `extraction_failed`. Please enter fields manually. |

---

## 12. PATCH `/api/vendor-invoice-items/:id`

**Purpose:** Allows Chloe to correct an individual line item extracted by OCR (UC-06 - editing line items in the right panel). Recalculates the parent invoice's `extracted_total` automatically if `amount` is changed.

**Auth required:** Yes - roles: `ap_specialist`

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | integer | Vendor invoice item ID |

**Request body** (all fields optional - send only what changed):
```json
{
  "description": "Diesel 50ppm - 1,200 litres",
  "quantity": "1200.00",
  "unit_price": "1.45",
  "amount": "1740.00"
}
```

**Success response `200 OK`:**
```json
{
  "id": 101,
  "vendor_invoice_id": 42,
  "description": "Diesel 50ppm - 1,200 litres",
  "quantity": "1200.00",
  "unit_price": "1.45",
  "amount": "1740.00",
  "updated_at": "2026-06-22T10:08:00.000Z",
  "parent_invoice": {
    "id": 42,
    "extracted_total": "1840.00",
    "rebate_amount": "18.40",
    "verified_total": "1821.60"
  }
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `INVALID_AMOUNT` | `amount` must be a positive number |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Only the AP Specialist can edit invoice line items |
| 404 | `NOT_FOUND` | Invoice line item not found |
| 409 | `INVALID_STATUS` | Line items cannot be edited - parent invoice is not in an editable status |

---

## 13. GET `/api/xero/sync-logs`

**Purpose:** Returns all Xero sync log entries for the sync status panel (UC-08). Supports filtering by status and entity type. Both AP Specialist (Chloe) and AR Specialist (Sarah) use this endpoint - Chloe sees vendor invoice entries, Sarah sees AR invoice entries, but the endpoint returns both unless filtered.

**Auth required:** Yes - roles: `ap_specialist`, `ar_specialist`, `managing_director`

**Query params:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | No | Filter by status: `pending`, `success`, `failed` |
| `entity_type` | string | No | Filter by entity: `vendor_invoice`, `ar_invoice` |
| `page` | integer | No | Page number, default `1` |
| `limit` | integer | No | Results per page, default `50` |

**Success response `200 OK`:**
```json
{
  "data": [
    {
      "id": 15,
      "entity_type": "vendor_invoice",
      "entity_id": 42,
      "entity_reference": "Esso Petroleum Pte Ltd - INV-2026-00891",
      "xero_record_id": null,
      "status": "failed",
      "attempt_count": 1,
      "error_message": "ContactNotFound: The contact 'Esso Petroleum Pte Ltd' does not exist in Xero.",
      "synced_at": null,
      "created_at": "2026-06-22T10:10:02.000Z",
      "retry_available": true
    },
    {
      "id": 14,
      "entity_type": "vendor_invoice",
      "entity_id": 40,
      "entity_reference": "SBS Transit Parts - INV-2026-00450",
      "xero_record_id": "c9876543-21fe-dcba-0987-654321fedcba",
      "status": "success",
      "attempt_count": 1,
      "error_message": null,
      "synced_at": "2026-06-21T14:22:00.000Z",
      "retry_available": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 2,
    "total_pages": 1
  },
  "xero_connected": true
}
```

> `retry_available` is `false` when `status = 'success'`, `attempt_count >= 3`, or Xero is not connected.

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Role not permitted to view sync logs |

---

## 14. POST `/api/xero/sync-logs/:id/retry`

**Purpose:** Retries a failed Xero sync operation (UC-08 step 4). The server checks the token validity and the current `attempt_count` before attempting. If the attempt count is already 3 or more, the retry is blocked and the user is directed to contact support.

**Auth required:** Yes - roles: `ap_specialist`, `ar_specialist`

**Path params:**

| Param | Type | Description |
|-------|------|-------------|
| `id` | integer | Xero sync log ID |

**Request body:** None

**Success response `200 OK` - retry succeeded:**
```json
{
  "id": 15,
  "status": "success",
  "attempt_count": 2,
  "xero_record_id": "b1234567-89ab-cdef-0123-456789abcdef",
  "error_message": null,
  "synced_at": "2026-06-22T11:00:05.000Z"
}
```

**Success response `200 OK` - retry failed again:**
```json
{
  "id": 15,
  "status": "failed",
  "attempt_count": 2,
  "xero_record_id": null,
  "error_message": "ContactNotFound: The contact 'Esso Petroleum Pte Ltd' does not exist in Xero.",
  "synced_at": null
}
```

**Error responses:**

| Status | Code | Message |
|--------|------|---------|
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Role not permitted to retry sync operations |
| 404 | `NOT_FOUND` | Sync log entry not found |
| 409 | `RETRY_LIMIT_REACHED` | This sync has failed 3 or more times. Please contact support - this likely indicates a configuration issue in Xero. |
| 409 | `NOT_FAILED` | Only failed sync log entries can be retried |
| 503 | `XERO_NOT_CONNECTED` | Xero is not connected. Ask the Managing Director to reconnect before retrying. |

---

## Dev Authentication Reference

### Shared Secret

Add the following to your local `.env` file. All teammates must use this same value so test tokens work across every local setup.

```
DEV_JWT_SECRET=dev-secret-efar
```

### JWT Payload Shape

All tokens use the following payload structure:

```json
{
  "sub": <integer - user ID>,
  "name": "<display name>",
  "email": "<email>",
  "role": "<role slug>",
  "iat": <unix timestamp - issued at>,
  "exp": <unix timestamp - expires at>
}
```

Role slugs map to EFAR roles as follows:

| Slug | EFAR Role |
|------|-----------|
| `managing_director` | Managing Director (Doris) |
| `ar_specialist` | Accounts Receivable Specialist (Sarah) |
| `ap_specialist` | Accounts Payable Specialist (Chloe) |
| `quotations_specialist` | Quotations Specialist (Camilla) |

### Pre-signed Test Tokens

All tokens are signed with `HS256` using `DEV_JWT_SECRET=dev-secret-efar` and expire **2027-06-22**.

---

#### Managing Director - Doris Ching

**Payload:**
```json
{
  "sub": 1,
  "name": "Doris Ching",
  "email": "doris@efar.sg",
  "role": "managing_director",
  "iat": 1782114367,
  "exp": 1813650367
}
```

**Token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsIm5hbWUiOiJEb3JpcyBDaGluZyIsImVtYWlsIjoiZG9yaXNAZWZhci5zZyIsInJvbGUiOiJtYW5hZ2luZ19kaXJlY3RvciIsImlhdCI6MTc4MjExNDM2NywiZXhwIjoxODEzNjUwMzY3fQ.0bK9fK16b9rhJKQWYayH_KfLsOgz9xtGDt7XRCbXYGw
```

---

#### AR Specialist - Sarah Tan

**Payload:**
```json
{
  "sub": 2,
  "name": "Sarah Tan",
  "email": "sarah@efar.sg",
  "role": "ar_specialist",
  "iat": 1782114367,
  "exp": 1813650367
}
```

**Token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjIsIm5hbWUiOiJTYXJhaCBUYW4iLCJlbWFpbCI6InNhcmFoQGVmYXIuc2ciLCJyb2xlIjoiYXJfc3BlY2lhbGlzdCIsImlhdCI6MTc4MjExNDM2NywiZXhwIjoxODEzNjUwMzY3fQ.KNFVG33zuZCUtM3qX0b-LMLvv4F1_CD2GQfRLuuZJnA
```

---

#### AP Specialist - Chloe Lim

**Payload:**
```json
{
  "sub": 3,
  "name": "Chloe Lim",
  "email": "chloe@efar.sg",
  "role": "ap_specialist",
  "iat": 1782114367,
  "exp": 1813650367
}
```

**Token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjMsIm5hbWUiOiJDaGxvZSBMaW0iLCJlbWFpbCI6ImNobG9lQGVmYXIuc2ciLCJyb2xlIjoiYXBfc3BlY2lhbGlzdCIsImlhdCI6MTc4MjExNDM2NywiZXhwIjoxODEzNjUwMzY3fQ.KPOMNm46Y5asKvbWlgi2C4wSF8PdX6eGUZQ-UuDDriU
```

---

#### Quotations Specialist - Camilla Ng

**Payload:**
```json
{
  "sub": 4,
  "name": "Camilla Ng",
  "email": "camilla@efar.sg",
  "role": "quotations_specialist",
  "iat": 1782114367,
  "exp": 1813650367
}
```

**Token:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjQsIm5hbWUiOiJDYW1pbGxhIE5nIiwiZW1haWwiOiJjYW1pbGxhQGVmYXIuc2ciLCJyb2xlIjoicXVvdGF0aW9uc19zcGVjaWFsaXN0IiwiaWF0IjoxNzgyMTE0MzY3LCJleHAiOjE4MTM2NTAzNjd9.zSeUkOcn8JEBAdlWljou0uhtKvBtTS1Re23whSzqGns
```
