# EFAR Interim Review - 30 Minute Demo Script

**Goal:** show the working prototype end-to-end across the full operations-to-billing pipeline, name the two or three real gaps before the tutor finds them, and hand off cleanly between presenters.

**Presenters:** Zheng Bao, Jasper, Kwan Hua, Liang Yi
**Format:** live local run (`localhost:5173` / `localhost:3000`) unless deployed URLs are confirmed working beforehand - see Pre-Demo Checklist.

---

## Run of Show

| Time | Segment | Presenter(s) |
|---|---|---|
| 0:00-1:00 | Cold open - problem & what we'll show | Zheng Bao |
| 1:00-6:00 | Quotations: Intake Queue -> Booking | Zheng Bao |
| 6:00-12:30 | Field Crew: My Jobs -> Memo Wizard -> Memo History | Jasper |
| 12:30-14:30 | Pricing Contracts (the rules the engine reads) | Jasper |
| 14:30-20:30 | AR: Memo Review -> Pricing Match -> Invoice -> Xero Sync | Kwan Hua |
| 20:30-25:00 | AP: Vendor Invoice OCR -> Rebate Check -> Xero Sync | Kwan Hua |
| 25:00-27:30 | Executive Dashboard (Fleet + Expense) | Liang Yi narrates, Jasper drives |
| 27:30-29:30 | Gaps & completion plan | Liang Yi |
| 29:30-30:00 | Close + open floor | Zheng Bao / Liang Yi |

Each segment below has ~15-30 seconds of built-in slack for a click that's slower than expected. If you're running long, cut the second half of the AP segment (retry-logic demo) first - it's the most skippable without losing a business requirement.

---

## Why Each Feature Exists - Problem Statement Alignment

**Read this before rehearsing, especially if you're presenting a screen a teammate built.** Every feature in this demo traces back to a specific line in `project-requirement.md` - if you can't say *why* a screen exists in one sentence, that's the sentence to learn before the session, not something to wing live.

| Screen / feature you'll present | Exact problem it solves (from the problem statement) | Success metric it moves |
|---|---|---|
| Intake Queue -> Booking (Zheng Bao) | "Unstructured customer queries across WhatsApp, email, and calls creating 5-day clarification delays" | Turnaround time improvement (target 40-60%) |
| Memo Wizard - the 9 mandatory surcharge fields (Jasper) | "Handwritten paper service memos causing severe billing bottlenecks and lost paperwork" + "severe revenue leakage from unrecorded field surcharges... left off late paper slips" | Prevention of revenue leakage - target **100%** of overtime/evacuation charges captured |
| Pricing Contracts (Jasper) | "Crucial business knowledge (client rules, debt statuses) trapped in staff 'mental notes' or personal email threads" | Not a metric on its own - it's the structured data source the next feature automates against |
| Memo Review -> Pricing Match -> Invoice (Kwan Hua) | "Absence of an integrated digital operations loop connecting field ambulance crews directly to the finance team" - this is literally that loop closing | Reduction in AR manpower (target 30-50%) + clerical workload shifted to automation (target 30-50%) |
| Vendor Invoice OCR -> Rebate check (Kwan Hua) | "Duplication of effort due to AR and AP functions being handled separately" + manual hand-keying of vendor bills | Reduction in AP manpower (target 30-50%) |
| Xero sync, both AR and AP (Kwan Hua) | "Underutilization of Xero, treating it as a passive digital filing cabinet rather than leveraging its active automation features" | Turnaround time improvement (target 40-60%) |
| Executive Dashboard (Liang Yi narrates / Jasper drives) | Management's anxiety over "staff turnover disrupting financial backlogs and causing critical data loss" - the fix is a live system view that doesn't depend on any one person's memory | This is the "executive command center for real-time fleet and overhead visibility" named directly in the in-scope list |

If a tutor asks "why does this screen exist" and you weren't the one who built it, point to this table's second column rather than guessing - it's a direct quote from the requirements doc, not an interpretation.

---

## Tech Stack at a Glance

