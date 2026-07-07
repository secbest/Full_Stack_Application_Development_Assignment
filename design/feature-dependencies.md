# Feature Dependency Map

**EFAR Digital Operations-to-Billing Platform**
Generated from: individual `database-schema.md` and `api-documentation.md` files in `design/<member>/`.

---

## Dependency Table

| Feature / What Needs It | Owned By | Depends On | Owned By | Type | Can Mock? |
|--------------------------|----------|-----------|----------|------|-----------|
| Intake submission review (`intake_submissions.reviewed_by`) | Zheng Bao | `users` table with `quotations_specialist` role | Group | DB | Yes - stub users array |
| Booking creation (`bookings.client_id`) | Zheng Bao | `clients` table | Group | DB | Yes - stub clients array |
| Booking crew assignment (`bookings.assigned_crew_id`) | Zheng Bao | `users` table with `field_crew` role | Group | DB | Yes - stub users array |
| Field memo submission (`service_memos.booking_id`) | Liang Yi | `bookings` table | Zheng Bao | DB | Yes - stub bookings array |
| Field memo reviewer (`service_memos.reviewed_by`) | Liang Yi | `users` table with `ar_specialist` role | Group | DB | Yes - stub users array |
| Booking status advance on memo submit (`in_progress → completed`) | Liang Yi | `PATCH /api/bookings/:id/status` endpoint | Zheng Bao | API | Yes - call endpoint or write directly to DB in dev |
| Pricing engine - base rate lookup | Jasper | 11 fields on `service_memos` (see below) | Liang Yi | DB | Yes - `backend/src/stubs/ar-billing.js` has full `serviceMemos` array |
| Invoice creation (`invoices.memo_id`) | Jasper | `service_memos` table | Liang Yi | DB | Yes - stub memos array |
| Invoice creation (`invoices.booking_id`) | Jasper | `bookings` table | Zheng Bao | DB | Yes - stub bookings array |
| Invoice creation (`invoices.client_id`) | Jasper | `clients` table | Group | DB | Yes - stub clients array |
| Invoice approval (`invoices.approved_by`) | Jasper | `users` table with `ar_specialist` role | Group | DB | Yes - stub users array |
| Pricing contract creation (`pricing_contracts.client_id`) | Jasper | `clients` table | Group | DB | Yes - stub clients array |
| Xero sync audit log (`xero_sync_logs` with `entity_type='ar_invoice'`) | Jasper | `xero_sync_logs` table schema and migration | Kwan Hua | DB | Yes - skip log write in dev, add once Kwan Hua migrates |
| Booking status advance on Xero sync (`completed → invoiced`) | Jasper | `PATCH /api/bookings/:id/status` endpoint | Zheng Bao | API | Yes - call endpoint or update directly in dev |
| Memo approval sets `service_memos.status = 'reviewed'` and `service_memos.reviewed_by` | Jasper | `service_memos` table | Liang Yi | DB | Yes - stub memo status update in dev |
| Memo "Return to Crew" reverts `service_memos.status = 'submitted'` | Jasper | `service_memos` table | Liang Yi | DB | Yes - stub the revert write |
| Revenue leakage alert dismissal writes `bookings.leakage_dismissed_at` and `bookings.leakage_dismissed_reason` | Jasper | `bookings` table | Zheng Bao | DB | Yes - call `PATCH /api/bookings/:id` or write directly in dev |
| Notification on memo submit (`memo_submitted` type, recipient = Sarah) | Liang Yi | `notifications` table and `notificationService.create()` | Zheng Bao | DB | Yes - no-op the notification call during dev |
| Notification on Xero sync failure (`xero_sync_failed` type) | Jasper, Kwan Hua | `notifications` table and `notificationService.create()` | Zheng Bao | DB | Yes - no-op the notification call during dev |
| Notification on OCR low confidence (`ocr_low_confidence` type) | Kwan Hua | `notifications` table and `notificationService.create()` | Zheng Bao | DB | Yes - no-op the notification call during dev |
| Xero OAuth2 token storage | Kwan Hua | `xero_connections` table | Kwan Hua (self) | DB | N/A - self-owned |
| PDF upload + OCR (`vendor_invoices.uploaded_by`) | Kwan Hua | `users` table with `ap_specialist` role | Group | DB | Yes - stub users array |
| AP approval (`vendor_invoices.approved_by`) | Kwan Hua | `users` table | Group | DB | Yes - stub users array |
| Executive dashboard - booking counts (UC-06) | Liang Yi | `bookings` table read access | Zheng Bao | DB (read) | Yes - stub bookings aggregate |
| Executive dashboard - invoices synced count (UC-06) | Liang Yi | `invoices` table read access | Jasper | DB (read) | Yes - stub invoice aggregate |
| Executive dashboard - vendor expenditure (UC-07) | Liang Yi | `vendor_invoices` table read access | Kwan Hua | DB (read) | Yes - stub vendor invoice aggregate |
| JWT auth on all protected routes | All members | Auth middleware + `POST /api/auth/login` | Group | Auth | Yes - use pre-signed dev JWTs from `design/jasper/api-documentation.md` |

