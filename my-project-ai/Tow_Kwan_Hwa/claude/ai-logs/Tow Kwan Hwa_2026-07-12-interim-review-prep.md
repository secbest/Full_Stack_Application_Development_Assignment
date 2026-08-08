# Session Log - 2026-07-12 - Interim Review Prep, Public Intake Form, db:setup Script

**Student:** Kwan Hua
**AI tool:** Claude Code
**Phases:** Design gap analysis, coding, tooling, demo preparation

*(This session ran into 2026-07-13.)*

## Task 1: Work out what was missing before the interim review

**Prompts / direction:**
> ok what do I have to prepare for my interim review

> whats the difference between public intake and curent?

**AI output/actions:**

- Audited the implementation against the design docs and found a real gap: the public-facing intake
  form was specified in `design/zheng-bao/` but had never been built, because the Figma Make prototype
  never designed it. The intake queue was only ever fed by seeded rows.
- Explained the difference clearly - the existing intake queue is the *internal* review surface for the
  Quotations Specialist; the public form is the *unauthenticated* entry point that creates the
  submissions in the first place.
- Built the public route and the `POST /api/intake` endpoint (no auth required).
- Fixed a live reference-number collision bug found while testing the new form.

**Outcome:** Accepted. Committed as `17ce1e8` (`Add public intake form, fix reference-number collision,
add db:setup`).

## Task 2: Fix Xero retry mishandling AR invoices

**AI output/actions:**

- Found that `xeroController.retrySync` mishandled AR invoice sync retries, treating them on the AP
  path.

**Outcome:** Accepted. Committed as `d19926e`.

## Task 3: Toast duration

**Prompt / direction:**
> can you change the duration of the display message to 8 seconds since it goes away too fast

**AI output/actions:**

- Changed the toast auto-dismiss to 8 seconds. This is now the documented standard in `CLAUDE.md`
  (bottom-right, 8s, green success / red error), since there is no email service in the stack and
  toasts are the only confirmation channel.

**Outcome:** Accepted.

## Task 4: One command to reseed the whole demo database

**Prompts / direction:**
> ok can you see if the seeds needs to change cause you added the public instake?

> leave it . Now can you make a script or something that I can type 1 time and all these
> "db:sync -> db:seed -> db:seed:clients -> db:seed:intakes -> db:seed:bookings -> db:seed:xero ->
> db:seed:pricing." can be runned since its quite tedious to type all this everytime we pre demo

> for this can you make it unsync to xero cause I need to use this template to demotrate during my
> interim review

> ok put this together with the db:setup since its easier for me

**AI output/actions:**

- Added `npm run db:setup`, which runs the whole sync-and-seed chain in the correct dependency order
  in one command.
- Made the seeded Xero records land in an *unsynced* state so the sync-to-Xero step is live to
  demonstrate rather than already done.

**Outcome:** Accepted. This became the single most-used command for the rest of the project.

## Task 5: Invoice adjustment UX

**Prompts / direction:**
> can you add a close button beside the "add adjustment" if I decide to not add any adjustment

> and for the line items would it be better to add a drop down of items so its easier to add in instead
> of type manually

**AI output/actions:**

- Added a cancel control next to "Add Adjustment" and replaced free-text line-item entry with a
  dropdown of known items.

**Outcome:** Accepted.

## Task 6: Demo data and Gemini troubleshooting

**Prompts / direction:**
> wait now my service memo is blank do i need to manually do it to have it there?

> my gemini api doesnt seem to be able to scan

> brieft summary of each user

**AI output/actions:**

- Explained that Memo Review is empty until a field-crew memo is actually submitted; it is a queue,
  not a seeded list.
- Investigated the Gemini scan failure.
- Produced a per-role summary of the five demo users for the interim review walkthrough.

**Outcome:** Accepted. The demo script and interim review notes were updated to match.

## Decision Notes

- The public intake form was the most valuable thing this session produced, and it only surfaced
  because I asked what was missing rather than what was next. "Not in the prototype" had been quietly
  treated as "not required" - it is now an explicit note in `CLAUDE.md` so nobody else makes that
  assumption.
- Seeding Xero records as *unsynced* was a deliberate demo decision. Pre-synced data would have made
  the integration look finished while showing nothing actually working.
