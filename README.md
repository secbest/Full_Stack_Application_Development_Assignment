# EFAR Digital Operations-to-Billing Platform

## Problem

EFAR (Emergencies First Aid & Rescue) is an ambulance company that relies on 2-3 staff manually transcribing handwritten field memos into invoices, chasing customer queries across WhatsApp and email, and hand-keying vendor bills into Xero - despite already having enterprise accounting software. This manual loop causes direct revenue leakage when field surcharges (overtime, multi-floor evacuations) go unrecorded on late paper slips, and caps the company's scalability because headcount must grow with every new vehicle added to the fleet.

## Solution

This platform digitises the full operations-to-billing cycle for EFAR by connecting field crews directly to the finance team through a structured digital workflow. Customer queries are captured via a standardised intake portal, field jobs are recorded on digital service memos with mandatory charge fields, and an automated pricing engine matches each job against client contracts to generate invoices - eliminating manual transcription at every step. Vendor bills are processed through OCR-powered extraction and reconciled automatically, with all financial records syncing to Xero without human copy-pasting.

## Task Allocation

Design ownership (use cases, API docs, database schema in `design/<student-name>/`) follows the original feature split below. **Implementation ownership has since shifted**: Jasper took over the whole of Wave 2 (both his own pricing engine scope and Liang Yi's field operations scope), and Kwan Hua took over the whole of Wave 3 (both his own AP scope and Jasper's AR billing/invoice sync scope). The tables below reflect current, accurate ownership for each.

### Design ownership (use cases / API docs / schema authorship)

| Member | Scope | Features Designed |
|--------|-------|----------------|
| Jasper | AR Billing, Pricing Engine & Invoice Sync | Automated pricing match engine, Push draft invoices to Xero, Bank feed ingestion from Xero, Client pricing contract management, Invoice review and surcharge adjustment, Batch invoice approval, Revenue leakage alert, AR batch status tracker, Memo review by AR Specialist |
| Kwan Hua | Xero Foundation, OCR & AP Processing | Xero OAuth2 connection, OCR/AI data extraction via Gemini, AP data sync to Xero, Xero sync status and error handling, Automated 1% rebate verification, Low-confidence extraction flag, AP review and approval interface, PDF vendor invoice upload |
| Zheng Bao | Customer Intake & Booking Management | Booking confirmation and rejection, Booking record and status tracking, Structured intake form, Intake queue dashboard, Service tier selector, Booking list and detail view, Crew assignment to booking, In-app notifications |
| Liang Yi | Field Operations & Executive Dashboard | Field memo form, Digital signature capture, Fleet and job status overview, Overhead cost and vendor expense summary, Mandatory revenue field validation, Hospital stamp image upload, Memo submission and AR notification trigger |
| Group | Shared Infrastructure | Auth (register, login, logout), JWT middleware and role-based route protection, Database setup and Sequelize config, Deployment (Vercel, Render, Supabase) |

### Implementation ownership (code + tests actually committed)

