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
| 25:00-28:30 | Executive Dashboard: Fleet + Expense, then Reports & Accounts Management | Liang Yi narrates Fleet/Expense (Jasper's build), drives Reports/Accounts Management (Liang Yi's own build) |
| 28:30-29:30 | Gaps & completion plan | Liang Yi |
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
| Executive Dashboard - Fleet/Expense (Liang Yi narrates / Jasper drives) | Management's anxiety over "staff turnover disrupting financial backlogs and causing critical data loss" - the fix is a live system view that doesn't depend on any one person's memory | This is the "executive command center for real-time fleet and overhead visibility" named directly in the in-scope list |
| Reports (Liang Yi) | Gives the Managing Director self-serve access to "macro expense analytics" without waiting on someone to assemble a report - the Leakage History tab specifically is the auditable trail behind the revenue-leakage metric, not just a live alert | Prevention of revenue leakage - target **100%** (same metric as the memo surcharge fields, viewed historically instead of live) |
| Accounts Management (Liang Yi) | The other half of the "staff turnover" anxiety line - not just losing visibility when someone leaves, but losing control of their access. Force Logout/Unlock/Remove let the Managing Director act on a departure immediately instead of filing an IT ticket | Directly supports the "executive command center" in-scope line - fleet/overhead visibility plus the account control to back it up |

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

**Update since last rehearsal - this is now fixed, not a gap:**
> "Until recently, the public-facing form a customer would fill in themselves wasn't wired up on the frontend - the queue was only fed by seed data. That's now built and live at `/intake`, no login required, POSTing straight to the same backend endpoint. If time allows, it's worth a 20-second detour: open `/intake` in a new tab, submit a request, then flip back here and show it land at the top of the queue in real time - that's a stronger beat than just describing it."

**One thing to watch for, not to demo:** two leftover QA test submissions ("Test Runner" / "Second Runner", references `EFAR-2026-00011` / `00012`) are sitting in the live pending queue from verifying this fix. Skip past them when picking "one pending row" to open in step 2 below - pick a real-looking one (e.g. Wei Lin Tan or Marcus Lim) instead.

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

## 25:00-28:30 - Executive Dashboard: Fleet + Expense, then Reports & Accounts Management (Liang Yi drives)

**Login:** `doris@efar.com.sg` / `Efar@2026`

**Liang Yi opens:**
> "This is the screen I originally designed the use cases and schema for - the Managing Director's real-time view into fleet activity and overhead cost. Jasper built the Fleet and Expense tabs as part of picking up that wave, so I'll narrate those, then I'll drive the two screens I've since built myself: Reports and Accounts Management."

**Jasper built, Liang Yi narrates:**
1. **Fleet tab** - 4 KPI cards, booking-status doughnut chart, and the revenue-leakage alert panel - tie this explicitly back to the "prevention of revenue leakage" success metric from the requirements doc.
2. **Expense tab** - 3 KPI cards, interactive vendor bar chart, read-only vendor invoice table.

**Liang Yi built, Liang Yi drives:**
3. **Reports** - four tabs (Revenue, Billing Cycle, Leakage History, Vendor Expenditure), a period selector, and working CSV/PDF export on each. Open Leakage History specifically and point out the Billing Status badges (Missing/Late/On Time) - built as readable badges with icons, not a raw database status string.
4. **Accounts Management** - the User Directory: search/filter by role and status, the 3 KPI cards (Total Users, Currently Online, Security Alerts), and the row actions - Force Logout, Unlock, Remove. Open **Add New User** and show validation live: email restricted to `@efar.com.sg`, password requiring 8+ characters plus a number and a special character, and the show/hide password toggle. Then click **Remove** on a row to show the double-confirmation modal - it does not delete on the first click.

**Say (Liang Yi):** "The reason any of this exists is in the problem statement directly - management described feeling anxious about staff turnover wiping out financial visibility, because so much of it lived in one person's head. Fleet and Expense are the live, always-current view that doesn't depend on someone's memory. Accounts Management is the direct answer to the other half of that same anxiety - when someone leaves or a credential needs to be pulled immediately, it's a Force Logout or Remove click, not an IT ticket."

**One honest caveat to state here, briefly:** "Remove is wired to a real backend endpoint I built - `DELETE /api/users/:id` - confirmation-gated, and it genuinely deletes the row. What's still mock data is the *initial* five rows in the directory - there's no `GET /api/users` list endpoint yet, so today's starting list is seed data, not a live query. Any account created through Add New User in this session, though, is a real row you can remove for real."

Keep this tight - about 3.5 minutes total, since the next segment (gaps) is shorter now that two of its former items are done.

---

## 28:30-29:30 - Gaps & Completion Plan (Liang Yi)

This is Liang Yi's segment to own outright - it's a strength, not a weakness, that the team can name its own gaps unprompted before being asked.