Mention this briefly during the cold open (~15 seconds, don't turn it into a slide-read) so the tutor knows what's actually powering the screens before you start clicking through them.

| Layer | What we used |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS, shadcn/ui, Formik + Yup, Axios |
| Backend | Node.js + Express, Sequelize ORM |
| Database | PostgreSQL hosted on Supabase |
| File storage | Cloudinary (vendor PDFs, hospital stamp images) |
| GenAI / OCR | Google Gemini API |
| Accounting integration | Xero API (OAuth2) - **built, but currently simulation-only for this demo**, see the Xero note under AR and in Gaps below |

---

## 0:00-1:00 - Cold Open (Zheng Bao)

**Say:**
> "EFAR is an ambulance company running its finance operations almost entirely by hand - handwritten field memos, WhatsApp and email intake, hand-keyed vendor bills - despite already paying for Xero. That causes two problems: revenue leakage, because overtime and evacuation charges get left off late paper slips, and a headcount ceiling, because every new ambulance means hiring another person to process invoices one at a time.
>
> What we've built replaces that manual chain with one connected digital pipeline: intake, to field memo, to automated pricing match, to a draft invoice ready for Xero, plus a parallel path for vendor bill OCR and reconciliation. It's built on React and Node/Express, with Postgres on Supabase, Cloudinary for file storage, and a Xero integration we'll show you honestly the state of as we go. We're going to walk it end to end, in the order the data actually flows, then tell you exactly what's left and when it lands."

Don't linger on this slide - the point is to set up *why* each next screen matters, not to re-read the problem statement.

---

## 1:00-6:00 - Quotations: Intake Queue -> Booking (Zheng Bao)

**Login:** `camilla@efar.com.sg` / `Efar@2026`

**Click path:**
1. Land on **Intake Queue** - point out the stat cards (Pending/Confirmed/Rejected) and the time-in-queue coloring (amber past 2h, red past 4h). Say this is the fix for the "5-day WhatsApp clarification loop" in the problem statement.
2. Open one pending row -> **Intake Detail**. Walk the read-only submission fields on the left.
3. Click **Confirm** -> **Booking Created** confirmation screen (mention: no email step - all confirmations are in-app toast, by design, since there's no email service in this stack).
4. Go to **Booking List** - point out the risk rows (red-tinted) for bookings missing a memo, and the memo-status column.
5. Open one booking -> **Booking Detail** - show the linked-record pattern (link back to the source intake, link forward to memo/invoice once they exist).

**Say while transitioning:** "Once a job is booked, it goes to a field crew member, and that's where the paper-slip problem used to start."

**Known limitation to mention here, briefly, in one sentence (don't dwell):**
> "The public-facing form a customer would fill in themselves isn't wired up yet on the frontend - the intake queue you're looking at is fed by seed data simulating that traffic today, and the backend endpoint it will POST to already exists and works. That's on Zheng Bao's list, covered in the gaps section."

---

## 6:00-12:30 - Field Crew: My Jobs -> Memo Wizard -> Memo History (Jasper)

**Login:** `ravi@efar.com.sg` / `Efar@2026` (My Jobs is always the landing screen for this role - no separate dashboard)

**Click path:**
1. **My Jobs** - job cards, left accent bar by status, date filter tabs. Pick a job -> **Start Job & Create Memo**.
2. **Memo Wizard Step 1 (Job Details)** - note the pre-filled/locked booking info, then job times, patient details, overtime hours, and the **evacuation floors** field. Explicitly call out: this is documentation only and does *not* by itself trigger a charge.
3. **Step 2 (Service & Charges)** - service type / transfer type dropdowns, office-hours toggle, and the 9 surcharge toggles. Name a few concretely: oxygen litres used, waiting time, patient weight, heavy lifting, resuscitation, suction, Jurong Island fee. Then show the separate **"Were stairs or elevator access required?"** toggle and explain it maps to a flat $50 inconvenience fee - a distinct concept from the evacuation-floors field in Step 1, deliberately kept separate.
4. **Step 3 (Signature)** - signature canvas, signer name/role, waiver section.
5. **Step 4 (Stamp & Submit)** - hospital stamp image upload (this is the one physical-world artifact we keep, per scope - full digital replacement of hospital stamps was explicitly out of scope for the PoC), full memo summary, Submit.
6. **Memo Submitted** confirmation, then jump to **Memo History** to show a previously submitted memo and, if one exists, a returned memo with its correction note.

**Say:** "Every one of those 9 surcharge fields is mandatory-capturable at the point of job completion, on a phone, before the crew leaves site - that's the direct fix for the 'unrecorded field charges left off late paper slips' problem in the requirements."

---

## 12:30-14:30 - Pricing Contracts (Jasper)

**Login:** stay as Ravi is fine to watch, but switch to `sarah@efar.com.sg` to actually open this screen (AR-owned).

**Click path:**
1. **Pricing Contracts list** - active/expired filter, expired contracts shown at 50% opacity.
2. Open a contract -> **Contract Detail** - rates table (inline add/edit/delete) and the surcharge schedule.

**Say:** "This is the table the pricing engine reads from in the next segment - a memo doesn't get priced off a flat rate, it's matched against the specific client's contract that was live at the time of the job. This is the direct fix for a specific line in the problem statement: client rules and pricing used to live in a staff member's head or a personal inbox - now they're a structured table that survives anyone leaving the company."

---

## 14:30-20:30 - AR: Memo Review -> Pricing Match -> Invoice -> Xero Sync (Kwan Hua)

**Login:** `sarah@efar.com.sg` / `Efar@2026`

**Click path:**
1. **Memo Review Queue** - submitted memos awaiting review, overdue rows in red.
2. Open one -> **Memo Review Detail** - scroll to the pricing-engine section (highlighted blue in the UI) showing the matched contract, rate, and calculated surcharges pulled straight from the memo's 9 fields.
3. Click **Approve & Match** - this is the actual pricing engine run (`pricingService.js`) generating the invoice live, not a canned demo value.
4. Land on **Invoice Detail** for the new invoice - point out auto-calculated line items (blue badge) vs any manually adjusted ones (amber badge).
5. Back out to **Invoice List** - name the 6 statuses (Matched/Adjusted/Approved/Synced/Failed/Unmatched) and the batch-approve button.
6. On an approved invoice, click **Sync to Xero** and show the status flip in place.

**Say:** "This whole path - memo, matched automatically, invoice generated, synced - is what 'automated booking and pricing matching' in the requirements actually means in practice: nobody on the AR team manually cross-referenced a contract to price this job. Xero is designed to stay the master ledger - we'd only ever push a draft invoice, never a finalised one. To be upfront: what you just saw sync is running against our built-in simulator, not a live Xero organisation - we haven't connected a real Xero account yet, so I don't want to overclaim that. The OAuth2 flow, token handling, and sync logic are fully built against Xero's real API, just not exercised against a live org for this demo. And separately - if a memo doesn't match any contract, it doesn't get blocked or silently dropped - it lands in the 'Unmatched' status for a human to route, which is a case we specifically hardened against."

**If asked "is this really talking to Xero or is it faked":** Answer directly - it's simulation only right now, no live Xero connection has been made yet. Don't hedge or imply otherwise. Full answer in the Q&A section below.

---

## 20:30-25:00 - AP: Vendor Invoice OCR -> Rebate Check -> Xero Sync (Kwan Hua)

**Login:** `chloe@efar.com.sg` / `Efar@2026`

**Click path:**
1. **Vendor Invoice List** - open the upload modal, drag-drop (or select) a sample vendor PDF, show the OCR confidence column color-coding as it lands in the list.
2. Open a row -> **AP Invoice Review** - two-panel layout: PDF on the left, Gemini-extracted editable fields on the right. Point out the automatic 1% rebate calculation.
3. Approve it, then go to **Xero Integration Settings** - show the screen as it stands today: disconnected / simulation mode, not a live connected organisation. Say plainly that connecting a real Xero org is a remaining step, not something already done, and point at the token-expiry warning UI as evidence the real-connection state is built and ready to receive one.
4. Finish on **Xero Sync Status** - stat cards, and if time allows, show the retry button and mention the max-3-attempt warning threshold. These all work the same whether the underlying sync is simulated or real - it's the same status pipeline either way.

**Say:** "This is the other half of the duplication problem in the requirements - AP and AR used to be handled as two completely separate manual chains. This screen is the direct fix for AP hand-keying specifically: instead of someone retyping every vendor bill line by line, Gemini extracts it and a human just verifies and corrects, and the 1% rebate check that used to be a manual calculation now runs automatically. Both AP and AR now write to the same `xero_sync_logs` trail, so one team can see sync health across both instead of two disconnected systems."

---

## 25:00-27:30 - Executive Dashboard (Liang Yi narrates, Jasper drives)

**Login:** `doris@efar.com.sg` / `Efar@2026`

**Liang Yi opens:**
> "This is the screen I originally designed the use cases and schema for - the Managing Director's real-time view into fleet activity and overhead cost. Jasper ended up building the implementation as part of picking up this wave, so I'll hand the keyboard to him, but I'll pick back up right after on what's still mine to finish."

**Jasper drives:**
1. **Fleet tab** - 4 KPI cards, booking-status doughnut chart, and the revenue-leakage alert panel - tie this explicitly back to the "prevention of revenue leakage" success metric from the requirements doc.
2. **Expense tab** - 3 KPI cards, interactive vendor bar chart, read-only vendor invoice table.

**Say (Liang Yi, before handing to Jasper, or Jasper if it flows better):** "The reason this exists at all is in the problem statement directly - management described feeling anxious about staff turnover wiping out financial visibility, because so much of it lived in one person's head. This dashboard is the antidote: fleet status, overhead cost, and revenue leakage, live off the same database everyone else's screens write to, not a report someone assembles once a week."

Keep this tight - 90 seconds of screen time, because the next segment (gaps) needs the remaining runway and follows on directly from this same screen.

---

## 27:30-29:30 - Gaps & Completion Plan (Liang Yi)

This is Liang Yi's segment to own outright - it's a strength, not a weakness, that the team can name its own gaps unprompted before being asked.

**Say (adapt naturally, don't read verbatim):**
> "I want to be upfront about exactly what's not done yet, because it's a short, specific list and every item has an owner and a plan.
>
> **First, two screens under this same Executive Dashboard are still mine to build: Reports and Accounts Management.** Reports covers four tabs - revenue, billing cycle, leakage history, and vendor expenditure - with CSV/PDF export, and Accounts Management is the user directory with force-logout, unlock, and remove actions plus an add-user flow. Neither has a line of code yet; both are fully scoped from the use cases and API docs I wrote earlier in the project, and both read from data endpoints that already exist - the dashboard and invoice APIs Jasper and Kwan Hua built. My plan is Reports first, since it's more visible to a client, then Accounts Management, both targeted for completion well ahead of the final review.
>
> **Second, the public customer-facing intake form's frontend isn't wired up** - Zheng Bao has the backend endpoint live and tested; the form component itself is next on his list.
>
> **Third, Zheng Bao's full booking-management routes are still using two temporary read-only endpoints** we added just to unblock the field crew screens you saw earlier - creating, confirming/rejecting, and crew assignment need to move off those temporary routes onto the real ones.
>
> **Fourth, test coverage isn't even across the team yet.** Jasper and Kwan Hua have committed automated tests; Zheng Bao and I currently have documented test-case lists but haven't written the executable tests yet - that's happening before submission, not left to the end.
>
> **Fifth, and I'll say this one plainly since you'll have noticed it during the AR and AP walkthrough: our Xero integration is simulation-only today.** We have not yet connected a real Xero organisation. The OAuth2 flow, encrypted token storage, and sync logic are fully built against Xero's actual API - switching it on is a config change plus registering a Xero developer sandbox app, not a rebuild - but we haven't done that step yet, so we're not going to claim a live connection we don't have. That's scheduled before the final review.
>
> **Sixth, one item from the original scope is only half-built: Xero bank feed ingestion.** The problem statement specifically calls out syncing 'draft invoices and bank feeds' - we've built the draft invoice half for both AR and AP, and our sync log schema already reserves a category for bank feeds, but there's no actual bank feed ingestion or reconciliation screen yet, and no dedicated AR-specific dashboard either - today, revenue-leakage alerting lives on this Executive Dashboard rather than a separate AR view. That's on Kwan Hua's list alongside the real Xero connection work, since it sits in the same part of the system."

**Close the segment:**
> "None of these block the core pipeline you just saw working end to end - they're additive screens and coverage, not missing plumbing."

---

## 29:30-30:00 - Close (Zheng Bao or Liang Yi)

> "So: intake to booking, booking to field memo, memo to automated pricing match, match to Xero draft invoice, plus the parallel AP OCR and reconciliation path - all live, all backed by a real Postgres schema and a real pricing engine, not mocked data. Happy to take questions, or go deeper on any one screen."

---

## Pre-Demo Checklist

- [ ] `cd backend && npm run dev` and `cd frontend && npm run dev` both running and healthy (`GET /health` returns OK) at least 10 minutes before the session, not started live.
- [ ] Confirm `XERO_SIMULATION=true` in `backend/.env` before the session (this is the actual current state - no live Xero org is connected). Do not attempt to demo a real Xero connection unless someone has genuinely completed the developer-app registration and OAuth consent beforehand.
- [ ] Re-run seed scripts in order if the DB was reset recently: `db:sync` -> `db:seed` -> `db:seed:clients` -> `db:seed:intakes` -> `db:seed:bookings` -> `db:seed:xero` -> `db:seed:pricing`.
- [ ] Pre-open 5 browser tabs/profiles logged in as each demo account (`camilla`, `ravi`, `sarah`, `chloe`, `doris`, all password `Efar@2026`) so no one fumbles a login live.
- [ ] Have one already-submitted memo and one already-approved invoice sitting in the data, in addition to a fresh one you'll create live - so if the live pricing-match click hangs, you can pivot to the pre-made example without dead air.
- [ ] Confirm who is physically driving the keyboard/screen-share for each segment vs. narrating, especially the Executive Dashboard handoff (Liang Yi narrates, Jasper drives).
- [ ] Time a full dry run once. This script is paced to ~30 minutes with each segment already having slack built in; if the dry run runs long, cut from the AP retry-logic demo first (noted above), not from the gaps section.

---

## Anticipated Questions & Answers

**"Is the Xero sync actually hitting the real Xero API, or is it simulated?"**
It's simulated - say this plainly, don't hedge. We have not connected a real Xero organisation yet. `XERO_SIMULATION=true` runs the full OAuth/connect/sync/retry flow against a built-in simulator so the app is demoable without a live Xero account, and that's the mode we're in today. The real-mode path is fully built - `XERO_SIMULATION=false` would hit the actual Xero API with AES-256-GCM-encrypted tokens and auto-refresh - but it requires registering a Xero developer sandbox app and completing OAuth consent, which is still on our list, not done. Offer to show the real-mode config in `README.md` if they want to see it's genuinely built, not just planned.

**"What happens if a memo doesn't match any pricing contract?"**
It lands in the invoice list with an "Unmatched" status rather than blocking or silently failing - this was a specific edge case we found and fixed (a `NOT NULL` constraint on `contract_id` was incorrectly blocking unmatched invoices from being created at all).

**"How is auth/security handled?"**
JWT-based auth with role-based route protection on both the frontend (protected/role routes) and backend (middleware on every route file), bcrypt password hashing. No plaintext credentials anywhere, `.env` files are gitignored with `.env.example` placeholders committed instead.

**"Why did implementation ownership shift away from the original design split?"**
Straightforward project-management answer: design ownership (use cases/API docs/schema) stayed with whoever authored it; implementation got reassigned mid-project to balance capacity across the team, which is exactly why the README documents both the original design split and the current, accurate implementation split side by side - it's traceable in git history, not hidden.

**"What's your plan if a client wants a feature you haven't scoped at all?"**
Point to the "Out of Scope" section of the problem statement (full hospital-stamp digitisation, HR/payroll/rostering) as the model for how the team handles scope - explicitly bounded PoC scope with a documented reason, not an oversight.

**"Can you show me the database / how memo data becomes an invoice line item?"**
Yes - this is a good moment to open `pricingService.js` briefly if asked to go one level deeper, or the `pricing_contracts` / `pricing_rates` / `surcharge_schedules` tables via the Contract Detail screen already shown.

**"What's actually deployed vs. local-only right now?"**
Check `deployment.md` immediately before the session for current state and answer factually - don't guess live.

**"The problem statement mentions bank feed ingestion from Xero - does this system actually do that?"**
Not yet - be direct about it. We built the draft-invoice sync side of that scope line for both AR and AP, and the sync log schema already has a category reserved for bank feeds, but there's no working ingestion or reconciliation screen. It's an acknowledged gap (see the Gaps & Completion Plan), owned by Kwan Hua alongside the rest of the Xero work.
