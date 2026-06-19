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
| Managing Director | Executive dashboard, macro expense analytics |
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
