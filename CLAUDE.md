# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**EFAR Digital Operations-to-Billing Platform** - a full-stack proof-of-concept for Emergencies First Aid & Rescue (EFAR), an ambulance company. The app automates financial workflows: customer intake -> field service memos -> automated pricing matching -> Xero invoice sync. The pain it solves is manual transcription causing revenue leakage and billing bottlenecks.

Key reference documents in the repo root:
- `project-requirement.md` - full problem statement, scope, and success criteria
- `submission-guide.md` - required folder structure, deliverables checklist, and submission rules

---

## Repository Structure (Target Layout)

The repo is a group assignment with per-student folders for design docs and tests:

```
├── design/                        # Group + individual design docs
│   └── <student-name>/            # use-cases.md, api-documentation.md, database-schema.md
├── frontend/                      # React app
│   ├── src/                       # structure decided by team
│   ├── tests/<student-name>/      # Jest unit tests per student
│   └── .env.example
├── backend/                       # Node.js / Express API
│   ├── src/                       # routes, controllers, models, middleware
│   ├── tests/<student-name>/      # unit tests per student
│   └── .env.example
├── deployment.md
└── README.md
```

---

## Commands

Once implemented, the expected commands are:

**Frontend**
```bash
cd frontend
npm install
npm run dev        # local dev server
npm run build      # production build (must pass before submission)
npm test           # run Jest unit tests
```

**Backend**
```bash
cd backend
npm install
node src/index.js  # start server (or equivalent npm start)
npm test           # run unit tests
```

---

## Backend Dev Server Management (Port 3000)

The backend runs on plain `node` (not `nodemon`), so code changes never hot-reload -
the process must be killed and restarted after every backend edit for it to take
effect. `predev`/`npm run dev` refuses to start (and `npm start` binds a second
process) if port 3000 is already in use, which is the #1 cause of "I can't run the
backend."

Rules to follow every time the backend is started/restarted in this session:
- Before starting the backend in the background, always check `netstat -ano | grep ":3000" | grep LISTENING` first. If something is already listening, kill that PID before starting a new one - never stack a second process on top.
- After finishing a task that involved a background-started backend (testing an endpoint, verifying a fix), kill that background process before ending the turn. Do not leave it running "in case it's still needed" - an orphaned backend process on port 3000 is exactly what blocks the user's own `npm run dev` afterwards.
- If the currently running process was started by the user (not by this session), ask before killing it. If it was started by this session's own background restart, killing it to free the port is expected cleanup, not a destructive action.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite, shadcn/ui, Formik, Yup, Axios |
| Backend | Node.js + Express, Sequelize ORM, Yup |
| Database | PostgreSQL hosted on Supabase |
| Images | Cloudinary |
| GenAI | Gemini API |
| Accounting | Xero API (draft invoices, bank feeds) |

---

## Key Domain Concepts

- **Service Memo** - field record created by ambulance crew capturing job details, overtime, and evacuation charges. The digital version replaces handwritten paper slips that caused revenue leakage.
- **Pricing Contract** - client-specific pricing tables stored in PostgreSQL. The system auto-matches field memo data against these to generate billing amounts.
- **Xero Sync** - after matching, draft invoices are pushed to Xero. The app is pre-accounting; Xero remains the master ledger.
- **AR flow** - intake → field memo → pricing match → Xero draft invoice (managed by Sarah).
- **AP flow** - vendor PDF upload → OCR extraction → rebate verification → AP reconciliation (managed by Chloe).

## User Roles

| Role | Key Actions |
|---|---|
| Managing Director | Executive dashboard, macro expense analytics, user account management |
| AR Specialist | Validate booking matches, adjust surcharges, sync to Xero |
| AP Specialist | Review OCR-extracted vendor invoices, reconcile bank feeds |
| Quotations Specialist | Manage structured intake queue, verify service tiers |

---

## Environment Variables

Never commit `.env` files. Both `frontend/.env.example` and `backend/.env.example` must exist with placeholder keys only. Expected variables include Supabase database URL, Cloudinary credentials, Gemini API key, and Xero API credentials.

---

## Writing Style

Use a hyphen (`-`) instead of an em dash (`—`) in all generated documents (markdown files, comments, README, etc.).

---