| Member | Scope built | What was delivered |
|--------|-------|----------------|
| **Jasper** | **All of Wave 2** - Field Operations & Executive Dashboard (Liang Yi's design) + Pricing Contracts (Jasper's own design) | `POST/GET /api/service-memos*`, `GET /api/dashboard/*`, the field crew "My Jobs" -> 4-step memo wizard -> "Memo History" flow, the Managing Director's Fleet/Expense dashboard, `pricing_contracts`/`pricing_rates`/`surcharge_schedules` tables and full `/api/contracts/*` CRUD (backend + frontend). Plus the interim-review follow-ups: the `job_milestones` table and `POST /api/bookings/:id/milestone` with the My Jobs current-job hero card and stepper (items #1 and #3), and conditionally-required patient fields for manpower-only standby memos (item #4, model + wizard half). Tests and commits under Jasper's name (`backend/tests/jasper/`, `frontend/tests/jasper/`). |
| **Kwan Hua** | **All of Wave 3** - AR Billing, Pricing Engine & Invoice Sync (Jasper's design) + AP Processing (Kwan Hua's own design) | The pricing engine (`backend/src/services/pricingService.js`), `GET /api/service-memos/pending-review`, `PATCH /api/service-memos/:id/approve` (runs the engine and generates the invoice), `PATCH /api/service-memos/:id/return`, `GET /api/invoices`, `GET /api/invoices/:id`, invoice line-item add/edit/delete, `POST /api/invoices/batch-approve`, `POST /api/invoices/:id/retry-xero`, plus the full AP review/approve/reject/reextract/sync-xero flow, all writing `xero_sync_logs` with the appropriate `entity_type`. Frontend: the AR screens (Memo Review Queue/Detail, Invoice List/Detail, Pricing Contracts) and the full AP screen set (Vendor Invoice List with PDF upload, the two-panel AP Invoice Review, Xero Connection settings, and the shared Xero Sync Status/retry panel), plus `db:seed:pricing`/`db:seed:xero`. Also fixed a schema bug where `xero_sync_logs.entity_id` had picked up a real foreign-key constraint against `invoices` during `db:sync` despite the column being a polymorphic key shared with `vendor_invoices` - added `constraints: false` on both associations in `models/index.js` since every AP sync (and any AR sync, previously by luck) would otherwise fail. Tests and commits under Kwan Hua's name (`backend/tests/kwan-hua/`, `frontend/tests/kwan-hua/`). |
| Zheng Bao | Customer Intake & Booking Management (Wave 1A, as designed) | Unchanged from design ownership above. |
| Liang Yi | - (design only; implementation absorbed into Jasper's Wave 2, above) | Authored the use cases, API docs, and database schema for Field Operations & Executive Dashboard; did not implement, so Jasper built this scope. |

> **Cross-team note for Zheng Bao:** `backend/src/routes/bookingRoutes.js` currently has two temporary read-only routes (`GET /my-jobs`, `GET /:id`) added only to unblock the Field Crew screens above. Please reconcile or replace them once your full booking-management routes (create, confirm/reject, `PATCH /:id/status`, crew assignment) are ready.

See `my-project-ai/Jasper/handoff-2026-07-02.md` and `my-project-ai/Tow_Kwan_Hwa/handoff-2026-07-08.md` for the full session logs behind these handovers.

## Client Feedback - Interim Review (17 Jul 2026)

Interim prototype walkthrough presented to **Geraldine (EFAR)** and **Doris Tan (Managing Director, EFAR)**, hosted by Faris Malik and Damien Tan (NYP). Source: Zoom recording transcript `GMT20260717-060320_Recording.transcript.vtt` (not committed to this repo); our slot runs 00:03:00-00:22:00 with client feedback at 00:16:10-00:21:53.

### What EFAR endorsed (keep, and lead with these in the final presentation)

- **The crew-to-HQ chain addresses the stated pain.** "It does address the pain points that we have in terms of all the manual processes... from the crew all the way to the top line, which is our HQ site."
- **Photographing the hospital stamp as the endorsement mechanism.** Named unprompted as an area we solved well.
- **The pricing contract tables.** "I think the table works perfect... the pricing is already there with all the different agreements."
- **"Assist Xero, do not replace it."** EFAR pressed a competing team hard on whether their system would displace Xero. Our pre-accounting positioning (Xero stays the master ledger, we push drafts) is the answer they wanted - state it prominently.
- **Crew collects the signature on the spot.** A competing team proposed making customers install an app to stamp memos; EFAR pushed back twice on the difficulty of forcing software onto customers. Our on-device signature plus stamp photo is a deliberate differentiator, not an accident - say so.

### Action items and owners

| # | What EFAR asked for | Affected area | Owner | Status |
|---|---|---|---|---|
| 1 | Live job milestone timestamps - crew taps a button at each stage (activated, arrived at location, en route, arrived at destination, job complete) instead of typing times at end of day | `job_milestones` table, `POST /api/bookings/:id/milestone`, My Jobs hero card, memo wizard Step 1 | **Jasper** (Wave 2 field ops) | **Delivered** |
| 2 | Derive `is_office_hours` from the real activation timestamp instead of trusting the crew's manual toggle | `backend/src/services/pricingService.js`, memo approval flow | **Kwan Hua** (Wave 3 pricing engine) | **Unblocked** - #1 is delivered, so the `activated` milestone timestamp is now available to read |
| 3 | Show the crew only the job happening now, not the whole queue - the call centre posts a case about one hour before its start time | `frontend/src/pages/jobs/MyJobsPage.jsx` | **Jasper** (Wave 2 field ops) | **Delivered** |
| 4 | Support jobs with no ambulance and no patient (manpower-only event coverage) | `backend/src/models/ServiceMemo.js`, memo wizard validation, pricing engine null-tolerance | **Jasper** (model + wizard), **Kwan Hua** (engine) | **Delivered** |
| 5 | Vendor invoices should arrive in the system automatically rather than always being uploaded by hand | AP intake, `vendor_invoices`, Xero Integration Settings screen | **Kwan Hua** (Wave 3 AP) | **Delivered** |
| 6 | Restate the Xero-stays-master and crew-collects-signature positioning up front, and open with the problem statement | Final presentation script and slides | **Group** | **Delivered** |

### Detail on each item

**1. Job milestone timestamps (largest change - it feeds billing).** Geraldine's framing at 00:17:17: *"the pricing is very dependent on the time that we pick up the patients."* Crews already record five milestones today and she wants each captured live: *"as when they reach the point, they probably just click a button to just signify that they are already at the location... rather than at the end of the day, then they decide that the only thing that they are doing is probably just to get it signed."*

**Delivered as:** a `job_milestones` table (one row per tap, unique on `booking_id` + `milestone_type`, `recorded_at` always server-set so nothing can be backdated), written by `POST /api/bookings/:id/milestone`. Milestones are enforced strictly in sequence, and recording `activated` is now the real start-job trigger that moves a booking from `confirmed` to `in_progress`. Both `GET /api/bookings/my-jobs` and `GET /api/bookings/:id` return the recorded milestones, the My Jobs hero card renders them as a tap-to-timestamp stepper, and memo wizard Step 1 pre-fills `job_start_time`/`job_end_time` from the `activated` and `job_completed` timestamps (still editable - the memo stays the document of record).

**2. Office hours derived, not asserted.** `is_office_hours` is currently a manual toggle on wizard Step 2 (`backend/src/models/ServiceMemo.js:38`). Item #1 is now delivered, so a real activation timestamp exists: read the `activated` row from `job_milestones` for the memo's booking and compute this in the pricing engine instead of trusting the toggle. It closes a genuine revenue-leakage hole and demos well.

**3. One job, not a queue.** At 00:18:26: *"there's plenty of transactions over there... could it be the case that they are going to do at that present moment, rather than the whole lot list?"* Note that mobile responsiveness (already delivered in Wave 2A) does **not** answer this - it shrinks the list rather than reducing it to one job.

**Delivered as:** `MyJobsPage.jsx` now leads with a single Current Job hero card carrying the milestone stepper from #1. The hero is the earliest `in_progress` job, or failing that the earliest `confirmed` job today whose start time is within the next hour (matching the call centre's roughly one-hour lead time). Everything else is demoted behind a collapsed "Upcoming jobs" section, which keeps the Today/Tomorrow/This Week tabs but now filters client-side from a single fetch. When no job qualifies, the hero is replaced by an explicit "No active job right now" panel and the upcoming list auto-expands. The old permanently-disabled "Start Job" button is gone - activation happens by recording the `activated` milestone on the hero.

**4. Non-ambulance event jobs.** Raised to another team at 01:11:35 and circulated to all teams by the hosts: *"we don't just operate ambulance on its own, sometimes we also have events whereby there is no ambulance at all, we just have to dispatch crew, like manpower."* We already carry `event_standby` and `workplace_standby` in the `service_type` enum, but the memo blocked them - `patient_name` and `hospital_destination` were both `allowNull: false`, so an event standby with no patient could not submit. EFAR's wider service range was also listed at 02:12:10: first aid training, events, sporting events, concerts.

**Jasper's half delivered as:** both columns are now nullable and conditionally required on `service_type` - mandatory for `eas`/`mts`, optional for the two standby types (a standby job can still record a casualty, so the fields remain available rather than hidden). The rule is enforced in the backend validator and mirrored in the wizard via `buildStep1Schema(serviceType)`, which relabels both fields "(optional)" for a standby booking. If the crew switches a standby memo to an ambulance service type on Step 2 with the patient fields blank, the final submit stops and returns them to Step 1 rather than letting a 400 land after the signature and stamp are already captured. `BKG-TEST-00005` is seeded as a manpower-only demo case.

**Kwan Hua's half delivered as:** a new `'standby'` value on the `transfer_type` ENUM (`service_memos` and `pricing_rates`, migrated via `npm run db:migrate:standby-transfer-type`, folded into `db:setup`), since a manpower-only job has no hospital transfer to describe. `seed-pricing.js` now publishes `event_standby`/`workplace_standby` rate rows keyed on `standby`, and `pricingService.js` was already null-safe on `patient_weight_kg` (the heavy-lifting surcharge simply doesn't fire when weight is null) - confirmed and locked in by two new engine tests in `backend/tests/kwan-hua/pricing.test.js`: a manpower-only memo with `patient_name`/`hospital_destination`/`patient_weight_kg` all null produces a correctly priced, matched invoice when the contract has a `standby` rate, and produces a clean `unmatched` result (not a crash) when it doesn't - matching the Raffles no-contract case.