**Say (adapt naturally, don't read verbatim):**
> "Quick update before the honest remaining list: **the two screens I flagged last time as not-yet-built - Reports and Accounts Management - are both done now, and you just saw them working.** Reports has all four tabs with working CSV/PDF export; Accounts Management has the full user directory plus Force Logout, Unlock, Remove, and a validated Add User flow, with Remove backed by a real `DELETE /api/users/:id` endpoint I built myself, not a frontend-only mock. **One more from last time is also done: the public customer-facing intake form's frontend is now wired up and live at `/intake`.** Kwan Hua built it against Zheng Bao's already-working backend endpoint - and while testing it end to end, found and fixed a real bug where the reference-number generator could collide and 500 on every single submission. That's fixed too, not just the form.
>
> **First, the User Directory's starting list is still seed data, not a live `GET /api/users` query** - a small, specific gap now, not a rebuild. Every account created or removed during a live session goes through the real backend; only the initial five rows shown are static.
>
> **Second, Zheng Bao's full booking-management routes are still using two temporary read-only endpoints** we added just to unblock the field crew screens you saw earlier - creating, confirming/rejecting, and crew assignment need to move off those temporary routes onto the real ones.
>
> **Third, test coverage isn't even across the team yet.** Jasper and Kwan Hua have committed automated tests. I've now written and committed frontend tests for Accounts Management, but the backend half of that same feature - the new user controller and delete route - doesn't have automated tests yet, and that's next on my list. Zheng Bao currently has a documented test-case list but hasn't written the executable tests yet either - both are happening before submission, not left to the end.
>
> **Fourth, and I'll say this one plainly since you'll have noticed it during the AR and AP walkthrough: our Xero integration is simulation-only today.** We have not yet connected a real Xero organisation. The OAuth2 flow, encrypted token storage, and sync logic are fully built against Xero's actual API - switching it on is a config change plus registering a Xero developer sandbox app, not a rebuild - but we haven't done that step yet, so we're not going to claim a live connection we don't have. That's scheduled before the final review.
>
> **Fifth, one item from the original scope is only half-built: Xero bank feed ingestion.** The problem statement specifically calls out syncing 'draft invoices and bank feeds' - we've built the draft invoice half for both AR and AP, and our sync log schema already reserves a category for bank feeds, but there's no actual bank feed ingestion or reconciliation screen yet, and no dedicated AR-specific dashboard either - today, revenue-leakage alerting lives on this Executive Dashboard rather than a separate AR view. That's on Kwan Hua's list alongside the real Xero connection work, since it sits in the same part of the system."

**Close the segment:**
> "None of these block the core pipeline you just saw working end to end - they're additive screens and coverage, not missing plumbing."

---

## 29:30-30:00 - Close (Zheng Bao or Liang Yi)

> "So: intake to booking, booking to field memo, memo to automated pricing match, match to Xero draft invoice, plus the parallel AP OCR and reconciliation path - all live, all backed by a real Postgres schema and a real pricing engine, not mocked data. Happy to take questions, or go deeper on any one screen."

---

## Pre-Demo Checklist

- [ ] `cd backend && npm run dev` and `cd frontend && npm run dev` both running and healthy (`GET /health` returns OK) at least 10 minutes before the session, not started live.
- [ ] Confirm `XERO_SIMULATION=true` in `backend/.env` before the session (this is the actual current state - no live Xero org is connected). Do not attempt to demo a real Xero connection unless someone has genuinely completed the developer-app registration and OAuth consent beforehand.
- [ ] Re-seed if the DB was reset recently: `cd backend && npm run db:setup` - one command now chains `db:sync -> db:seed -> db:seed:clients -> db:seed:intakes -> db:seed:bookings -> db:seed:xero -> db:seed:pricing` and stops on the first failure instead of needing all seven typed by hand.
- [ ] Decide whether to leave or clear the two leftover QA test intake submissions ("Test Runner" / "Second Runner", `EFAR-2026-00011` / `00012`) sitting in the pending queue - harmless either way, but the Quotations segment presenter should know to pick a different row rather than open one of these live.
- [ ] Pre-open 5 browser tabs/profiles logged in as each demo account (`camilla`, `ravi`, `sarah`, `chloe`, `doris`, all password `Efar@2026`) so no one fumbles a login live.
- [ ] Have one already-submitted memo and one already-approved invoice sitting in the data, in addition to a fresh one you'll create live - so if the live pricing-match click hangs, you can pivot to the pre-made example without dead air.
- [ ] Confirm who is physically driving the keyboard/screen-share for each segment vs. narrating, especially the Executive Dashboard segment (Liang Yi narrates Fleet/Expense, then drives Reports/Accounts Management directly - no handoff back to Jasper needed partway through).
- [ ] Time a full dry run once. This script is paced to ~30 minutes with each segment already having slack built in; if the dry run runs long, cut from the AP retry-logic demo first (noted above), not from the gaps section.

---

## Anticipated Questions & Answers

**"Is the Xero sync actually hitting the real Xero API, or is it simulated?"**
It's simulated - say this plainly, don't hedge. We have not connected a real Xero organisation yet. `XERO_SIMULATION=true` runs the full OAuth/connect/sync/retry flow against a built-in simulator so the app is demoable without a live Xero account, and that's the mode we're in today. The real-mode path is fully built - `XERO_SIMULATION=false` would hit the actual Xero API with AES-256-GCM-encrypted tokens and auto-refresh - but it requires registering a Xero developer sandbox app and completing OAuth consent, which is still on our list, not done. Offer to show the real-mode config in `README.md` if they want to see it's genuinely built, not just planned.

**"What happens if a memo doesn't match any pricing contract?"**
It lands in the invoice list with an "Unmatched" status rather than blocking or silently failing - this was a specific edge case we found and fixed (a `NOT NULL` constraint on `contract_id` was incorrectly blocking unmatched invoices from being created at all).

**"When you clicked Remove in Accounts Management, did that really delete from the database?"**
Yes, for any account created during the session - it calls a real `DELETE /api/users/:id` endpoint, guarded by the confirmation modal you saw, a check that blocks removing your own logged-in account, and a check that blocks removing a user who still has associated records (bookings, memos, invoices) rather than throwing a raw server error. The one honest caveat: the directory's *starting* five rows are seed data with no real database id, so Remove on those correctly refuses rather than silently faking a deletion.

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