## Assignment Submission Notes

- Each student owns their own `design/<student-name>/`, `frontend/tests/<student-name>/`, and `backend/tests/<student-name>/` folders.
- Git history is part of the submission - commit regularly with meaningful messages so individual contributions are traceable.
- All tests must pass before submission (`npm run build` for frontend, `node src/index.js` must start without errors for backend).
- AI usage logs (`.jsonl` from Claude Code) are submitted separately in `your-project-ai/<student-name>/` - keep them updated throughout all phases, not just the final sprint.

---

## Figma Make Prototype Reference

The folder `Design login screen for EFAR/` in the repo root is the Figma Make export used as the visual and structural reference for frontend implementation. Do not delete it. When implementing UI, match this prototype's layout, colors, and component patterns exactly.

Full screen prompts and navigation map are in `design/figma-make-prompts.md`.

### Prototype File Map

| File | Role covered |
|---|---|
| `src/app/App.tsx` | Login screen + role-based routing entry point |
| `src/app/shared.tsx` | Shared components (ToastContainer, XeroSyncTable, mock data arrays) |
| `src/app/APApp.tsx` | AP Specialist (Chloe Tan) - Xero settings, sync status |
| `src/app/ARApp.tsx` | AR Specialist (Sarah Lim) - memo review, invoices, pricing contracts |
| `src/app/FieldApp.tsx` | Field Crew (Ravi Kumar) - My Jobs, memo wizard |
| `src/app/MDApp.tsx` | Managing Director (Doris Tan) - executive dashboard |

### Role Routing (Login)

After login, role is detected from the email and the app renders the matching component:

| Email keyword | Role | User | Landing screen |
|---|---|---|---|
| `ravi` | field | Ravi Kumar | My Jobs |
| `chloe` | ap | Chloe Tan | Vendor Invoice List (no AP dashboard - see Logic Correction 6) |
| `sarah` | ar | Sarah Lim | Invoice List (no AR dashboard - see Logic Correction 6) |
| `doris` | md | Doris Tan | Executive Dashboard |
| anything else | quotations | Camilla Wong | Intake Queue |

### Design Tokens

These exact values must be used across all frontend screens:

**Colors**
```
Background:        #F8FAFC
Card/panel:        #FFFFFF
Sidebar bg:        #1E293B
Sidebar hover:     #0F172A
Primary button:    #1E293B (bg), #FFFFFF (text)
Destructive:       #EF4444 (bg), #FFFFFF (text)
Success:           #22C55E
Warning:           #F59E0B
Error:             #EF4444
Info/accent:       #3B82F6
Muted text:        #64748B
Placeholder text:  #94A3B8
Border/divider:    #E2E8F0
Row hover:         #F1F5F9
Alt row bg:        #F8FAFC
Risk row bg:       #FEF2F2
```

**Typography (Inter font)**
```
Page title:        24px Bold   #1E293B
Card header:       16px 600    #1E293B
Body/form text:    14px 400    #1E293B
Labels:            12px 500    #64748B  uppercase where used as table headers
Timestamps/micro:  12px 500    #64748B
```

**Layout**
```
Sidebar width:     240px fixed left
Header height:     64px fixed top
Content padding:   32px
Card radius:       12px
Card border:       1px #E2E8F0
Card shadow:       0 1px 3px rgba(0,0,0,0.08)
Button height:     44-48px (primary), 32px (inline table actions)
Input height:      44px
Input radius:      8px
Input border:      #E2E8F0, focused: #3B82F6
```

**Status badge pattern** - pill shape, 6px radius, 15% opacity background with matching text:
```
Pending/In Progress/Warning:  #F59E0B
Confirmed/Info/Matched:       #3B82F6
Approved/Synced/Success:      #22C55E
Rejected/Failed/Error:        #EF4444
Expired/Neutral:              #94A3B8
```

### Screen Inventory

