# Session Log - 2026-08-08 - AR Workflow Gaps, Client Identity, Surcharge Pricing, AR Test Coverage

**Student:** Kwan Hua
**AI tool:** Claude Code
**Phases:** Gap analysis, coding, testing, design documentation, presentation prep

## Task 1: Audit Sarah's (AR Specialist) end-to-end workflow

**Prompt / direction:**
> are you able to see my workflow for sarah cause I feel there is so many gaps

**AI output/actions:**

- Walked the AR path from memo submission through pricing, invoice review, approval and Xero sync, and
  reported the gaps rather than only the code structure.

**Outcome:** Accepted as the basis for the rest of the session.

## Task 2: Drop the AR and AP dashboards from the spec

**Prompt / direction:**
> dont need to implement any dashboard for AR and AP can you update the claude md?

**AI output/actions:**

- Updated `CLAUDE.md` to mark screens 6 (AR Dashboard) and 15 (AP Dashboard) as dropped, with the
  landing screens changed to `/invoices` and `/vendor-invoices`.
- Documented *where each dropped panel's content actually lives* instead of just deleting the entries:
  status breakdowns are the filter chips, leakage alerts are the standalone Revenue Leakage report,
  bank feed is explicitly out of scope.
- Left the screen numbering un-resequenced, because existing code comments cite screens by number.

**Outcome:** Accepted. Committed as `3e3a830`.

## Task 3: Three reported defects

**Prompt / direction:**
> issue 1: action reviews submission on what is the base price in intake queue. Cause the agreed base
> price is 0 so its confusing(quotation)
>
> issue 2: When I do the intake queue for the naming for organisation however the booking for client
> name is wrong. For example I use NUS but the client name is Nanyang Poly.
>
> Issue 3: AR always have warnings for invoices in terms of contracts.

**AI output/actions:**

**Issue 3 - surcharge pricing (`6230779`).** The engine loaded surcharges as
`WHERE contract_id = <id>`, so a booking with no contract got an empty schedule and every charge the
crew recorded fell through to `unpriced_surcharges`. The insight was that surcharges are *published*
rates, not negotiated ones - EFAR publishes one card for oxygen, inconvenience, disposables,
resuscitation, suction, waiting time, heavy lifting and Jurong Island; only the base transport rates
vary per contract. `surcharge_schedules.contract_id` now allows NULL for a global default and
resolution runs contract row -> published default -> unpriced, which also fixes contracts with partial
schedules that previously dropped every surcharge they did not list. Verified on a real memo: subtotal
$190.00 -> $445.00, unpriced 7 -> 0. `overtime_per_hour` and `cancellation` were deliberately *not*
defaulted, because neither has a flat published figure ("100% upon activation" is a rule, not an amount).

**Issue 2 - client identity (`547e82d`).** `confirmIntake` used
`Client.findOrCreate({ where: { contact_email } })`, making email the client's identity. `findOrCreate`
returns the existing row untouched when the where-clause matches, so the organisation the specialist
typed was silently discarded - confirming for "NUS" against an email on file for "Nanyang Poly"
produced a booking billed to Nanyang Poly with no warning, and the same bug in reverse split one real
organisation across two client rows. For a B2B booking the organisation is the customer, so it is now
the identity key; email remains the key for individuals. Matching stays exact rather than fuzzy -
silently merging two genuinely different customers is worse than creating a duplicate a human can merge.

**Issue 1 - agreed base price (`547e82d`).** The field was a bare numeric input with a "0.00"
placeholder, and was hidden entirely on the contract path, so the specialist froze a price she never
saw. Bookings had been quoted at $50 and $100 against a published one-way rate of $160-210. The review
panel now shows the published band for the selected transfer type and time category and flags an
out-of-band amount - as guidance only, never a block, since a negotiated price outside the band is
legitimate.

Also added `cleanup-client-data.js` to repair rows already written. Dry run by default, `--apply`
required to write. It reports under-quoted bookings without rewriting them, because a quoted price is a
commercial commitment, and refuses a merge whose source owns a contract.

**Outcome:** Accepted.

## Task 4: Test coverage for the AR screens

**Prompt / direction:**
> can you branch out these changes and as well start on doing the test cases on my parts as well

**AI output/actions:**