---

## Pricing Engine Fields Required on `service_memos` (Liang Yi → Jasper)

This is the most critical cross-team contract. Jasper's pricing engine will fail silently or produce wrong invoices if any of these fields are missing, null, or use different ENUM values.

| Field on `service_memos` | Type | ENUM values must match |
|--------------------------|------|------------------------|
| `service_type` | ENUM | `eas`, `mts`, `event_standby`, `workplace_standby` (same as `pricing_rates.service_type`) |
| `transfer_type` | ENUM | `one_way_hospital`, `two_way_hospital`, `covid_19`, `imh_psychiatric`, `airport_no_tarmac`, `airport_with_tarmac`, `sg_jb_ground`, `air_evacuation` (same as `pricing_rates.transfer_type`) |
| `is_office_hours` | BOOLEAN | - |
| `oxygen_litres_used` | DECIMAL | - |
| `has_inconvenience_fee` | BOOLEAN | - |
| `disposables_used` | BOOLEAN | - |
| `resuscitation_performed` | BOOLEAN | - |
| `suction_performed` | BOOLEAN | - |
| `waiting_time_minutes` | INTEGER | - |
| `patient_weight_kg` | DECIMAL | - |
| `is_jurong_island` | BOOLEAN | - |

**Status:** All 11 fields are confirmed in Liang Yi's `design/liang-yi/database-schema.md` with matching ENUM values. No conflict.

---

## Shared Table: `xero_sync_logs` (Kwan Hua owns, Jasper writes to it)

`xero_sync_logs` is declared in Kwan Hua's schema but both AR and AP flows write to it using a polymorphic pattern:

- `entity_type = 'ar_invoice'`, `entity_id = invoices.id` - written by Jasper
- `entity_type = 'vendor_invoice'`, `entity_id = vendor_invoices.id` - written by Kwan Hua

**Agreement required before either starts coding the sync step:**

| Field | Agreed Value |
|-------|-------------|
| `entity_type` ENUM values | `'ar_invoice'` and `'vendor_invoice'` |
| `status` ENUM values | `'pending'`, `'success'`, `'failed'` |
| Retry disabled threshold | `attempt_count >= 3` |
| `xero_record_id` | Nullable; populated on success |

The migration for `xero_sync_logs` must be run by Kwan Hua. Jasper imports the model from Kwan Hua's module file (or a shared models directory) and writes rows using the agreed schema.

---

## Shared API Contract: `PATCH /api/bookings/:id/status`

Zheng Bao owns and implements this endpoint. Liang Yi and Jasper call it without touching `bookings` rows directly.

Documented in `design/zheng-bao/api-documentation.md`. Summary of allowed transitions:

| Caller Role | From | To |
|-------------|------|----|
| `field_crew` (Liang Yi) | `confirmed` | `in_progress` |
| `field_crew` (Liang Yi) | `in_progress` | `completed` |
| `ar_specialist` (Jasper) | `completed` | `invoiced` |
| `quotations_specialist` (Zheng Bao) | `confirmed` | `completed` |

**Agreement required:** Zheng Bao must implement and test this endpoint before Liang Yi and Jasper can remove their stubs. Both should mock it locally (write directly to DB or use stub) until Zheng Bao's routes are up.

---

## Circular / Soft Dependencies

| Dependency | Type | Risk |
|-----------|------|------|
| Liang Yi reads `invoices` (Jasper) for executive dashboard | Soft read-only | Low - dashboard can show placeholder until Jasper's invoices are seeded |
| Liang Yi reads `vendor_invoices` (Kwan Hua) for expense summary | Soft read-only | Low - same as above |
| Jasper writes to `xero_sync_logs` (Kwan Hua) | Shared write | Medium - schema must be frozen before either implements sync |

No hard circular dependencies exist. The pipeline runs in one direction: intake → booking → memo → invoice → Xero sync.

---

## Suggested Build Order