#### Quotations Specialist (Camilla Wong)
1. **Intake Queue** - stat cards (Pending/Confirmed/Rejected counts), filterable table, time-in-queue coloring (amber >2h, red >4h), [Review] action
2. **Intake Detail** - 60/40 layout, read-only submission fields left, confirm+reject actions right; creates booking on confirm
3. **Booking Created** - success confirmation with booking reference
4. **Booking List** - 4 stat cards, table with risk rows (#FEF2F2) for missing memos, memo status column
5. **Booking Detail** - 3-column layout (details / status timeline / crew assignment + linked records)

#### AR Specialist (Sarah Lim)
6. ~~**AR Dashboard**~~ - **DROPPED, do not build.** See Logic Correction 6. Sarah lands on the Invoice List instead.
7. **Memo Review Queue** - table of submitted memos awaiting review, overdue rows in red
8. **Memo Review Detail** - 60/40 layout, all memo fields with pricing engine section highlighted blue, approve/return actions
9. **Invoice List** - 6 status types (Matched/Adjusted/Approved/Synced/Failed/Unmatched), batch approve button
10. **Invoice Detail** - line items table with auto (blue) vs manual (amber) badges, approve/sync/reject actions
11. **Pricing Contracts List** - active/expired filter, expired rows at 50% opacity
12. **Contract Detail** - rates table with inline add/edit/delete, surcharge schedule with edit mode
13. **Create/Edit Contract Form** - contract details + initial rates section, sticky save footer
14. **Xero Sync Status** - shared with AP, stat cards, retry logic, max-retry warning (3 attempts)

#### AP Specialist (Chloe Tan)
15. ~~**AP Dashboard**~~ - **DROPPED, do not build.** See Logic Correction 6. Chloe lands on the Vendor Invoice List instead.
16. **Vendor Invoice List** - upload modal (PDF drag-drop), OCR confidence column, color-coded confidence %
17. **AP Invoice Review** - two equal panels: PDF viewer left, AI-extracted editable fields right; rebate auto-calculation
18. **Xero Integration Settings** - connected/disconnected states, token expiry warning, sync overview
19. **Xero Sync Status** - shared with AR (see item 14)

#### Field Crew (Ravi Kumar)
20. **My Jobs** - job cards with left accent bar (color by status), date filter tabs (Today/Tomorrow/This Week), status-specific action buttons
21. **Memo Wizard Step 1 - Job Details** - pre-filled booking info (locked), job times, patient details, overtime hours, evacuation floors
22. **Memo Wizard Step 2 - Service & Charges** - service type/transfer type dropdowns, office hours toggle, 9 surcharge toggles
23. **Memo Wizard Step 3 - Signature** - signature canvas, signer name/role, waiver collapsible section
24. **Memo Wizard Step 4 - Stamp & Submit** - hospital stamp upload, full memo summary, submit button
25. **Memo Submitted** - success confirmation with memo reference, two navigation buttons
26. **Memo History** - table with inline accordion expand (no separate detail screen), returned memos show correction note

#### Managing Director (Doris Tan)
27. **Executive Dashboard - Fleet tab** - 4 KPI cards, doughnut chart (booking status), revenue leakage alert panel
28. **Executive Dashboard - Expense tab** - 3 KPI cards, vendor bar chart (interactive), vendor invoice table (read-only)
29. **Reports** - 4 tab types (Revenue/Billing Cycle/Leakage History/Vendor Expenditure), period selector, export CSV/PDF
30. **Accounts Management** - search/filter action bar (name/email search, role filter, status filter), 3 KPI cards (Total Users/Currently Online/Security Alerts), user directory table (name+email, role, status dot, last login, actions), row actions (Force Logout, Unlock, Remove), [+ Add New User] modal (name/email/role fields with validation)

### Logic Corrections (Must Follow in Implementation)

These override the use case documents where they conflict:

1. **Pricing engine fields on memo** - The memo review screen must show ALL 9 surcharge fields: `oxygen_litres_used`, `has_inconvenience_fee`, `disposables_used`, `has_resuscitation_fee`, `has_suction_fee`, `has_jurong_island_fee`, `waiting_time_minutes`, `patient_weight_kg`, `has_heavy_lifting_fee`. Do not abbreviate.

2. **Field crew landing screen** - "My Jobs" is always the first screen after field crew login. There is no separate dashboard for this role.

3. **Intake form fields** - `service_type` (EAS/MTS/Event Standby/Workplace Standby) and `service_tier` (Basic/Advanced/Critical) are two separate dropdowns. Never merge them into one.

4. **Evacuation vs inconvenience** - The memo wizard must show BOTH: a numeric `evacuation_floors` field (documentation only, does not affect billing) AND a separate boolean toggle "Were stairs or elevator access required?" that maps to `has_inconvenience_fee` (flat $50 surcharge). One does not replace the other.

5. **No email confirmations** - There is no email service in the stack. All confirmations use in-app toast notifications (bottom-right, 8s auto-dismiss, green success / red error). Never show "confirmation email sent" language.

6. **No AR or AP dashboard** - The Managing Director is the only role with a dashboard. Screens 6 (AR Dashboard) and 15 (AP Dashboard) in the prototype are dropped and must not be built. Both specialists land directly on their work queue:

   | Role | Landing screen | Route |
   |---|---|---|
   | AR Specialist (Sarah) | Invoice List | `/invoices` |
   | AP Specialist (Chloe) | Vendor Invoice List | `/vendor-invoices` |

   The dropped dashboards' content is either already covered elsewhere or intentionally out of scope:
   - *Invoice / vendor-invoice status breakdown* - covered by the status filter chips with live counts at the top of each list screen.
   - *Revenue leakage alerts* - covered by the standalone Revenue Leakage report at `/reports/revenue-leakage`, visible to both the MD and the AR Specialist.
   - *Xero bank feed* - out of scope. `bank_feed` exists only as an unused `entity_type` enum value on `xero_sync_logs`; there is no bank-feed UI and none is required.
   - *Recent activity list / quick actions* - out of scope. The sidebar is the navigation surface for both roles.

   Screen numbering is deliberately NOT re-sequenced after these two removals - existing code comments cite screens by number (for example "Invoice List (screen 9)"), so 6 and 15 remain as tombstones.

### Navigation Map Summary

```
Login
  → quotations  → Intake Queue
  → ar          → Invoice List        (no AR dashboard)
  → ap          → Vendor Invoice List (no AP dashboard)
  → field       → My Jobs
  → md          → Executive Dashboard

Intake Queue → [Review] → Intake Detail
Intake Detail → [Confirm] → Booking Created → Booking List
Intake Detail → [Reject]  → toast + Intake Queue

Booking List → [View] → Booking Detail
Booking Detail → "Linked Intake" link → Intake Detail (read-only)
Booking Detail → "Service Memo" link  → Memo Review Detail (read-only)
Booking Detail → "Invoice" link       → Invoice Detail (read-only)

My Jobs → [Start Job & Create Memo] → Memo Wizard (Step 1-4)
Memo Wizard Step 4 → [Submit] → Memo Submitted → My Jobs or Memo History

Memo Review Queue → [Review] → Memo Review Detail
Memo Review Detail → [Approve & Match] → Invoice Detail (new invoice)
Memo Review Detail → [Return]          → toast + Memo Review Queue

Invoice List → [Review/View] → Invoice Detail
Invoice Detail → [Approve]     → status updates in-place, Sync button appears
Invoice Detail → [Sync to Xero] → status updates in-place
Invoice Detail → [Reject Match] → confirmation modal → Memo Review Queue

Vendor Invoice List → [Review] → AP Invoice Review
AP Invoice Review → [Approve] → toast + Vendor Invoice List
AP Invoice Review → [Reject]  → confirmation modal + Vendor Invoice List

Executive Dashboard Fleet tab ↔ Expense tab (secondary tabs, no route change)
Executive Dashboard → sidebar Reports → Reports screen
Executive Dashboard → sidebar Accounts → Accounts Management screen
Accounts Management → [+ Add New User] → modal → toast + updated user directory table
```

### Public Intake Form Note

The public-facing intake form (Wave 1A Steps 1-2) was **not designed in Figma Make** and is **not in the frontend prototype**. The intake queue is seeded with sample `intake_submissions` records to simulate arriving requests.

This does NOT mean the feature is dropped. The following must still be implemented:
- **Backend:** `POST /api/intake` endpoint (no auth required) and the `intake_submissions` table - see `design/zheng-bao/api-documentation.md` and `design/zheng-bao/database-schema.md`
- **Frontend:** A public route (no login required) with the intake form, submitting to the above endpoint

The Quotations Specialist workflow (intake queue, booking confirmation, booking management - Steps 3-6) is fully prototyped and unchanged.
