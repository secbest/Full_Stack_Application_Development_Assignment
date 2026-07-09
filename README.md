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
| **Jasper** | **All of Wave 2** - Field Operations & Executive Dashboard (Liang Yi's design) + Pricing Contracts (Jasper's own design) | `POST/GET /api/service-memos*`, `GET /api/dashboard/*`, the field crew "My Jobs" -> 4-step memo wizard -> "Memo History" flow, the Managing Director's Fleet/Expense dashboard, `pricing_contracts`/`pricing_rates`/`surcharge_schedules` tables and full `/api/contracts/*` CRUD (backend + frontend). Tests and commits under Jasper's name (`backend/tests/jasper/`, `frontend/tests/jasper/`). |
| **Kwan Hua** | **All of Wave 3** - AR Billing, Pricing Engine & Invoice Sync (Jasper's design) + AP Processing (Kwan Hua's own design) | The pricing engine (`backend/src/services/pricingService.js`), `GET /api/service-memos/pending-review`, `PATCH /api/service-memos/:id/approve` (runs the engine and generates the invoice), `PATCH /api/service-memos/:id/return`, `GET /api/invoices`, `GET /api/invoices/:id`, invoice line-item add/edit/delete, `POST /api/invoices/batch-approve`, `POST /api/invoices/:id/retry-xero`, plus the full AP review/approve/reject/reextract/sync-xero flow, all writing `xero_sync_logs` with the appropriate `entity_type`. Frontend: the AR screens (Memo Review Queue/Detail, Invoice List/Detail, Pricing Contracts) and the full AP screen set (Vendor Invoice List with PDF upload, the two-panel AP Invoice Review, Xero Connection settings, and the shared Xero Sync Status/retry panel), plus `db:seed:pricing`/`db:seed:xero`. Also fixed a schema bug where `xero_sync_logs.entity_id` had picked up a real foreign-key constraint against `invoices` during `db:sync` despite the column being a polymorphic key shared with `vendor_invoices` - added `constraints: false` on both associations in `models/index.js` since every AP sync (and any AR sync, previously by luck) would otherwise fail. Tests and commits under Kwan Hua's name (`backend/tests/kwan-hua/`, `frontend/tests/kwan-hua/`). |
| Zheng Bao | Customer Intake & Booking Management (Wave 1A, as designed) | Unchanged from design ownership above. |
| Liang Yi | - (design only; implementation absorbed into Jasper's Wave 2, above) | Authored the use cases, API docs, and database schema for Field Operations & Executive Dashboard; did not implement, so Jasper built this scope. |

> **Cross-team note for Zheng Bao:** `backend/src/routes/bookingRoutes.js` currently has two temporary read-only routes (`GET /my-jobs`, `GET /:id`) added only to unblock the Field Crew screens above. Please reconcile or replace them once your full booking-management routes (create, confirm/reject, `PATCH /:id/status`, crew assignment) are ready.

See `my-project-ai/Jasper/handoff-2026-07-02.md` and `my-project-ai/Tow_Kwan_Hwa/handoff-2026-07-08.md` for the full session logs behind these handovers.

## How to Run Locally

### Prerequisites

- Node.js 18+
- npm 9+
- A `.env` file in `backend/` based on `backend/.env.example` (Supabase URL, JWT secrets, Cloudinary, Gemini, Xero keys)
- A `.env` file in `frontend/` based on `frontend/.env.example` (backend API URL)

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

## Session Logs
C:\Users\<your-username>\.claude\projects\<code-folder>\