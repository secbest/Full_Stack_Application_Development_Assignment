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

> **Note (2026-07-02):** Liang Yi's Wave 2A scope (Field Operations & Executive Dashboard) is being implemented by Jasper, as Liang Yi had not yet started coding when Wave 2 opened up. Design ownership (`design/liang-yi/`) is unchanged - Liang Yi authored the use cases, API docs, and database schema referenced above. Code and tests for this wave are committed under Jasper's name for traceability (`backend/tests/jasper/`, `frontend/tests/jasper/`). See `my-project-ai/Jasper/handoff-2026-07-02.md` for details.

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

## Progress Log

### 2026-06-29 - Wave 0: Auth Foundation & Login UI (Kwan Hua)

**Shared infrastructure (group scope)**

- **Login page** (`frontend/src/pages/auth/LoginPage.jsx`) - Full two-panel login screen matching the Figma design: branding panel left, form right. Includes show/hide password toggle, role-based redirect after login (email keyword maps to role home screen), loading spinner, and inline error display.
- **Client-side form validation** - Email format check and minimum password length (6 characters) validated on blur and on submit. Field-level error messages appear below each input with a red border; errors clear as the user corrects their input.
- **Backend DB connection fix** (`backend/src/config/index.js`) - Sequelize was silently ignoring SSL options when given a raw connection URI, causing `ECONNRESET` errors against Supabase. Refactored to parse the URL manually and pass host, port, username, password, and database as discrete options so SSL is always applied. Added connection pooling.
- **Non-fatal DB startup** (`backend/src/index.js`) - The server no longer crashes if the database is unreachable at startup. The connection check runs in the background and logs a warning instead of throwing an unhandled rejection.
- **Auth error masking** (`backend/src/controllers/authController.js`) - The login endpoint now returns "Invalid email or password." for all failures, including internal DB errors, instead of leaking the raw exception message (e.g. `ENOTFOUND`).
- **DB scripts** (`backend/package.json`) - Added `npm run db:sync` (creates tables via Sequelize sync) and `npm run db:seed` (inserts the five demo user accounts).
- **Deployment docs** (`deployment.md`) - Documented the full local dev setup: prerequisites, install steps, env file configuration, DB sync/seed instructions, and demo account credentials.

### 2026-07-01 - Demo Data Seeding (Kwan Hua)

- **Client seed script** (`backend/src/scripts/seed-clients.js`) - Inserts five demo client records (Raffles Medical Group, Marina Bay Sands Expo, ST Engineering, Jurong Island Industrial Corp, Singapore Sports Hub) used as pricing-contract counterparties. Uses `findOrCreate` on `contact_email` so it is safe to re-run without creating duplicates.
- **Intake submission seed script** (`backend/src/scripts/seed-intakes.js`) - Populates the Quotations Specialist's intake queue with sample `intake_submissions` so the booking workflow has data to test against: 2 pending, 4 confirmed, and 2 rejected records with realistic Singapore hospital/venue details. Looks up Camilla's user ID at runtime (`reviewed_by` FK) instead of hardcoding it, and requires `seed-users.js` to have run first. Uses `findOrCreate` on `reference_number` so it is safe to re-run.

### 2026-07-02 - Wave 2A Handover: Field Operations & Executive Dashboard (Jasper covering Liang Yi's scope)

- **Status check before starting:** Confirmed via git branches and `backend/src/routes/index.js` that only Wave 0 (auth) is actually implemented in the backend. Zheng Bao's Wave 1 routes (`bookingRoutes`, `intakeRoutes`) and the `PATCH /api/bookings/:id/status` endpoint are not yet built - only the model layer and an in-memory stub (`backend/src/stubs/intake-booking.js`) exist. Only one migration (`create-users`) has been run; `bookings`/`clients` tables do not yet exist in the actual database.
- **Decision:** Proceed with Wave 2A now, building against the existing stub data (`backend/src/stubs/intake-booking.js`, which already mirrors the planned `PATCH /api/bookings/:id/status` transition rules) rather than waiting on Zheng Bao's real tables, per the "Can Mock?" column in `design/feature-dependencies.md`.
- **Known risk (resolved 2026-07-02):** Confirmed the project doesn't use migrations for schema deployment - `npm run db:sync` (`sequelize.sync({ alter: true })`) creates every registered model together in one pass, so `bookings` and `service_memos` land in the same sync with no FK-ordering problem. Ran `db:sync` against the shared Supabase DB and seeded test bookings (`db:seed:bookings`) for Ravi Kumar so the memo wizard can be tested end-to-end without waiting on Zheng Bao's intake/booking confirmation flow.
- **Attribution:** Design docs in `design/liang-yi/` remain authored by Liang Yi. Code, migrations, and tests for this wave are being committed under Jasper to keep Git history traceable to the actual author.

## Session Logs
C:\Users\<your-username>\.claude\projects\<code-folder>\