> **Status update (2026-07-08):** Wave 3 (Jasper's AR Billing, Pricing Engine & Invoice Sync scope) has been implemented by Kwan Hua, who took over the whole of Wave 3. Design ownership of `design/jasper/` is unchanged; the implementation and its tests are committed under Kwan Hua's name (`backend/tests/kwan-hua/pricing.test.js`). Delivered: the pricing engine (`backend/src/services/pricingService.js`), memo review queue + `PATCH /api/service-memos/:id/approve` (engine + invoice generation) + `/return`, the `/api/invoices/*` endpoints (list, detail, line-item add/edit/delete, `batch-approve`, `retry-xero`) writing `xero_sync_logs` with `entity_type='ar_invoice'`, the AR frontend screens (Memo Review Queue/Detail, Invoice List/Detail), and `seed-pricing.js`. Not included (still Jasper's / later waves): pricing-contract CRUD (Wave 2) and the Revenue Leakage / AR Dashboard endpoints (Wave 4).
>
> **Status update (2026-07-02, In Progress):** Wave 2A (Liang Yi's Field Operations & Executive Dashboard scope) has been implemented by Jasper - `service_memos`/`memo_signatures` tables, the full `/api/service-memos/*` and `/api/dashboard/*` endpoints, and the frontend My Jobs -> Memo Wizard -> Memo History flow plus the Fleet/Expense dashboard. Built directly against the real `Booking`/`User` Sequelize models (not the stub) once `npm run db:sync` confirmed table creation doesn't depend on migrations in this project - see `backend/src/scripts/sync-db.js`. Two temporary read-only routes (`GET /api/bookings/my-jobs`, `GET /api/bookings/:id`) were added to `backend/src/routes/bookingRoutes.js` to unblock this work; Zheng Bao should reconcile these with his full booking-management implementation.

```
Wave 0 - Group (all members blocked until this is done)
  ├── users + roles table, migration, seed
  ├── clients table, migration, seed
  └── Auth: POST /api/auth/register, POST /api/auth/login, JWT middleware

Wave 1 - Parallel (no inter-member dependency)
  ├── Zheng Bao: intake_submissions + bookings tables + migrations + seeds
  │              POST /api/intake (public)
  │              GET/PATCH /api/intake/:id
  │              POST /api/bookings, GET /api/bookings
  │              PATCH /api/bookings/:id/status  ← unblock Liang Yi + Jasper
  │
  └── Kwan Hua:  xero_connections + vendor_invoices + vendor_invoice_items
                 + xero_sync_logs tables + migrations + seeds
                 GET /api/xero/connect, POST /api/vendor-invoices (upload)

Wave 2 - Parallel (after Wave 1)
  ├── Liang Yi:  service_memos + memo_signatures tables + migrations + seeds
  │              POST /api/memos (submit memo, triggers PATCH /bookings/:id/status)
  │              GET /api/memos/:id
  │              POST /api/memos/:id/signatures
  │
  └── Jasper:    pricing_contracts + pricing_rates + surcharge_schedules
                 tables + migrations + seeds
                 All /api/contracts/* endpoints

Wave 3 - Parallel (after Wave 2, both streams unblocked)
  ├── Jasper:    invoices + invoice_line_items tables + migrations
                 POST /api/memos/:id/approve (triggers pricing engine)
                 PATCH /api/invoices/:id, POST /api/invoices/batch-approve
                 POST /api/invoices/:id/sync-xero (writes to xero_sync_logs)
  │
  └── Kwan Hua:  GET/PATCH /api/vendor-invoices/:id (AP review)
                 POST /api/vendor-invoices/:id/sync-xero

Wave 4 - After Wave 3
  └── Liang Yi:  Executive dashboard aggregation endpoints
                 (reads bookings, invoices, vendor_invoices, service_memos)
```

---

## Flags for Team Discussion

> The following items need a whole-team decision before anyone starts coding them.

**1. `xero_sync_logs` schema ownership and import pattern**
Kwan Hua writes the migration and model file. Jasper imports the `XeroSyncLog` model to write AR sync rows. The team must agree: does Jasper import from `kwan-hua/models/XeroSyncLog.js`, or is there a shared `models/` directory? Recommend a shared `backend/src/models/` folder that all members import from.

**2. Shared `models/` directory vs per-member model files**
If each member puts their models in their own folder, cross-team imports create circular module paths. Recommend agreeing on a single `backend/src/models/index.js` that registers all Sequelize models before coding starts.

**3. `PATCH /api/bookings/:id/status` - agreed before Wave 2 starts**
Liang Yi and Jasper will both call this endpoint. Zheng Bao must have it working (or at minimum return 200 with the new status) before teammates can test their memo submission and invoice sync flows end-to-end.

**4. JWT dev secret**
All members use `DEV_JWT_SECRET=dev-secret-efar-2026` in their local `.env` file. Pre-signed tokens for all roles are in `design/jasper/api-documentation.md` - use those for all Postman/curl testing so tokens work across everyone's local setup without re-running `jwt.sign`.