**5. Automatic vendor invoice intake.** At 00:20:27: *"does it mean when the client sends us the invoice, we will also receive it inside the system, or we have to manually upload the vendor's invoice?"* We offered a Gmail-based ingestion path (deferred on privacy grounds) or manual PDF upload, and EFAR accepted the manual route as the interim answer.

**Delivered as:** a forwarding-inbox intake path - `POST /api/vendor-invoices/inbound-email` accepts PDF attachments from an inbound-email provider (multipart, secret-authenticated), de-duplicates on `inbound_email_id`, and drops each attachment straight into the AP review queue exactly like a manual upload would. Manual upload still ships alongside it. See `docs/AP_INBOUND_EMAIL_INTAKE.md` for the provider configuration contract and `npm run db:migrate:ap-inbound-email`; covered by `backend/tests/kwan-hua/vendor-invoices.test.js`.

**6. Delivery notes for the final.** The demo relied on live typing and was cut short twice (00:13:18, 00:15:02), leaving the Managing Director dashboard about 90 seconds. Pre-seed every record to be opened, script the click path, and open with the 30-second problem statement - EFAR asked for the problem statement up front at 00:01:44 and it had to be looked up on the call.

**Delivered as:** a standalone pitch deck (`presentation/`, React + Vite) with `Hero -> Problem -> WorkflowComparison -> Solution -> StakeholderRoles -> SuccessMetrics -> LiveAppCTA` sections, so the deck opens with the problem statement by structure. The two client-endorsed positioning lines are now in the slide copy (`presentation/src/data/content.js`): the "After" workflow step reads "Draft invoices sync to Xero - Xero stays the master ledger, we assist it, never replace it", and the Field Crew stakeholder card states crew "collects the customer signature and hospital stamp on the spot, no app required from the customer."

