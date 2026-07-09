# EFAR Digital Operations-to-Billing Platform

## Problem

EFAR (Emergencies First Aid & Rescue) is an ambulance company that relies on 2-3 staff manually transcribing handwritten field memos into invoices, chasing customer queries across WhatsApp and email, and hand-keying vendor bills into Xero - despite already having enterprise accounting software. This manual loop causes direct revenue leakage when field surcharges (overtime, multi-floor evacuations) go unrecorded on late paper slips, and caps the company's scalability because headcount must grow with every new vehicle added to the fleet.

## Solution

This platform digitises the full operations-to-billing cycle for EFAR by connecting field crews directly to the finance team through a structured digital workflow. Customer queries are captured via a standardised intake portal, field jobs are recorded on digital service memos with mandatory charge fields, and an automated pricing engine matches each job against client contracts to generate invoices - eliminating manual transcription at every step. Vendor bills are processed through OCR-powered extraction and reconciled automatically, with all financial records syncing to Xero without human copy-pasting.

## Task Allocation

| Member | Scope | Features Owned |
|--------|-------|----------------|
| Jasper | AR Billing, Pricing Engine & Invoice Sync | Automated pricing match engine, Push draft invoices to Xero, Bank feed ingestion from Xero, Client pricing contract management, Invoice review and surcharge adjustment, Batch invoice approval, Revenue leakage alert, AR batch status tracker, Memo review by AR Specialist |
| Kwan Hua | Xero Foundation, OCR & AP Processing | Xero OAuth2 connection, OCR/AI data extraction via Gemini, AP data sync to Xero, Xero sync status and error handling, Automated 1% rebate verification, Low-confidence extraction flag, AP review and approval interface, PDF vendor invoice upload |
| Zheng Bao | Customer Intake & Booking Management | Booking confirmation and rejection, Booking record and status tracking, Structured intake form, Intake queue dashboard, Service tier selector, Booking list and detail view, Crew assignment to booking, In-app notifications |
| Liang Yi | Field Operations & Executive Dashboard | Field memo form, Digital signature capture, Fleet and job status overview, Overhead cost and vendor expense summary, Mandatory revenue field validation, Hospital stamp image upload, Memo submission and AR notification trigger |
| Group | Shared Infrastructure | Auth (register, login, logout), JWT middleware and role-based route protection, Database setup and Sequelize config, Deployment (Vercel, Render, Supabase) |

> **Note (2026-07-02):** Liang Yi's Wave 2A scope (Field Operations & Executive Dashboard) was implemented by Jasper, as Liang Yi had not started coding when Wave 2 opened up. Design ownership (`design/liang-yi/`) is unchanged - Liang Yi authored the use cases, API docs, and database schema referenced above. Code and tests for this wave are committed under Jasper's name for traceability (`backend/tests/jasper/`, `frontend/tests/jasper/`). Delivered: `POST/GET /api/service-memos*`, `GET /api/dashboard/*`, the field crew "My Jobs" -> 4-step memo wizard -> "Memo History" flow, and the Managing Director's Fleet/Expense dashboard. See `my-project-ai/Jasper/handoff-2026-07-02.md` for the full session log.
>
> **Cross-team note for Zheng Bao:** `backend/src/routes/bookingRoutes.js` currently has two temporary read-only routes (`GET /my-jobs`, `GET /:id`) added only to unblock the Field Crew screens above. Please reconcile or replace them once your full booking-management routes (create, confirm/reject, `PATCH /:id/status`, crew assignment) are ready.
>
> **Note (2026-07-08):** Jasper's Wave 3 scope (AR Billing & Invoice Sync) was implemented by Kwan Hua, who took over the whole of Wave 3. Design ownership (`design/jasper/`) is unchanged - Jasper authored the AR use cases, API docs, and database schema referenced above. Code and tests for this wave are committed under Kwan Hua's name for traceability (`backend/tests/kwan-hua/pricing.test.js`). Delivered: the pricing engine (`backend/src/services/pricingService.js`), `GET /api/service-memos/pending-review`, `PATCH /api/service-memos/:id/approve` (runs the engine and generates the invoice), `PATCH /api/service-memos/:id/return`, `GET /api/invoices`, `GET /api/invoices/:id`, invoice line-item add/edit/delete, `POST /api/invoices/batch-approve`, `POST /api/invoices/:id/retry-xero` (all writing `xero_sync_logs` with `entity_type='ar_invoice'`), plus the AR frontend screens (Memo Review Queue/Detail, Invoice List, Invoice Detail) and the `db:seed:pricing` seed. Still open (not part of this takeover): pricing-contract management CRUD (Jasper's Wave 2) and the Revenue Leakage / AR Dashboard aggregation endpoints (Wave 4).

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