- Found the real gap: the AP/Xero screens were well covered but four AR screens I own had no test file
  at all, and Memo Review had one test covering two screens.
- Added 58 tests across `InvoiceListPage` (14), `PricingContractPage` (15), `ContractDetailPage` (18)
  and `ContractFormPage` (11), and expanded `ServiceMemoListPage` from 1 to 13.
- Concentrated on the paths carrying billing risk rather than rendering: batch approve must never
  report a partial Xero failure as a clean success and must never select an unmatched invoice (which
  would issue a $0 document); the surcharge save is N independent PUTs with no transaction, so a
  partial failure must name the failed rows and keep the successful ones.
- Updated `test-cases.md` in both folders. The frontend table was 6 rows against 33 tests and is now a
  1:1 record of all 103.
- Gave the duplicate-rate test an explicit 20s timeout after it flaked once - it drives nine Radix
  Select open/close cycles - and verified stability over three consecutive runs.

**Outcome:** Accepted. Committed as `004d132`. Backend 482 passing, frontend 293 passing, build clean.

## Task 5: Merge

**Prompts / direction:**
> ok merge this into main and delete the branch

> ok just make sure theres no conflicts

**Outcome:** Merged as `5d62e5c`, no conflicts.

## Task 6: Presentation workflow

**Prompt / direction:**
> I will have a presentation on what I have dont can you do a workflow for it?

**AI output/actions:**

- Produced a visual workflow of my feature area for the presentation - intake through pricing, memo
  review, invoice approval and Xero sync.

**Outcome:** Accepted.

## Task 7: "The AR amount doesn't tally"

**Prompt / direction:**
> issue 1: invoice should be automatically add to the line items when field crew added the items in.
> cause when I review the amount in AR it doesnt tally up

**AI output/actions:**

Traced a three-link chain:

1. The memo wizard defaulted `is_office_hours` to `true` regardless of the quoted time category, so a
   job sold as non-office-hours arrived at AR claiming office hours over a toggle nobody had touched.
2. That fails `quotationMatchesMemo`, and the mismatch path created a **completely empty invoice** -
   subtotal 0, no line items - with every charge the crew recorded dumped into `unpriced_surcharges`
   to be re-keyed by hand. That was the tally complaint: the invoice showed none of the crew's work.
3. Adding any manual adjustment moves an `unmatched` invoice to `adjusted`, and `batchApprove` only
   checked status. Nothing verified the invoice actually contained a base transport charge.

**Four invoices had already reached Xero this way**, billed $21.80-$54.50 for jobs quoted at $50-$190
with the transport charge silently absent.

Fixes: all three no-base paths now price the crew's recorded surcharges from the published card and
write them as line items, leaving only the base for a human because only the base genuinely needs a
decision (verified on a real memo: $390 of surcharge lines where the invoice previously showed
nothing). The wizard now defaults the office-hours toggle from `booking.quoted_time_of_day` - the crew
still records reality, this only changes which way it starts. New `invoice_line_items.line_type`
(base | surcharge | adjustment), because `is_manual_adjustment` separates engine from human and cannot
express "priced except for the transport charge". `batchApprove` refuses an invoice with no base row
and returns `skipped_reasons` so "wrong status" and "no base charge" are distinguishable; the UI
disables Approve, explains why, and offers a "this is the base transport charge" option, so pricing the
base by hand stays possible but has to be declared.

**Outcome:** Accepted. Committed as `3a755b5`. Backend 488 passing, frontend 297 passing, build clean.

## Decision Notes

- Issue 3 was reported as a nuisance warning. It was actually revenue leakage - the warning was correct
  and the pricing data model was wrong. Treating a repeated warning as noise to be silenced would have
  buried the defect.
- The client-identity fix deliberately keeps matching exact rather than fuzzy. Fuzzy matching would
  quietly merge two real customers, which is unrecoverable; a duplicate row is a human-fixable problem.
- The cleanup script refuses to rewrite an under-quoted booking. A quoted price is a commercial
  commitment already made to a customer, and a data-repair script has no business changing one.
- Task 7 was the most serious finding of the whole project so far: four invoices had already synced to
  Xero missing their transport charge. It surfaced only because I chased "the amount doesn't tally"
  instead of accepting the invoice status as correct.