## How to Run Locally

### Prerequisites

- Node.js 18+
- npm 9+
- A `.env` file in `backend/` based on `backend/.env.example` (Supabase URL, JWT secrets, Cloudinary, Gemini, Xero keys)
- A `.env` file in `frontend/` based on `frontend/.env.example` (backend API URL and, for customer address search, a Google Maps browser API key)

### Database setup (run once per environment)

```bash
cd backend
npm run db:sync           # creates all tables
npm run db:seed           # inserts demo user accounts
npm run db:seed:clients   # inserts demo client records
npm run db:seed:intakes   # inserts demo intake_submissions (requires db:seed first)
npm run db:seed:bookings  # inserts demo bookings for Ravi Kumar (requires db:seed + db:seed:clients first)
npm run db:seed:xero      # inserts demo Xero connection + vendor invoices (AP - Kwan Hua)
npm run db:seed:pricing   # inserts pricing contract + rates + surcharges + review-queue memos (AR Wave 3 - Kwan Hua; requires the seeds above)
```

An existing database created before customers stopped choosing the service tier also needs this
non-destructive, idempotent constraint update:

```bash
npm run db:fix-intake-tier-nullable
npm run db:migrate:booking-quotations
```

The booking-quotation migration adds the immutable pricing snapshot passed from Quotations to AR.
When confirming an intake, Quotations now chooses an existing client contract or records a one-off
agreed base price, plus the quoted transfer and time category. Memo approval automatically uses that
frozen price when the completed service matches; a changed service combination is sent to AR for
explicit review instead of silently applying the wrong quote.

> **Upgrading an existing database:** `db:sync` runs `sequelize.sync({ alter: true })`, which adds new
> columns but does **not** add values to existing PostgreSQL `ENUM` types. The Wave 3 fixes introduce
> two new enum values (`service_memos.status = 'returned'` and
> `surcharge_schedules.surcharge_type = 'overtime_per_hour'`), so a database created before them needs
> a full rebuild rather than an alter:
>
> ```bash
> npm run db:reset -- --yes   # drops every table, recreates, and reseeds
> ```
>
> Without this, returning a memo or saving an overtime surcharge fails with an invalid-enum error.
>
> **Once a real Xero organisation is connected, prefer `db:sync` over `db:reset`.** A reset drops
> `xero_connections` along with everything else, so the OAuth consent has to be repeated. `db:sync`
> adds missing columns in place and leaves the connection intact.

Demo accounts (password: `Efar@2026`):

| Email | Role |
|-------|------|
| doris@efar.com.sg | Managing Director |
| sarah@efar.com.sg | AR Specialist |
| chloe@efar.com.sg | AP Specialist |
| camilla@efar.com.sg | Quotations Specialist |
| ravi@efar.com.sg | Field Crew |

### Frontend

```bash
cd frontend
npm install
npm run dev
```

For Google-style pickup and destination suggestions, set `VITE_GOOGLE_MAPS_API_KEY` in
`frontend/.env`, enable **Maps JavaScript API** and **Places API (New)** for that Google Cloud
project, and restrict the browser key to the application's allowed web origins. Without a key, both
fields remain usable as normal address inputs. See Google's [Place Autocomplete setup guide](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new).

### Backend

```bash
cd backend
npm install
npm run dev        # nodemon (auto-restart on change)
# or
node src/index.js  # single run
```

### Xero integration (real vs simulation)

The Xero OAuth2 connection and the AP/AR invoice sync run against the **real Xero API** when
credentials are configured, and fall back to a built-in **simulation mode** otherwise so the app is
demoable without a Xero account. Controlled by `XERO_SIMULATION` in `backend/.env`:

- `XERO_SIMULATION=true` (default): connect/callback/approve/sync/retry all succeed with generated
  identifiers - no Xero account needed.
- `XERO_SIMULATION=false`: hits the live Xero API. Requires a registered Xero app.

**To connect a real Xero organisation:**

1. Create a free app at <https://developer.xero.com> -> **My Apps** -> **New app** (Web app).
2. Set the **OAuth 2.0 redirect URI** to exactly `http://localhost:3000/api/xero/callback`
   (must match `XERO_REDIRECT_URI`).
3. Copy the **Client ID** and generate a **Client secret**.
4. In `backend/.env` set: `XERO_SIMULATION=false`, `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`,
   `XERO_REDIRECT_URI`, and a 64-char hex `XERO_ENCRYPTION_KEY`
   (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   Optionally set `XERO_SALES_ACCOUNT_CODE` / `XERO_PURCHASE_ACCOUNT_CODE` so synced invoices/bills
   are ready to approve in Xero.
5. Create a free **Demo Company** in Xero to sync into.
6. Log in as the Managing Director, open Xero Connection, and complete the OAuth consent. Tokens are
   AES-256-GCM encrypted at rest and auto-refreshed (~30 min lifetime) before each sync.

Verified working against a live Xero Demo Company on 4 Aug 2026: the authorization-code exchange,
the tenant/org lookup, encrypted token storage, and both sync directions - a draft `ACCPAY` bill and
a draft `ACCREC` invoice were created in Xero and read back to confirm their line items survived
the round trip.

**Scopes (`XERO_SCOPES`).** Xero is replacing its broad scopes with granular ones: apps registered
after **2 March 2026** are only granted the new set, while apps registered before it keep the broad
set until September 2027. The code requests the granular set by default:

```
openid profile email accounting.invoices accounting.contacts accounting.settings.read offline_access
```

`accounting.invoices` is the granular replacement for the old `accounting.transactions` and covers
both the ACCREC sales invoices and ACCPAY bills this platform creates. `accounting.settings.read`
lets the sync verify a rejected tax code against the connected organisation's active tax rates and
safely retry with a single equivalent rate. If your app predates the
cutoff and only has broad scopes, override it in `backend/.env`:

```
XERO_SCOPES=openid profile email accounting.transactions accounting.contacts accounting.settings.read offline_access
```

This matters because Xero rejects the **entire** authorize request with `invalid_scope` when any
single requested scope is unavailable to the app - which surfaces as a dead authorize link rather
than a scope problem. To see which scopes your own app actually has: **My Apps -> your app ->
Configuration -> Authorisation -> Scopes**.

**Two gotchas when running the OAuth flow locally:**

- Use `node src/index.js`, not `npm run dev`. The CSRF `state` is held in an in-memory `Set`, so a
  nodemon reload between clicking Connect and Xero redirecting back invalidates it and the callback
  returns `?error=invalid_state`.
- Don't sync before completing the consent. The seeded demo connection row carries placeholder
  plaintext tokens that can't be decrypted, so a sync attempt fails confusingly. Completing the real
  OAuth flow retires that row automatically.

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| React 18 + Vite 5 | UI framework and build tool |
| React Router DOM 6 | Client-side routing with protected routes |
| Tailwind CSS 3 | Utility-first styling |
| shadcn/ui | Accessible component primitives |
| Formik 2 + Yup | Form state and validation |
| Axios | HTTP client with JWT interceptors |
| Lucide React | Icon set |
| clsx + tailwind-merge | Conditional class merging (cn() helper) |
| MUI X Charts | Executive dashboard charts (booking status doughnut, vendor bar/line charts) |

### Backend

| Technology | Purpose |
|---|---|
| Node.js + Express 4 | API server |
| Sequelize ORM | PostgreSQL object-relational mapping |
| jsonwebtoken | JWT issuance and verification |
| bcryptjs | Password hashing |
| multer | Multipart file upload handling |
| dotenv | Environment variable loading |
| cors | Cross-origin request handling |

### Database & Infrastructure

| Service | Purpose |
|---|---|
| PostgreSQL (Supabase) | Primary relational database |
| Cloudinary | Binary file storage (vendor PDFs, hospital stamp images) |

### Third-Party APIs

| Service | Purpose |
|---|---|
| Xero API (OAuth 2.0) | Draft invoice creation, bank feed ingestion |
| Google Gemini API | OCR extraction from vendor invoice PDFs |