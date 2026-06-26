# EFAR - Figma Make Prompts

**EFAR Digital Operations-to-Billing Platform**
Step-by-step Figma Make prompts per group member, segmented by build wave.

---

## Logic Corrections (Review Before Designing)

The following inconsistencies between the original use cases and the final database schema must be reflected in all designs. Do not follow the use case wording where it conflicts with this list.

| # | Where | Old (Use Case) | Corrected (Schema / Final) |
|---|-------|----------------|----------------------------|
| 1 | Jasper UC-03/04 - Memo Review | Shows "Overtime hours" and "Evacuation floor count" as the pricing inputs | The pricing engine uses `service_type`, `transfer_type`, and `is_office_hours` for the base rate. Surcharges are driven by 9 boolean/decimal flags on the memo (oxygen, inconvenience, resuscitation, etc.). Show ALL memo fields in the review screen. |
| 2 | Liang Yi UC-01 - Job Queue | "Crew member navigates to their assigned job queue" (no screen defined) | Add a dedicated "My Jobs" screen as the first screen of the field crew flow, showing bookings with `confirmed` or `in_progress` status assigned to the logged-in crew member. |
| 3 | Zheng Bao UC-01/05 - Intake Form | "Service tier (Basic/Advanced/Critical)" is described as the main customer selection | There are two separate fields: **Service Type** (EAS, MTS, Event Standby, Workplace Standby - the actual EFAR product) and **Service Tier** (Basic, Advanced, Critical - customer urgency estimate). Both must appear on the intake form as separate dropdowns. |
| 4 | Liang Yi UC-03 - Memo Form | "Evacuation floor count" drives billing | `evacuation_floors` (integer) is stored for documentation. Billing uses `has_inconvenience_fee` (boolean, flat $50). The form must show both: a numeric floor count field AND a separate toggle "Were stairs or elevator access required?" that maps to `has_inconvenience_fee`. |
| 5 | Zheng Bao UC-01/04 - Customer Notifications | "Customer receives confirmation/rejection email" | No email service is in the tech stack. For MVP, show an in-app toast/banner confirming the action was recorded. Remove any email confirmation language from the UI. |

---

## Navigation Map

This map shows how every screen links to another. Use it to verify prototype connections in Figma after generating each screen.

```
[Wave 0]
Login
  → (quotations_specialist) → 1A-Step 3: Intake Queue
  → (ar_specialist)         → 3A-Step 5: AR Dashboard
  → (ap_specialist)         → 3B-Step 0: AP Dashboard
  → (field_crew)            → 2A-Step 1: My Jobs
  → (managing_director)     → 4-Step 1:  Executive Dashboard

[Wave 1A - Zheng Bao]
1A-Step 1: Public Intake Form
  → submit → 1A-Step 2: Submission Confirmed

1A-Step 2: Submission Confirmed
  → "Submit Another Request" → 1A-Step 1

1A-Step 3: Intake Queue
  → row [Review] → 1A-Step 4: Intake Submission Detail

1A-Step 4: Intake Submission Detail
  → "Confirm Booking" → 1A-Step 6: Booking Detail (new booking)
  → "Reject Submission" → toast + 1A-Step 3: Intake Queue

1A-Step 5: Booking List
  → row [View] → 1A-Step 6: Booking Detail

1A-Step 6: Booking Detail
  → "Linked Intake" link → 1A-Step 4 (read-only, already actioned)
  → "Service Memo" link (if exists) → 3A-Step 2: Memo Review Detail (read-only for Camilla)
  → "Invoice" link (if exists) → 3A-Step 4: Invoice Detail (read-only for Camilla)
  → breadcrumb "Bookings" → 1A-Step 5

[Wave 1B - Kwan Hua]
1B-Step 1: Xero Integration Settings
  → "View Full Sync Log" → 3B-Step 3: Xero Sync Status
  → "Connect to Xero" → external Xero OAuth (redirects back)

[Wave 2A - Liang Yi]
2A-Step 1: My Jobs
  → [Start Job & Create Memo] on Confirmed → 2A-Step 2 (memo wizard, booking transitions to in_progress)
  → [Continue Memo] on In Progress → 2A-Step 2
  → sidebar "My Memos" → 2A-Step 7: Memo History

2A-Steps 2-5: Memo Wizard
  → submit on Step 5 → 2A-Step 6: Memo Submitted
  → "← Back" on Step 2 → 2A-Step 1

2A-Step 6: Memo Submitted
  → "Back to My Jobs" → 2A-Step 1
  → "View Submitted Memo" → 2A-Step 7: Memo History (filtered to this memo)

2A-Step 7: Memo History
  → row [View] → inline expanded detail row (no separate screen)
  → sidebar "My Jobs" → 2A-Step 1

[Wave 2B - Jasper]
2B-Step 1: Pricing Contracts List
  → row [View] → 2B-Step 2: Contract Detail
  → "+ New Contract" → 2B-Step 3: Create Contract Form

2B-Step 2: Contract Detail
  → "Edit Contract" → 2B-Step 3 (pre-filled with existing data)
  → breadcrumb "Pricing Contracts" → 2B-Step 1

2B-Step 3: Create/Edit Contract Form
  → save → 2B-Step 2: Contract Detail (new or updated)
  → cancel → 2B-Step 1

[Wave 3A - Jasper]
3A-Step 1: Memo Review Queue
  → row [Review] → 3A-Step 2: Memo Review Detail

3A-Step 2: Memo Review Detail
  → "Approve & Match Invoice" → 3A-Step 4: Invoice Detail (newly generated invoice)
  → "Return Memo" → toast + 3A-Step 1: Memo Review Queue
  → breadcrumb → 3A-Step 1

3A-Step 3: Invoice List
  → row [Review] / [View] → 3A-Step 4: Invoice Detail
  → row [Sync] → triggers sync, stays on list with updated status badge
  → row [Retry] → triggers retry, stays on list

3A-Step 4: Invoice Detail
  → "Approve Invoice" → status updates to Approved in-place, Approve button replaced by "Sync to Xero"
  → "Sync to Xero" (post-approval) → triggers sync, status updates to Synced/Failed in-place
  → "Reject Match" → memo reverts to review queue, invoice deleted, redirects to 3A-Step 1
  → "Memo Ref" link → 3A-Step 2 (read-only, already approved)
  → "Booking Ref" link → 1A-Step 6: Booking Detail
  → breadcrumb → 3A-Step 3

3A-Step 5: AR Dashboard
  → Revenue Leakage [View] → 1A-Step 6: Booking Detail (cross-wave, Zheng Bao's screen)
  → sidebar "Xero Sync" → 3B-Step 3: Xero Sync Status (shared screen)

[Wave 3B - Kwan Hua]
3B-Step 0: AP Dashboard
  → "Review Pending" → 3B-Step 2: AP Invoice Review
  → sidebar "Vendor Invoices" → 3B-Step 1

3B-Step 1: Vendor Invoice List
  → row [Review] → 3B-Step 2: AP Invoice Review
  → row [View] (already processed) → 3B-Step 2 (read-only)
  → "+ Upload Invoice" modal → on submit → 3B-Step 2 (new invoice)

3B-Step 2: AP Invoice Review
  → "Approve Invoice" → toast + redirect to 3B-Step 1 (status updated to Approved)
  → "Reject" → toast + redirect to 3B-Step 1 (status updated to Rejected)
  → breadcrumb → 3B-Step 1

3B-Step 3: Xero Sync Status
  → "Reconnect Xero" → 1B-Step 1: Xero Integration Settings (cross-wave)
  → row [Retry] → retry triggered, row updates in-place
  → accessible from sidebar "Xero Sync" in both AP and AR portals (shared screen)

[Wave 4 - Liang Yi]
4-Step 1: Executive Dashboard (Fleet tab)
  → secondary tab "Expense Summary" → 4-Step 2
  → Revenue Leakage [View] → 1A-Step 6: Booking Detail (cross-wave, read-only)

4-Step 2: Executive Dashboard (Expense tab)
  → secondary tab "Fleet Overview" → 4-Step 1
  → "View All" in vendor panel → 3B-Step 1: Vendor Invoice List (read-only for Doris)
```

---

## Global UI System

Include the following tokens in every screen prompt. Copy and append to any individual prompt below.

```
GLOBAL UI SYSTEM:
- App background: #F8FAFC (light slate)
- Card/panel background: #FFFFFF (white)
- Sidebar and primary nav background: #1E293B (deep navy)
- Sidebar text and icons: #FFFFFF with 70% opacity for inactive items, 100% for active
- Active sidebar item: white left border (3px) + white background at 15% opacity
- Primary action buttons: #1E293B background, white text, 8px border-radius, 44px height
- Secondary/ghost buttons: #FFFFFF background, #1E293B border and text, 8px border-radius
- Destructive buttons (Reject, Delete): #EF4444 background, white text
- Success status: #22C55E (green) for synced, confirmed, approved
- Warning status: #F59E0B (amber) for pending, in_progress, low_confidence
- Error status: #EF4444 (red) for failed, rejected, unmatched
- Info/Neutral status: #3B82F6 (blue) for matched, reviewed, info
- Muted/secondary text: #64748B (slate gray)
- Border/divider: #E2E8F0 (light slate)
- Font family: Inter
- Page title: 24px Bold, #1E293B
- Card header: 16px Semi-Bold, #1E293B
- Body/form text: 14px Regular, #1E293B
- Micro/metadata/timestamps: 12px Medium, #64748B
- Table headers: 12px Medium uppercase, #64748B, letter-spacing 0.05em
- Status badges: 12px Medium, pill shape, 6px border-radius, colored background at 15% opacity with matching text color
- Input fields: #FFFFFF background, #E2E8F0 border, 8px border-radius, 14px Regular placeholder #94A3B8
- Focused input: #3B82F6 border, no shadow
- Error input: #EF4444 border, error message below in 12px #EF4444
- Page layout: fixed left sidebar 240px wide, top header 64px, main content scrollable with 32px padding
- Cards: white background, 12px border-radius, 1px #E2E8F0 border, subtle box-shadow (0 1px 3px rgba(0,0,0,0.08))
- Data tables: white card, striped rows (#F8FAFC alternate), 48px row height, hover highlight #F1F5F9
- Notification bell in top header, right side, with red badge count
- Toast notifications: appear bottom-right, 320px wide, 8px radius, green for success, red for error, 3s auto-dismiss
```

---

## Wave 0 - Group (Login)

All members share this. One person implements it, everyone references the design.

### Step 1: Login Screen

```
Design a login screen for EFAR, an ambulance operations-to-billing platform used by hospital admin staff and field crew.

Layout: Split-screen, full viewport height. No sidebar.

LEFT PANEL (60%) — brand panel with full-height #1E293B navy background:
- EFAR text logo in 40px Bold white, centered vertically
- Below logo: "Digital Operations-to-Billing Platform" in 16px Regular white at 70% opacity
- Below tagline: a simple medical cross icon or emblem (outline style, white, 48px)

RIGHT PANEL (40%) — white background, login form centered vertically with 48px padding:
- "Welcome back" as page title (24px Bold #1E293B)
- "Sign in to your account" as subtitle (14px Regular #64748B)
- Email field labelled "Email address" with placeholder "sarah@efar.com.sg"
- Password field labelled "Password" with show/hide toggle eye icon on the right
- "Sign In" primary button (full width, #1E293B background, white text, 48px height)
- Small text below button: "Forgot password? Contact your administrator." in 12px #64748B centered

Post-login routing note (shown as a small gray info box below the form for design reference only, not visible to end users): "Quotations Specialist → Intake Queue · AR Specialist → AR Dashboard · AP Specialist → AP Dashboard · Field Crew → My Jobs · Managing Director → Executive Dashboard"

No registration link. No social login options. This is an internal staff tool.

Apply GLOBAL UI SYSTEM font and color rules.
```

---

## Wave 1A - Zheng Bao: Customer Intake & Booking Management

Design these screens in order. Each builds on the previous.

**Sidebar for Camilla (Quotations Specialist):** Intake Queue, Bookings, Settings. User avatar and name "Camilla Wong · Quotations Specialist" at sidebar bottom. "Intake Queue" is the home screen — there is no separate Dashboard item.

### Step 1: Public Intake Form

```
Design a public-facing customer intake form for EFAR ambulance services. This is the only screen in the app that requires no login.

Layout: Single-column centered form, max-width 680px, on a #F8FAFC background. No sidebar. Simple top header bar (64px, white) with the EFAR text logo ("EFAR" in 18px Bold #1E293B) on the left and tagline "Emergency & Medical Transport Booking" in 14px Regular #64748B on the right.

Form card (white, 16px border-radius, subtle shadow, 48px padding):
- Page title: "Request Ambulance Services" (24px Bold #1E293B)
- Subtitle: "Fill in the form below and our team will contact you to confirm your booking." (14px Regular #64748B)

Section 1 header: "Your Contact Details" (16px Semi-Bold #1E293B, with a thin #E2E8F0 divider below)
- Full Name field (required) — placeholder "John Tan"
- Organisation field (optional) — label shows "(optional)" in 12px #94A3B8 — placeholder "Changi General Hospital"
- Contact Email field (required) — placeholder "john@example.com"
- Contact Phone field (required) — placeholder "9123 4567"

Section 2 header: "Service Details" (16px Semi-Bold #1E293B)
- Service Type dropdown (required) — options: "EAS (Emergency Ambulance)", "MTS (Non-Emergency Medical Transfer)", "Event Medical Standby", "Workplace Medical Standby". Helper text below: "Select the service category that best describes your need." in 12px #64748B
- Service Tier dropdown (required, separate from Service Type) — options: "Basic (Stable patient, standard transport)", "Advanced (Medical monitoring required)", "Critical (Life support / active emergency)". A small ℹ icon opens a tooltip: "Not sure? Select Basic — our team will confirm the appropriate tier when we contact you."
- Preferred Date picker (required) — label "Preferred Service Date"
- Preferred Time dropdown (required) — label "Preferred Time" — 30-minute intervals from 08:00 to 22:00
- Pickup Location textarea (required) — 3 rows — placeholder "Building name, street address, postal code"
- Destination textarea (required) — 3 rows — placeholder "Hospital name and ward / A&E, or venue address"
- Additional Notes textarea (optional) — 3 rows — placeholder "Any special requirements, e.g. patient needs oxygen support, bariatric patient"

Submit button: "Submit Request" — full width, primary navy style, 48px height.

Below button: "Your reference number will be shown on the next screen. Our team aims to respond within 2 business hours." in 12px #64748B centered.

Apply GLOBAL UI SYSTEM rules. No sidebar, no nav.
```

### Step 2: Intake Submission Confirmed Page

```
Design a submission confirmation page shown to the customer immediately after the public intake form is submitted successfully.

Layout: Centered card, 520px wide, on #F8FAFC. Same simple top header as Step 1. No sidebar.

Card contents (white, 16px border-radius, 48px padding, centered text):
- Large green checkmark circle icon (56px, #22C55E background, white checkmark) centered at top
- "Request Submitted" as page title (24px Bold #1E293B), centered
- "Thank you, John. Your request has been received." in 14px Regular #64748B, centered
- Reference number box: #F1F5F9 background, 8px border-radius, 16px padding, centered, showing "Reference No." label in 12px Medium #64748B above and "EFAR-2026-00007" in 20px Bold #1E293B below
- Thin divider line
- "What happens next?" section label in 16px Semi-Bold #1E293B, left-aligned within card
- Three numbered steps in 14px Regular, left-aligned:
  1. "Our team reviews your request within 2 business hours."
  2. "We confirm the service type, tier, and schedule — and assign a crew member."
  3. "Keep your reference number handy for any follow-up queries."
- "Submit Another Request" ghost button (outline style, full width, 44px)

Navigation: "Submit Another Request" navigates back to Step 1.

Apply GLOBAL UI SYSTEM rules.
```

### Step 3: Intake Queue

```
Design the Intake Queue screen — the home screen for Camilla (Quotations Specialist) after login.

Layout: Full app layout with fixed left sidebar (240px, #1E293B), top header (64px, white), main content (#F8FAFC, 32px padding).

Sidebar items (14px white text): "Intake Queue" (active — white left border 3px + 15% white bg), "Bookings", "Settings". User avatar (initials "CW" in a navy circle) and name "Camilla Wong · Quotations Specialist" pinned to sidebar bottom.

Top header: "Intake Queue" as page title (24px Bold). Notification bell icon top right with red badge "3".

Main content:
- Summary row of 3 equal-width stat cards (white, 12px radius, 1px border):
  - "Pending Review" — count "5" in 28px Bold #F59E0B, label in 12px #64748B
  - "Confirmed Today" — count "3" in 28px Bold #22C55E
  - "Rejected Today" — count "1" in 28px Bold #EF4444
- Filter bar below stats: status tab pills ("All | Pending | Confirmed | Rejected"), "Pending" active in #1E293B text with white bg and border. Search input right side ("Search by name, reference, or organisation…"). Service Type dropdown filter. Service Tier dropdown filter.
- Data table (white card) columns: Reference, Customer Name, Organisation, Service Type, Service Tier, Preferred Date, Time in Queue, Action.
  - Row 1: EFAR-2026-00007 | John Tan | Changi General Hospital | EAS | Advanced | 5 Jul 2026 | 1h 12m | [Review] button
  - Row 2: EFAR-2026-00006 | Mary Lim | — | MTS | Basic | 4 Jul 2026 | 3h 40m | [Review] button
  - "Time in Queue" cell text: amber (#F59E0B) if > 2h, red (#EF4444) if > 4h
  - [Review] button navigates to Step 4: Intake Submission Detail
- Pagination: "Showing 1–5 of 5 results"

Apply GLOBAL UI SYSTEM rules.
```

### Step 4: Intake Submission Detail & Confirm/Reject

```
Design the Intake Submission Detail screen for Camilla to review and action a single customer request.

Layout: Full app layout. Sidebar same as Step 3, "Intake Queue" active.

Top header: back arrow "←" + "Intake Queue" breadcrumb link, then "Review Submission" as page title (24px Bold), status badge "Pending" (amber pill) inline with the title.

Main content — 2-column layout (60% left, 40% right):

LEFT COLUMN — "Submission Details" card (white, 16px Semi-Bold header):
- Reference: EFAR-2026-00007
- Submitted: 22 Jun 2026, 10:15 AM
- Customer Name: John Tan
- Organisation: Changi General Hospital
- Email: john.tan@cgh.com.sg
- Phone: 91234567
- Service Type: EAS (Emergency Ambulance Services)
- Service Tier: Advanced
- Preferred Date: 5 Jul 2026
- Preferred Time: 14:30
- Pickup Location: Changi General Hospital, 2 Simei Street 3, Singapore 529889
- Destination: Singapore General Hospital, Outram Road, Singapore 169608
- Additional Notes: "Patient requires oxygen support during transfer."
Each field: label (12px Medium #64748B) above value (14px Regular #1E293B), separated by 1px #E2E8F0 dividers.

RIGHT COLUMN — "Take Action" card (white, 16px Semi-Bold header):
Section: "Confirm Booking"
- Service Tier dropdown (pre-filled: "Advanced") — note below in 12px #64748B: "Adjust if the described situation warrants a different tier. The original selection is preserved for audit."
- Scheduled Date picker (pre-filled: 5 Jul 2026)
- Scheduled Time picker (pre-filled: 14:30)
- Internal Notes textarea (optional) — placeholder "Notes e.g. tier adjustment reason, access instructions…"
- "Confirm Booking" button (full width, #1E293B primary, 44px) — on click: creates a booking record, shows a green toast "Booking BKG-2026-00008 created successfully", then navigates to Step 6: Booking Detail for the newly created booking.

Thin horizontal divider with "or" label centered.

Section: "Reject Submission"
- Rejection Reason textarea (required to enable the Reject button) — placeholder "Enter reason for rejection e.g. location is outside our service area"
- "Reject Submission" button (full width, #EF4444 destructive style, 44px) — on click: shows a red toast "Submission EFAR-2026-00007 rejected", then navigates back to Step 3: Intake Queue.

Note below both sections in 12px #64748B: "Actions are logged with your name and timestamp. Rejections can be reopened within 24 hours if no booking has been created."

Apply GLOBAL UI SYSTEM rules.
```

### Step 5: Booking List

```
Design a Booking List screen for EFAR, accessible by Camilla (Quotations Specialist) and Sarah (AR Specialist). Doris (Managing Director) can view it in read-only mode.

Layout: Full app layout. Sidebar active: "Bookings". Sidebar items are the same as Step 3 for Camilla's role.

Top header: "Bookings" as page title (24px Bold). Notification bell top right.

Main content:
- Summary stat row of 4 equal-width cards (white, 12px radius):
  - "Confirmed" — "8" in 28px Bold #3B82F6
  - "In Progress" — "2" in 28px Bold #F59E0B
  - "Completed (Memo Pending)" — "3" in 28px Bold #EF4444, small warning triangle icon — red left border accent on this card
  - "Invoiced" — "12" in 28px Bold #22C55E
- Filter bar: status tab pills ("All | Confirmed | In Progress | Completed | Invoiced"), date range picker (From / To), Service Type dropdown, search input ("Search by reference, client, or crew name…")
- Data table (white card) columns: Booking Ref, Client, Service Type, Service Tier, Scheduled Date, Assigned Crew, Status, Memo, Action.
  - Row 1: BKG-2026-00008 | Changi General Hospital | EAS | Critical | 5 Jul 2026 | Ravi Kumar | Confirmed (blue badge) | — | [View]
  - Row 2: BKG-2026-00004 | Tan Tock Seng Hospital | MTS | Basic | 14 Jun 2026 | — | Completed (amber badge + ⚠ icon) | Missing | [View] — this entire row has very light red background #FEF2F2 to signal revenue leakage risk
  - Row 3: BKG-2026-00003 | TTSH | EAS | Advanced | 13 Jun 2026 | Ahmad | Invoiced (green badge) | Submitted | [View]
  - [View] navigates to Step 6: Booking Detail
- Pagination: "Showing 1–10 of 25 results", page controls.

Apply GLOBAL UI SYSTEM rules.
```

### Step 6: Booking Detail

```
Design a Booking Detail screen showing the full record for one booking, with role-appropriate actions.

Layout: Full app layout. Sidebar active: "Bookings".

Top header: breadcrumb "Bookings > BKG-2026-00008", status badge "Confirmed" (blue pill) inline, notification bell. "← Bookings" back link left of the breadcrumb.

Main content — 3-column layout:

LEFT (40%) — "Booking Details" card (white, 16px Semi-Bold header):
- Booking Ref: BKG-2026-00008
- Created: 22 Jun 2026, 11:00 AM by Camilla Wong
- Linked Intake: EFAR-2026-00007 (blue underline link — navigates to Step 4 in read-only mode)
- Client: Changi General Hospital
- Service Type: EAS (Emergency Ambulance Services)
- Service Tier: Critical (small amber note: "Adjusted from: Advanced" — only shown when tier was changed)
- Scheduled: 5 Jul 2026, 14:30
- Pickup: Changi General Hospital, 2 Simei Street 3, Singapore 529889
- Destination: Singapore General Hospital, Outram Road, Singapore 169608
- Internal Notes: "Upgraded to Critical — ICU transfer confirmed with doctor."
Fields displayed as label (12px Medium #64748B) + value (14px Regular #1E293B) with light dividers.

MIDDLE (30%) — "Status Timeline" card (white, 16px Semi-Bold header):
- Vertical step tracker with 4 steps: Confirmed ✓ → In Progress → Completed → Invoiced
- Completed steps: green circle with checkmark. Active step: navy filled circle. Future steps: light gray circle.
- Timestamp shown under each completed step: "Confirmed — 22 Jun 2026, 11:00 AM"

RIGHT (30%) — "Actions & Links" card (white, 16px Semi-Bold header):
Section: "Crew Assignment" (visible only to quotations_specialist role):
- "Assigned Crew" label
- If no crew: amber note "No crew assigned" + dropdown "Select crew member" (options: Ravi Kumar, Ahmad Salleh, Wei Jian) + "Save Assignment" button (primary, full width)
- If crew assigned: crew name in 14px Bold + "Reassign" small ghost button below

Divider line.

Section: "Linked Records":
- "Service Memo:" label + value — "Not yet submitted" in #94A3B8 if none, or "MEMO-0006" as a blue underline link navigating to 3A-Step 2 (read-only for Camilla)
- "Invoice:" label + value — "Not yet generated" in #94A3B8 if none, or "INV-001" as a blue underline link navigating to 3A-Step 4 (read-only for Camilla)

Apply GLOBAL UI SYSTEM rules.
```

---

## Wave 1B - Kwan Hua: Xero Setup

**Sidebar for Chloe (AP Specialist):** AP Dashboard, Vendor Invoices, Xero Sync, Settings. User avatar "Chloe Tan · AP Specialist" at sidebar bottom. Use this same sidebar in ALL Wave 1B and 3B screens.

### Step 1: Xero Integration Settings

```
Design the Xero Integration Settings screen for the EFAR platform — used by the AP Specialist to manage the Xero OAuth2 connection.

Layout: Full app layout. Sidebar active: "Settings". Sidebar items: AP Dashboard, Vendor Invoices, Xero Sync, Settings. User: "Chloe Tan · AP Specialist".

Top header: "Settings" as page title (24px Bold). Secondary nav tabs below the header bar: "General | Integrations" — "Integrations" tab active (underline style, #1E293B, 2px underline).

Main content — single column, max-width 720px:

Card 1 — "Xero Connection" (white card, 12px radius, "Xero Connection" as 16px Semi-Bold header):
- Connection Status row: "Connection Status" label (14px Regular #64748B) on left, large status badge on right.
  - If CONNECTED: "Connected" badge (#22C55E background 15% opacity, #22C55E text). Below badge: "EFAR Pte Ltd" in 12px #64748B.
  - If NOT CONNECTED: "Not Connected" badge (#EF4444 badge style).
- If connected, show these fields below:
  - Xero Organisation: "EFAR Pte Ltd"
  - Connected Since: 1 Jan 2026, 09:00 AM
  - Token Expires: 22 Jul 2026 — shown in amber (#F59E0B) if within 7 days with note "Token expiring soon — reconnect to refresh."
  - "Disconnect" small ghost button (red border, red text, right-aligned)
- If NOT connected, show instead:
  - Centered illustration area (80px height, gray cloud with X icon placeholder)
  - "No Xero account connected" in 14px #64748B centered
  - "Connect to Xero" primary button (full width, #1E293B) with Xero logo icon
  - "You will be redirected to Xero to authorise the connection." in 12px #64748B centered

Card 2 — "Sync Status Overview" (white card, "Sync Status Overview" as 16px Semi-Bold header):
- Subtitle: "Last 7 days" in 12px #64748B
- Row of 3 inline stat chips (light gray background, 8px radius, 12px padding):
  - "Successful Syncs: 14" (green text)
  - "Failed Syncs: 1" (red text)
  - "Pending: 2" (amber text)
- "View Full Sync Log →" blue underline link, right-aligned — navigates to 3B-Step 3: Xero Sync Status

Apply GLOBAL UI SYSTEM rules.
```

---

## Wave 2A - Liang Yi: Field Operations (Desktop)

All screens use the full desktop app layout. No mobile viewports.

**Sidebar for field crew:** My Jobs (home), My Memos, Profile. User avatar "Ravi Kumar · Field Crew" at sidebar bottom. This sidebar appears on all Wave 2A screens.

**Booking status note for designers:** When a crew member clicks "Start Job & Create Memo" on a Confirmed booking, the system simultaneously transitions the booking status from `confirmed` to `in_progress` and opens the memo wizard. There is no separate "Start Job" step - it is a single action. Submitting the completed memo transitions the booking from `in_progress` to `completed`.

### Step 1: My Jobs

```
Design the "My Jobs" screen — the home screen for Ravi Kumar (Field Crew) after login.

Layout: Full app layout. Sidebar active: "My Jobs". Sidebar items: My Jobs, My Memos, Profile. User: "Ravi Kumar · Field Crew".

Top header: "My Jobs" as page title (24px Bold). Notification bell top right.

Main content:
- Date filter tab pills row: "Today | Tomorrow | This Week" — "Today" active.
- Job cards displayed as a vertical list (not a table) — one card per assigned booking. Each card is a white card (12px radius, 1px #E2E8F0 border, 20px padding) with a 4px left color accent bar matching job status color.

Card layout (horizontal): left accent bar | status badge (top right of card) | main content area | action button (right-aligned).

Main content area inside card (left to right):
- Booking ref in 12px #64748B (e.g. BKG-2026-00008)
- Client name in 16px Semi-Bold #1E293B (e.g. Changi General Hospital)
- Service type + transfer type in 14px #64748B (e.g. EAS · One-Way Hospital Transfer)
- Scheduled date and time in 12px #64748B (e.g. 5 Jul 2026, 14:30)
- Pickup and destination in 12px #64748B (e.g. CGH → SGH A&E)

Status-specific card styles and buttons:
- Confirmed (accent bar #3B82F6, badge blue): action button "Start Job & Create Memo" (primary navy, 160px wide, 40px height). Note below button in 12px #64748B: "This will mark the job as In Progress."
- In Progress (accent bar #F59E0B, badge amber): action button "Complete Memo" (primary navy). Note: "Job started — submit your field memo when done."
- Completed (accent bar #22C55E, badge green): action button area shows "Memo Submitted ✓" in 14px #22C55E with a checkmark icon, no button.

Sample cards to show:
- Card 1 (In Progress): BKG-2026-00004 · Tan Tock Seng Hospital · MTS · One-Way Hospital · 14 Jun 2026, 08:00 · TTS → SGH A&E
- Card 2 (Confirmed): BKG-2026-00008 · Changi General Hospital · EAS · Critical · 5 Jul 2026, 14:30 · CGH → SGH A&E
- Card 3 (Completed): BKG-2026-00003 · TTSH · EAS · One-Way Hospital · 13 Jun 2026 · Memo Submitted ✓

Empty state: If no jobs assigned today, centered clipboard illustration with green checkmark and text "No jobs assigned for today. Check 'This Week' for upcoming assignments." in 14px #64748B.

Apply GLOBAL UI SYSTEM rules.
```

### Step 2: Memo Wizard - Job Details (Step 1 of 4)

```
Design the first step of the Create Field Memo wizard for EFAR field crew on desktop.

Layout: Full app layout. Sidebar active: "My Jobs". Wizard content fills the main content area.

Wizard progress bar: horizontal bar at top of main content showing 4 steps — "1 Job Details (active) → 2 Service & Charges → 3 Signature → 4 Stamp & Submit". Active step: navy filled circle with step number. Future steps: gray circle. Progress bar fills 25%.

Pre-filled booking summary (light blue #EFF6FF card, 8px radius, 16px padding, top of form):
- "Pre-filled from booking BKG-2026-00008" in 12px #3B82F6 with a lock icon
- Fields shown as static read-only text (label: value): Client: Changi General Hospital | Date: 5 Jul 2026 | Pickup: CGH, 2 Simei Street 3 | Destination: SGH A&E, Outram Road
- These fields cannot be edited by the crew member.

Editable form fields below (2-column grid layout):
- Column 1: "Job Start Time" — time picker, required, placeholder "08:00"
- Column 2: "Job End Time" — time picker, required, placeholder "09:30"
- Full width: "Patient Name" — text input, required, placeholder "Full legal name of patient"
- Full width: "Patient NRIC / FIN" — text input, optional, placeholder "S1234567A (if provided)"
- Column 1: "Overtime Hours" — number input, default 0, min 0. Helper: "Enter 0 if no overtime occurred."
- Column 2: "Evacuation Floors" — number input, default 0, min 0. Helper: "Number of floors evacuated (for documentation). Enter 0 if none."

Navigation footer (right-aligned, 64px height, white, border-top #E2E8F0):
- "Next: Service & Charges →" primary button (disabled until required fields are filled)

Apply GLOBAL UI SYSTEM rules.
```

### Step 3: Memo Wizard - Service & Charges (Step 2 of 4)

```
Design step 2 of the field memo wizard on desktop. Progress bar shows step 2 active (50%).

Form content organized in 2 sections within the main content area:

Section 1 — "Service Classification" card (white):
- Title: "Service Classification" (16px Semi-Bold)
- 2-column grid:
  - "Service Type" dropdown (required): EAS, MTS, Event Standby, Workplace Standby
  - "Transfer Type" dropdown (required): One-Way Hospital Transfer, Two-Way Hospital Transfer, COVID-19 Case Transport, IMH/Psychiatric Transfer, Airport (No Tarmac), Airport (With Tarmac), SG-JB Ground Transfer, Air Evacuation
- Full width: "Was this job during office hours?" toggle (YES/NO). Label on left, toggle on right. Helper: "Office hours: Monday to Friday, 08:30–17:30."

Section 2 — "Surcharges & Special Conditions" card (white, below Section 1):
- Title: "Surcharges & Special Conditions" (16px Semi-Bold)
- 2-column grid of toggle rows. Each row: label on left, YES/NO toggle on right, helper text below if YES is selected:
  - "Were stairs or elevator access required?" (maps to has_inconvenience_fee). If YES: amber info chip "A flat $50 inconvenience fee will be applied."
  - "Oxygen used?" (maps to oxygen_litres_used). If YES: reveal a number input "Litres used" below this row. Helper: "First 10L: $50 flat. Each additional litre: $1."
  - "Disposables used?" (maps to disposables_used). No extra input needed.
  - "Resuscitation performed?" If YES: amber chip "$320 surcharge will be applied."
  - "Suction performed?" No extra input.
  - "Jurong Island job?" If YES: amber chip "A Jurong Island access surcharge will be applied."
- Full-width fields below the grid:
  - "Waiting Time (minutes)" — number input, default 0. Helper: "Waiting time is charged per 30-minute block."
  - "Patient Weight (kg)" — number input, optional. Helper: "Required if patient weight may exceed 90 kg. Used to determine heavy lifting surcharge."

Navigation footer: "← Back" ghost button left, "Next: Signature →" primary button right.

Style toggles: #1E293B background when ON, #E2E8F0 when OFF, 24px wide pill shape. Apply GLOBAL UI SYSTEM rules.
```

### Step 4: Memo Wizard - Signature (Step 3 of 4)

```
Design the digital signature capture step of the field memo wizard on desktop. Progress bar shows step 3 active (75%).

Layout: Main content area has two columns (55% left, 45% right).

LEFT — "Handover Signature" card (white):
- Title: "Capture Handover Signature" (16px Semi-Bold)
- Subtitle: "Ask the patient or client representative to sign in the box below." (14px Regular #64748B)
- Signature canvas: white rectangle, full width, 220px height, 2px dashed #E2E8F0 border, 8px radius. Centered placeholder text "Sign here" in 16px Regular #94A3B8 — disappears when drawing starts.
- "Clear Signature" small ghost button below canvas, right-aligned.
- "Signer's Name" text input (required) — placeholder "Full name of person signing"
- "Signer's Role / Relationship" text input (optional) — placeholder "e.g. Patient, Hospital Coordinator, Family Member"

Waiver section (collapsible, initially collapsed, light yellow #FFFBEB background card):
- "Patient unable to sign?" blue underline toggle link.
- When expanded: amber banner "Waiving signature is only permitted when the patient is medically unable to sign. This is recorded for compliance audit." Textarea "Reason for waiver" (required if section is open) with placeholder "e.g. Patient unconscious — ICU transfer, no conscious representative available."

RIGHT — "Signature Preview" card (white):
- Title: "Preview" (16px Semi-Bold)
- Shows live preview of the captured signature as a gray placeholder rectangle until a signature is drawn.
- Below preview: "Ready to submit" green badge if signature is captured, "Signature required" gray badge if empty.

Navigation footer: "← Back" ghost button, "Next: Stamp & Submit →" primary button (disabled if no signature and no waiver reason).

Apply GLOBAL UI SYSTEM rules.
```

### Step 5: Memo Wizard - Stamp & Submit (Step 4 of 4)

```
Design the final step of the field memo wizard on desktop. Progress bar shows step 4 active (100%).

Layout: Main content area has two columns (50% left, 50% right).

LEFT — "Hospital Stamp" card (white):
- Title: "Hospital Stamp (Optional)" (16px Semi-Bold)
- Explanation: "Some hospitals require a stamp on the service record. Upload a photo or scan of the stamped document if applicable." in 14px Regular #64748B.
- Upload zone: dashed border box (full width, 160px height, 8px radius), centered upload icon (32px, #94A3B8), "Click to upload or drag and drop" in 14px #94A3B8. Below: "PNG, JPG or PDF · Maximum 10 MB"
- If image uploaded: thumbnail preview (120x80px, 8px radius) with a red X button to remove. A toggle "Is the stamp clearly legible?" (YES/NO) appears below.

RIGHT — "Memo Summary" card (white):
- Title: "Review Before Submitting" (16px Semi-Bold)
- Read-only summary of all entered data:
  - Booking: BKG-2026-00008 · 5 Jul 2026, 08:00–09:30
  - Patient: John Tan → SGH A&E
  - Service: EAS · One-Way Hospital Transfer · Office Hours
  - Surcharges: Oxygen (12L), Inconvenience Fee, Waiting Time (30 min)
  - Signature: Captured ✓ (green checkmark) — Signer: Ahmad Rahman
  - Stamp: Not uploaded (gray) or "Uploaded ✓" (green)
- If any required field is missing: red warning badge listing what is incomplete.

Navigation footer: "← Back" ghost button, "Submit Memo" primary button (#1E293B, 160px wide, 44px height). If the summary shows incomplete required fields, "Submit Memo" is disabled with a tooltip "Complete all required fields before submitting."

Apply GLOBAL UI SYSTEM rules.
```

### Step 6: Memo Submitted Confirmation

```
Design the memo submission success screen on desktop for a field crew member.

Layout: Full app layout. Sidebar active: "My Jobs".

Main content: centered vertically and horizontally in the content area, max-width 560px.

Card (white, 16px radius, 48px padding, text centered):
- Large green circle with white checkmark (64px, #22C55E) centered at top
- "Memo Submitted!" in 24px Bold #1E293B, centered
- "Reference: MEMO-2026-00006" in 16px Regular #64748B
- "The AR team has been notified and will review your memo shortly." in 14px Regular #64748B centered
- Thin divider
- 2 buttons stacked (full width within card):
  - "Back to My Jobs" — primary button (#1E293B, 44px) — navigates to 2A-Step 1
  - "View My Memos" — ghost button (outline, 44px) — navigates to 2A-Step 7: Memo History

Apply GLOBAL UI SYSTEM rules.
```

### Step 7: Memo History

```
Design the Memo History screen showing all memos submitted by the logged-in crew member.

Layout: Full app layout. Sidebar active: "My Memos".

Top header: "My Memos" as page title (24px Bold).

Filter bar: Date range picker. Status tab pills: "All | Submitted | Reviewed | Returned". Search input: "Search by memo ID or client…"

Data table (white card) columns: Memo ID, Booking Ref, Client, Service Type, Job Date, Submitted At, Status, Action.
- MEMO-2026-00006 | BKG-2026-00008 | CGH | EAS | 5 Jul 2026 | 5 Jul 2026, 09:45 | Submitted (blue badge) | [View]
- MEMO-2026-00004 | BKG-2026-00004 | TTSH | MTS | 14 Jun 2026 | 14 Jun 2026, 09:31 | Reviewed (green badge) | [View]
- MEMO-2026-00002 | BKG-2026-00002 | TTSH | EAS | 11 Jun 2026 | 11 Jun 2026, 10:15 | Returned (red badge) | [View] — row tinted very light red #FEF2F2

[View] expands the row inline (accordion) to show a read-only summary of all memo fields — no separate detail screen needed. Expanded view shows: all Job Info fields, all Pricing Engine fields, Signature thumbnail, Stamp thumbnail. If status is Returned: shows an amber "Correction Required" box with the reviewer's note.

Apply GLOBAL UI SYSTEM rules.
```

---

## Wave 2B - Jasper: Pricing Contracts

**Sidebar for Sarah (AR Specialist):** AR Dashboard, Memo Review, Invoices, Pricing Contracts, Xero Sync. User: "Sarah Lim · AR Specialist". Use this same sidebar in ALL Wave 2B and 3A screens.

### Step 1: Pricing Contracts List

```
Design the Pricing Contracts list screen for Sarah (AR Specialist) at EFAR.

Layout: Full app layout. Sidebar active: "Pricing Contracts". Sidebar: AR Dashboard, Memo Review, Invoices, Pricing Contracts (active), Xero Sync. User: "Sarah Lim · AR Specialist".

Top header: "Pricing Contracts" as page title (24px Bold). Right: "+ New Contract" primary button — navigates to Step 3: Create Contract Form.

Main content:
- Filter bar: "All Contracts | Active | Expired" tab pills. Search input right: "Search by client or contract name."
- Data table (white card) columns: Contract Name, Client, Effective From, Effective To, Status, Rates, Action.
  - "TTSH - FY2026 Service Agreement" | Tan Tock Seng Hospital | 1 Jan 2026 | 31 Dec 2026 | Active (green badge) | 14 rates | [View]
  - "ABC Corp - Event & Workplace 2026" | ABC Corporation | 1 Jun 2026 | 31 Dec 2026 | Active (green badge) | 3 rates | [View]
  - "SingHealth - FY2025 Agreement" | SingHealth Group | 1 Jan 2025 | 31 Dec 2025 | Expired (gray badge) | 0 rates | [View]
- Expired row: 50% opacity on all cells except the Status badge.
- [View] navigates to Step 2: Contract Detail.

Apply GLOBAL UI SYSTEM rules.
```

### Step 2: Pricing Contract Detail

```
Design the Pricing Contract Detail screen for Sarah to view and manage rates and surcharges for one contract.

Layout: Full app layout. Sidebar active: "Pricing Contracts".

Top header: breadcrumb "Pricing Contracts > TTSH - FY2026". Status badge "Active" (green pill). Top-right: "Edit Contract" ghost button (navigates to Step 3 pre-filled) and "Deactivate" red ghost button.

Info bar (light #F8FAFC strip, full width, below header): Client: Tan Tock Seng Hospital | Effective: 1 Jan 2026 – 31 Dec 2026 | Created by: Sarah Lim | Created: 15 Dec 2025. All in 12px #64748B.

Main content — 2 columns (65% left, 35% right):

LEFT — "Pricing Rates" card (white):
- Title: "Pricing Rates" (16px Semi-Bold) + "+ Add Rate" small ghost button top right.
- Table columns: Service Type, Transfer Type, Time of Day, Base Amount, Action.
  - EAS | One-Way Hospital | Office Hours | $850.00 | [Edit] [Delete]
  - EAS | One-Way Hospital | Non-Office Hours | $950.00 | [Edit] [Delete]
  - EAS | COVID-19 | All Hours | $1,200.00 | [Edit] [Delete]
  - MTS | Airport (Tarmac) | All Hours | $1,050.00 | [Edit] [Delete]
  - (more rows, scrollable within card)
- [Delete] shows an inline confirmation strip below the row: "Delete this rate? Active invoices matched against it cannot be re-matched. [Confirm Delete] [Cancel]" — confirmation in red text.
- "+ Add Rate" opens an inline form row appended to the bottom of the table: Service Type dropdown | Transfer Type dropdown | Time of Day dropdown | Base Amount input | [Save] [Cancel].
- Empty state (if no rates): "No rates added yet. Click '+ Add Rate' to begin." centered, #64748B.

RIGHT — "Surcharge Schedule" card (white):
- Title: "Surcharges" (16px Semi-Bold) + "Edit Surcharges" small ghost button.
- List rows (label left, amount right, 14px each):
  - Oxygen Base: $50.00
  - Oxygen Per Litre (>10L): $1.00
  - Inconvenience Fee: $50.00
  - Disposables Base: $20.00
  - Resuscitation: $320.00
  - Suction: $50.00
  - Waiting Time (per 30 min): $30.00
  - Heavy Lifting (min): $50.00
  - Heavy Lifting (max): $150.00
  - Jurong Island (min): $150.00
  - Jurong Island (max): $200.00
  - Cancellation: 100%
- "Edit Surcharges" turns all amounts into editable number inputs with [Save Changes] and [Cancel] buttons appearing at the bottom of the card.

Apply GLOBAL UI SYSTEM rules.
```

### Step 3: Create / Edit Contract Form

```
Design the Create Contract form screen for Sarah to set up a new client pricing agreement. This same screen is used for editing an existing contract (fields are pre-filled when editing).

Layout: Full app layout. Sidebar active: "Pricing Contracts".

Top header:
- Creating new: "New Pricing Contract" as page title. No breadcrumb.
- Editing: breadcrumb "Pricing Contracts > TTSH - FY2026 > Edit". Page title "Edit Contract".

Main content — single column, max-width 720px:

Card 1 — "Contract Details" (white, 16px Semi-Bold header):
- "Contract Name" text input (required) — placeholder "e.g. TTSH - FY2027 Service Agreement"
- "Client" dropdown or search-to-select (required) — options pulled from clients list: Tan Tock Seng Hospital, Changi General Hospital, ABC Corporation, SingHealth Group, + "New client…" option that opens a small modal to create a client record.
- Date range row (2 columns):
  - "Effective From" date picker (required)
  - "Effective To" date picker (required). If "Effective To" is in the past, show amber warning: "This contract will be created as Expired."
- "Internal Notes" textarea (optional) — placeholder "Notes about this contract e.g. negotiated terms, renewal history"

Card 2 — "Initial Pricing Rates" (white, 16px Semi-Bold header):
- Subtitle: "You can add rates now or later from the contract detail screen." in 14px #64748B.
- A table with an "Add Rate" row form at the bottom: Service Type dropdown | Transfer Type dropdown | Time of Day dropdown (Office Hours / Non-Office Hours / All Hours) | Base Amount (SGD) number input | [Add] button.
- As rows are added, they appear in the table above the form. Each row has a [Remove] link on the right.
- Empty state: "No rates added yet." in gray. Rates are optional at creation.

Footer (sticky bottom, white, border-top):
- "Cancel" ghost button left — navigates back to Step 1 (list) without saving.
- "Save Contract" primary button right — on success: navigates to Step 2 (contract detail of the newly created contract) with a green toast "Contract created successfully."

Apply GLOBAL UI SYSTEM rules.
```

---

## Wave 3A - Jasper: Invoice Management & AR Dashboard

**Sidebar reminder:** AR Dashboard, Memo Review, Invoices, Pricing Contracts, Xero Sync. User: "Sarah Lim · AR Specialist". Same sidebar across all Wave 3A screens.

### Step 1: Memo Review Queue

```
Design the Memo Review Queue screen for Sarah (AR Specialist) to see all field memos awaiting her review.

Layout: Full app layout. Sidebar active: "Memo Review".

Top header: "Memo Review Queue" as page title (24px Bold). Sub-count line below title: "3 memos awaiting review" in 14px Regular #64748B.

Filter bar: Date range picker. Service Type dropdown. Search input: "Search by memo ID, booking ref, or client…"

Data table (white card) columns: Memo ID, Booking Ref, Client, Service Type, Transfer Type, Job Date, Submitted At, Status, Action.
- MEMO-0006 | BKG-2026-00006 | TTSH | EAS | One-Way Hospital | 20 Jun 2026 | 3h ago | Submitted (blue badge) | [Review]
- MEMO-0007 | BKG-2026-00007 | CGH | MTS | Airport (Tarmac) | 21 Jun 2026 | 1h ago | Submitted | [Review]
- MEMO-0005 | BKG-2026-00005 | TTSH | EAS | COVID-19 | 18 Jun 2026 | 10h ago | Submitted | [Review] — "Submitted At" cell text in red (overdue, > 8h)

[Review] navigates to Step 2: Memo Review Detail.

Apply GLOBAL UI SYSTEM rules.
```

### Step 2: Memo Review Detail

```
Design the Memo Review Detail screen where Sarah reviews one field memo and either approves or returns it.

Layout: Full app layout. Sidebar active: "Memo Review".

Top header: breadcrumb "Memo Review > MEMO-0006". Right side: "Booking: BKG-2026-00006 · TTSH · 14 Jun 2026" in 14px #64748B.

Main content — 2 columns (60% left, 40% right):

LEFT — "Memo Details" card (white):
Section "Job Information" (16px Semi-Bold, divider below):
- Patient Name: John Tan
- Hospital Destination: SGH A&E
- Job Start: 14 Jun 2026, 08:00
- Job End: 14 Jun 2026, 09:30
- Overtime Hours: 0
- Evacuation Floors: 2 (documentation only — does not affect pricing directly)

Section "Pricing Engine Fields" (16px Semi-Bold, divider below, card has a #3B82F6 left border accent 4px wide, a blue chip label "These fields generate the invoice"):
- Service Type: EAS
- Transfer Type: One-Way Hospital Transfer
- Office Hours: Yes ✓ (green)
- Oxygen Used: 12L (base 10L + 2L overage)
- Inconvenience Fee: Yes ($50) (green)
- Disposables: No (gray)
- Resuscitation: No (gray)
- Suction: No (gray)
- Waiting Time: 0 min (gray)
- Patient Weight: 72 kg (no heavy lifting surcharge)
- Jurong Island: No (gray)
Boolean values: "Yes" in #22C55E, "No" in #94A3B8, all 14px Regular.

Section "Attachments" (16px Semi-Bold):
- Signature: thumbnail image (80x60px, 8px radius, clickable to open enlarged view) + "Signed by: Ahmad Rahman · 14 Jun 2026, 09:31" in 12px #64748B
- Hospital Stamp: thumbnail or "Not uploaded" in #94A3B8

RIGHT — "Actions" card (white, 16px Semi-Bold header):
Primary action:
- "Approve & Match Invoice" button (#1E293B primary, full width, 48px)
- Helper text below: "Approving triggers the automated pricing match. You will be redirected to the generated invoice for review." in 12px #64748B
- On click: → navigates to 3A-Step 4: Invoice Detail (the newly generated invoice)

Divider with label "or return for correction".

Secondary action:
- "Correction note" textarea (required before Return button enables) — placeholder "Describe what the crew needs to correct before resubmitting…"
- "Return Memo to Crew" button (#EF4444 destructive, full width, 44px)
- On click: → shows green toast "Memo returned to crew with correction note", then navigates back to 3A-Step 1: Memo Review Queue

Apply GLOBAL UI SYSTEM rules.
```

### Step 3: Invoice Review List

```
Design the Invoice Review list screen showing all invoices generated by the pricing engine.

Layout: Full app layout. Sidebar active: "Invoices".

Top header: "Invoices" as page title (24px Bold). Right: "Batch Approve" primary button — opens a modal listing all Matched invoices with checkboxes for bulk approval.

Summary stat bar (6 equal-width stat cards, white):
- Matched: 3 (blue — pending Sarah's review)
- Adjusted: 1 (blue — Sarah made manual changes, pending approval)
- Approved: 1 (amber — approved, not yet pushed to Xero)
- Synced to Xero: 4 (green)
- Failed: 1 (red — Xero push failed)
- Unmatched: 1 (gray — no active contract for this client)

Filter bar: status tab pills (All | Matched | Adjusted | Approved | Synced | Failed | Unmatched). Date range picker. Client dropdown.

Data table columns: Invoice ID, Booking Ref, Client, Service Type, Subtotal, Status, Xero ID, Action.
- INV-001 | BKG-001 | TTSH | EAS | $850.00 | Matched (blue) | — | [Review]
- INV-002 | BKG-002 | TTSH | EAS | $1,080.00 | Adjusted (blue) | — | [Review]
- INV-003 | BKG-003 | TTSH | EAS | $1,570.00 | Approved (amber) | — | [Sync to Xero]
- INV-004 | BKG-004 | TTSH | MTS | $1,200.00 | Synced ✓ (green) | INV-XR-0041 | [View]
- INV-005 | BKG-005 | TTSH | EAS | $850.00 | Failed ✗ (red) | — | [Retry Sync]
- INV-006 | BKG-006 | SingHealth | EAS | $0.00 | Unmatched (gray) | — | [View]
Failed and Unmatched rows have very light status-colored background tint.
[Review] / [View] navigates to Step 4: Invoice Detail. [Sync to Xero] and [Retry Sync] trigger the operation in-place with a loading spinner replacing the button, then update the status badge.

Apply GLOBAL UI SYSTEM rules.
```

### Step 4: Invoice Detail & Line Item Adjustment

```
Design the Invoice Detail screen where Sarah reviews line items, makes manual adjustments, approves, and syncs to Xero.

Layout: Full app layout. Sidebar active: "Invoices".

Top header: breadcrumb "Invoices > INV-002". Status badge "Adjusted" (blue pill) inline. Action buttons top-right (change based on status — described below). Below title: "Booking: BKG-2026-00002 · Tan Tock Seng Hospital · 11 Jun 2026" in 12px #64748B.

Top-right buttons by status:
- If Matched or Adjusted: "Approve Invoice" primary button + "Reject Match" red ghost button
- If Approved (after clicking Approve): "Approve Invoice" button disappears, replaced by "Sync to Xero" primary button (green #22C55E background). A green info bar appears: "Invoice approved — ready to sync to Xero."
- If Synced: All action buttons replaced by a green "Synced to Xero ✓" badge and Xero invoice ID.
- If Failed: "Retry Sync" button (amber) + "Reject Match" red ghost button.

Main content — 2 columns (65% left, 35% right):

LEFT — "Invoice Line Items" card (white):
- Title: "Line Items" (16px Semi-Bold) + "+ Add Adjustment" small ghost button top-right.
- Table columns: Description, Qty, Unit Price, Amount, Type, Actions.
  - EAS - One-Way Hospital Transfer (Non-Office Hours) | 1 | $950.00 | $950.00 | Auto (blue badge) | [Edit icon]
  - Oxygen - Base charge (first 10L) | 1 | $50.00 | $50.00 | Auto | [Edit icon]
  - Oxygen - Additional (5L @ $1/L) | 5 | $1.00 | $5.00 | Auto | [Edit icon]
  - Inconvenience Fee (stair/elevator access) | 1 | $50.00 | $50.00 | Auto | [Edit icon]
  - Hospital Administration Fee | 1 | $25.00 | $25.00 | Manual (amber badge) | [Edit icon] [Delete icon]
- Auto rows: blue badge, [Edit icon] only (no delete).
- Manual rows: amber badge, [Edit icon] + [Delete icon]. Delete shows inline confirmation.
- Footer totals row: "Subtotal: $1,080.00 | Tax: $0.00 | Total: $1,080.00" right-aligned in 16px Semi-Bold.

RIGHT — "Invoice Summary" card (white):
- Client: Tan Tock Seng Hospital
- Contract: TTSH - FY2026 Service Agreement (blue underline link → 2B-Step 2)
- Memo Ref: MEMO-0002 (blue underline link → 3A-Step 2 read-only)
- Booking Ref: BKG-2026-00002 (blue underline link → 1A-Step 6)
- Invoice Status: Adjusted
- Created: 11 Jun 2026
- Note in 12px #64748B: "Manual adjustment items are amber-highlighted and logged for audit."

"Reject Match" behavior: clicking this shows a confirmation modal: "This will delete the invoice and return the memo to the review queue. The pricing match cannot be recovered. [Confirm Reject] [Cancel]". On confirm → navigates to 3A-Step 1: Memo Review Queue.

Apply GLOBAL UI SYSTEM rules.
```

### Step 5: AR Dashboard

```
Design the AR Dashboard — the main landing screen for Sarah (AR Specialist) after login.

Layout: Full app layout. Sidebar active: "AR Dashboard".

Top header: "AR Dashboard" as page title (24px Bold). Date range picker top-right (default: This Month). "Refresh" icon button.

Main content grid:

Row 1 — 3 equal-width stat cards:
- "Total Invoiced This Month" — "$18,350.00" in 28px Bold #1E293B. Trend chip: "+12% vs last month" in 12px #22C55E.
- "Synced to Xero" — "14 invoices" in 28px Bold #22C55E.
- "Revenue Leakage Risk" — "3 bookings" in 28px Bold #EF4444, warning triangle icon, red left border on card. Subtitle: "Completed jobs with no memo submitted." Clicking the card or a "View Alerts →" link scrolls to the leakage panel in Row 2.

Row 2 — 2 columns:

LEFT (60%) — "Invoice Status Breakdown" card (white):
- Title: "Invoice Status" (16px Semi-Bold)
- Horizontal stacked bar showing all invoice statuses as proportional segments: Matched (blue), Adjusted (light blue), Approved (amber), Synced (green), Failed (red), Unmatched (gray).
- Legend below: colored dot + status label + count + total SGD value per status.

RIGHT (40%) — "Revenue Leakage Alerts" card (white, 4px left border #EF4444):
- Title: "Jobs Without Memo" (16px Semi-Bold, red) with warning triangle icon.
- Alert list rows (max 5 visible, scrollable):
  - BKG-2026-00004 · TTSH · 14 Jun · Ravi Kumar · "6.5h since completion" in #EF4444
  - BKG-2026-00007 · CGH · 20 Jun · Ahmad · "2.1h since completion" in #F59E0B
  Each row has a small "View Booking" link (blue underline, navigates to 1A-Step 6: Booking Detail, cross-wave).
- "View All" link at bottom → navigates to 1A-Step 5: Booking List filtered to Completed status.
- If count = 0: green "No revenue leakage detected ✓" text.

Row 3 — "Xero Bank Feed" card (white, full width):
- Title: "Xero Bank Feed" (16px Semi-Bold). Last synced: "22 Jun 2026, 10:30 AM" in 12px #64748B. "Pull Latest" ghost button top-right. "View Full Sync Log →" blue underline link top-right (navigates to 3B-Step 3: Xero Sync Status, shared screen).
- Table: Date | Description | Amount | Type.
  - 21 Jun | Payment from TTSH | $850.00 | Credit (green text)
  - 20 Jun | Payment from CGH | $1,200.00 | Credit (green text)

Apply GLOBAL UI SYSTEM rules.
```

---

## Wave 3B - Kwan Hua: AP Processing

**Sidebar reminder:** AP Dashboard, Vendor Invoices, Xero Sync, Settings. User: "Chloe Tan · AP Specialist". Use this sidebar in ALL Wave 3B screens.

### Step 0: AP Dashboard

```
Design the AP Dashboard — the main landing screen for Chloe (AP Specialist) after login.

Layout: Full app layout. Sidebar active: "AP Dashboard". Sidebar: AP Dashboard (active), Vendor Invoices, Xero Sync, Settings. User: "Chloe Tan · AP Specialist".

Top header: "AP Dashboard" as page title (24px Bold). Date range picker top-right (default: This Month).

Main content grid:

Row 1 — 4 equal-width stat cards (white, 12px radius):
- "Pending Review" — count "3" in 28px Bold #F59E0B. Subtitle: "Vendor invoices awaiting your review."
- "Low Confidence OCR" — count "1" in 28px Bold #EF4444, warning triangle icon. Subtitle: "AI extraction below 80% — manual check required." Red left border on card.
- "Synced to Xero This Month" — count "12" in 28px Bold #22C55E
- "Failed Syncs" — count "1" in 28px Bold #EF4444

Row 2 — 2 columns:

LEFT (60%) — "Recent Vendor Invoice Activity" card (white):
- Title: "Recent Activity" (16px Semi-Bold)
- List of last 5 vendor invoice events (most recent first), each row:
  - Vendor name in 14px Semi-Bold | Invoice No. in 12px #64748B | Event description in 14px | Timestamp in 12px #64748B | Status badge
  - e.g. Fuels Direct | FD-2026-0421 | "Uploaded & extracted" | 22 Jun, 10:10 AM | Pending Review (amber)
  - AutoRepair SG | AR-2026-099 | "Low confidence OCR — review required" | 21 Jun, 3:45 PM | Pending Review + red ⚠
  - Medical Supplies Co | MSC-0388 | "Approved by Chloe Tan" | 10 Jun, 2:30 PM | Approved (green)
- "View All Invoices →" blue link at bottom → navigates to 3B-Step 1: Vendor Invoice List.

RIGHT (40%) — "Quick Actions" card (white):
- Title: "Quick Actions" (16px Semi-Bold)
- "+ Upload Vendor Invoice" primary button (full width, #1E293B, 44px) → opens upload modal (same as 3B-Step 1 modal)
- "Review Low Confidence Invoices" amber ghost button (full width, 44px) → navigates to 3B-Step 1 filtered to Low Confidence
- "View Xero Sync Status" ghost button (full width, 44px) → navigates to 3B-Step 3

Apply GLOBAL UI SYSTEM rules.
```

### Step 1: Vendor Invoice List

```
Design the Vendor Invoice List screen for Chloe (AP Specialist).

Layout: Full app layout. Sidebar active: "Vendor Invoices".

Top header: "Vendor Invoices" as page title (24px Bold). Right: "+ Upload Invoice" primary button — opens the upload modal described below.

Main content — Invoice list (white card):
- Filter tabs: "All | Pending Review | Low Confidence | Approved | Rejected | Synced | Failed". Search input right.
- Data table columns: Vendor, Invoice No., Invoice Date, Extracted Total, Confidence, Status, Action.
  - Fuels Direct | FD-2026-0421 | 18 Jun 2026 | $4,320.00 | 95% (green text) | Pending Review (amber badge) | [Review]
  - AutoRepair SG | AR-2026-099 | 15 Jun 2026 | $1,850.00 | 62% (red text) | Pending Review + "Low Confidence" red warning badge | [Review] — entire row light red background tint
  - Medical Supplies Co | MSC-0388 | 10 Jun 2026 | $780.00 | 88% (green) | Approved (green badge) | [View]
  - Fuels Direct | FD-2026-0410 | 2 Jun 2026 | $3,900.00 | 91% (green) | Synced ✓ (green badge) | [View]
[Review] navigates to Step 2: AP Invoice Review. [View] navigates to Step 2 in read-only mode (action buttons hidden).

Upload modal (overlays the page when "+ Upload Invoice" is clicked):
- Modal: white card, 480px wide, 16px radius, overlay background rgba(0,0,0,0.4)
- Title: "Upload Vendor Invoice PDF" (16px Semi-Bold)
- Dashed upload area (full width, 140px): cloud-up icon (32px, #94A3B8), "Drag and drop PDF here or click to browse" in 14px #94A3B8. Below: "PDF only · Maximum 10 MB"
- "Vendor Name" text input (optional): placeholder "Auto-detected from PDF if left blank"
- Row of 2 buttons: "Cancel" ghost button | "Upload & Extract" primary button
- Helper: "Our AI will extract invoice details. You will be redirected to review the results." in 12px #64748B. On success → navigates to Step 2 with the new invoice.

Apply GLOBAL UI SYSTEM rules.
```

### Step 2: AP Invoice Review (Two-Panel)

```
Design the AP Invoice Review screen for Chloe to verify OCR-extracted invoice data against the original PDF side by side.

Layout: Full app layout. Sidebar active: "Vendor Invoices".

Top header: breadcrumb "Vendor Invoices > FD-2026-0421". Status badge "Pending Review" (amber pill). Action buttons top-right: "Approve Invoice" primary button (green #22C55E background, white text) + "Reject" red ghost button.

On Approve: shows green toast "FD-2026-0421 approved successfully", then navigates back to 3B-Step 1: Vendor Invoice List with the row status updated to Approved.
On Reject: shows confirmation modal "Are you sure? This invoice will be marked as Rejected and archived." [Confirm Reject] [Cancel]. On confirm → green toast "Rejected" + navigates to 3B-Step 1 with row status updated to Rejected.

Main content — two equal panels:

LEFT PANEL (50%) — "Source Document" card (white):
- Title: "Source Document" (16px Semi-Bold)
- PDF viewer placeholder: full-height gray box (#F1F5F9, 600px) with centered text "PDF Preview · Fuels Direct · FD-2026-0421 · 18 Jun 2026" in 14px #64748B. In production this renders the actual PDF.
- "Open Full Screen" small ghost button below, right-aligned.

RIGHT PANEL (50%) — "AI-Extracted Data" card (white):
- Title: "AI-Extracted Data" (16px Semi-Bold)
- Confidence badge row: "Extraction Confidence: 95%" — green pill if ≥ 80%, amber if 60–79%, red if < 60%. If red or amber: banner below "Low confidence detected — all fields are highlighted for careful review." with amber left border on every field below.
- Editable fields (label above input):
  - "Vendor Name" text input: "Fuels Direct"
  - "Invoice Number" text input: "FD-2026-0421"
  - "Invoice Date" date picker: 18 Jun 2026
  - "Extracted Total" number input: "$4,320.00"
  - "Rebate Rate" number input with % suffix: "1.00" — helper: "Rebate is auto-calculated."
  - "Rebate Amount" read-only: "$43.20" in 14px Regular #64748B
  - "Verified Total (after rebate)" read-only: "$4,276.80" in 16px Semi-Bold #22C55E
- Line Items table (within the right panel):
  - Columns: Description, Qty, Unit Price, Amount, Edit.
  - Diesel Fuel (500L) | 500 | $2.20 | $1,100.00 | [Edit icon]
  - Petrol (900L) | 900 | $2.80 | $2,520.00 | [Edit icon]
  - Delivery Charge | 1 | $700.00 | $700.00 | [Edit icon]
  - Footer: Subtotal: $4,320.00

Apply GLOBAL UI SYSTEM rules.
```

### Step 3: Xero Sync Status Panel

```
Design the Xero Sync Status Panel — a shared screen accessible from both the AR Specialist and AP Specialist portals. Both Sarah (AR) and Chloe (AP) can view and retry their respective sync records.

Layout: Full app layout. Sidebar active: "Xero Sync". Sidebar items match the logged-in user's role (AP sidebar for Chloe, AR sidebar for Sarah).

Top header: "Xero Sync Status" as page title (24px Bold). "Reconnect Xero" ghost button top-right (visible only if Xero connection is invalid — clicking navigates to 1B-Step 1: Xero Integration Settings).

Summary stat row (3 cards):
- Successful: 28 (green)
- Pending: 2 (amber)
- Failed: 3 (red)

Filter tabs: "All | AR Invoices | AP Invoices | Bank Feed | Failed". Date range picker right.

Data table columns: Entity Type, Reference, Xero Record ID, Attempts, Last Error, Synced At, Action.
- AR Invoice | INV-005 | — | 2 | "Contact code not found in Xero" | — | [Retry]
- AP Invoice | FD-2026-0421 | — | 1 | "Unrecognised account code: 4200" | — | [Retry]
- AP Invoice | AR-2026-099 | — | 3 | "Authentication token expired" | — | [Contact Support] (gray, disabled)
- AR Invoice | INV-004 | INV-XR-0041 | 1 | — | 14 Jun 2026, 09:45 | ✓ Synced (green, no action)
- Bank Feed | FEED-0022 | — | 1 | — | 22 Jun 2026, 10:30 | ✓ Synced (green)

Row with 3 attempts: entire row light red tint (#FEF2F2). Below that row: inline amber note "Maximum retries reached. This likely requires a Xero configuration fix — contact your Xero administrator."

Banner at top of table (if multiple failures share a root cause): amber banner "3 syncs failed. A shared root cause may exist. Reconnecting to Xero may resolve token-related failures." with "Reconnect Xero" action button inside the banner (navigates to 1B-Step 1).

[Retry] triggers retry in-place: button shows loading spinner, then status updates to Synced ✓ or shows new error.

Apply GLOBAL UI SYSTEM rules.
```

---

## Wave 4 - Liang Yi: Executive Dashboard

**Sidebar for Doris (Managing Director):** Dashboard, Reports. Minimal sidebar — Doris has read-only access to all modules, so she does not get the operational sidebar items. User: "Doris Tan · Managing Director".

Both steps below are tabs within the same dashboard screen. Both tabs must show the secondary tab bar.

### Step 1: Executive Dashboard - Fleet Overview

```
Design the Executive Dashboard for Doris (Managing Director) — Fleet Overview tab.

Layout: Full app layout. Sidebar active: "Dashboard". Sidebar items: Dashboard (active), Reports. User: "Doris Tan · Managing Director".

Top header: "Executive Dashboard" as page title (24px Bold). Date range picker top-right (default: Today). "Refresh" icon button.

Secondary tab bar (inside main content, below the page title area): "Fleet Overview (active, underline style #1E293B 2px) | Expense Summary". Clicking "Expense Summary" navigates to Step 2.

Main content:

Row 1 — 4 equal-width KPI stat cards (white, 12px radius):
- "Total Bookings Today" — "13" in 32px Bold #1E293B. Below: "5 Confirmed · 2 In Progress · 4 Completed · 2 Invoiced" in 12px #64748B.
- "Active Jobs (Now)" — "2" in 32px Bold #F59E0B (amber). Below: "Jobs currently In Progress."
- "Memos Pending Submission" — "3" in 32px Bold #EF4444, warning triangle icon. Red left border on card. Below: "Revenue leakage risk."
- "Invoices Synced This Month" — "14" in 32px Bold #22C55E.

Row 2 — 2 columns:

LEFT (55%) — "Booking Status Distribution" card (white):
- Title: "Booking Status Distribution" (16px Semi-Bold). Subtitle: date range shown in 12px #64748B.
- Doughnut/pie chart (MUI X Charts): 4 segments — Confirmed (#3B82F6), In Progress (#F59E0B), Completed (#9333EA), Invoiced (#22C55E).
- Legend below: colored dot + label + count + percentage.
- Date filter tabs below legend: "Today | This Week | This Month | Custom"

RIGHT (45%) — "Revenue Leakage" card (white, 4px left border #EF4444):
- Title: "Jobs Without Memo" (16px Semi-Bold, #EF4444 text) with ⚠ icon.
- Alert list rows (max 5, scrollable):
  - BKG-004 · TTSH · Ravi Kumar · "6.5h overdue" in #EF4444
  - BKG-007 · CGH · Ahmad · "2.1h since completion" in #F59E0B
  Each row: "View Booking →" blue link (navigates to 1A-Step 6: Booking Detail — read-only for Doris, cross-wave navigation).
- If count = 0: green "All completed jobs have memos ✓" with checkmark.
- Note in 12px italic #64748B: "Source: booking data (Zheng Bao's module). Doris has read-only access."

Apply GLOBAL UI SYSTEM rules.
```

### Step 2: Executive Dashboard - Vendor Expense Summary

```
Design the Executive Dashboard Expense Summary tab for Doris (Managing Director).

Layout: Full app layout. Same sidebar as Step 1 (Dashboard active).

Top header: "Executive Dashboard" as page title (24px Bold). Same date range picker and Refresh button.

Secondary tab bar: "Fleet Overview | Expense Summary (active, underline style)". Clicking "Fleet Overview" navigates to Step 1.

Main content:

Row 1 — 3 equal-width KPI stat cards:
- "Total Vendor Expenditure" — "$31,240.00" in 28px Bold #1E293B
- "Total Rebates Applied" — "$312.40" in 28px Bold #22C55E. Below: "1% rebate across 4 vendors."
- "Net Payable After Rebates" — "$30,927.60" in 28px Bold #1E293B

Filter bar (above charts): "All Vendors" dropdown | Date range picker (From / To) | "Export CSV" ghost button right-aligned.

Row 2 — 2 columns:

LEFT (55%) — "Expenditure by Vendor" card (white):
- Title: "Vendor Breakdown" (16px Semi-Bold)
- Vertical bar chart (MUI X Charts): one bar per vendor. X-axis: vendor names. Y-axis: SGD.
  - Fuels Direct: $18,320 (tallest, #1E293B)
  - AutoRepair SG: $7,850 (#1E293B at 70% opacity)
  - Medical Supplies Co: $3,780 (#1E293B at 50% opacity)
  - Others: $1,290 (#1E293B at 30% opacity)
- Clicking a bar highlights it and updates the RIGHT panel to show invoices for that vendor.

RIGHT (45%) — "Vendor Invoice List" card (white):
- Title dynamically: "Fuels Direct — Invoices" (updated on bar click), 16px Semi-Bold.
- Read-only table: Invoice No. | Date | Amount | Rebate | Net | Status.
  - FD-2026-0421 | 18 Jun | $4,320 | $43.20 | $4,276.80 | Synced ✓ (green)
  - FD-2026-0410 | 2 Jun | $3,900 | $39.00 | $3,861.00 | Synced ✓
- Scrollable within card. "View All Invoices →" blue link at bottom → navigates to 3B-Step 1: Vendor Invoice List (read-only view for Doris, AP actions hidden).
- Note in 12px italic #64748B: "Doris has read-only access. AP actions require Chloe's login."

Row 3 — "Vendor Spend Trend" card (white, full width):
- Title: "Vendor Spend by Month — FY2026" (16px Semi-Bold)
- Line chart (MUI X Charts): 12 months on X-axis, SGD on Y-axis. Single #1E293B line with filled dot at current month. Future months shown as dashed line.

Apply GLOBAL UI SYSTEM rules.
```

---

## How to Use These Prompts in Figma Make

1. Open your Figma file and activate **Figma Make** (AI design generation).
2. For each step, **copy the full prompt text** inside the code block.
3. **Append the GLOBAL UI SYSTEM block** from the section above at the end of your prompt. Every prompt must include it.
4. Paste the combined text into Figma Make and generate.
5. After generating all screens, manually connect frames using Figma's prototype arrows following the **Navigation Map** at the top of this document.
6. Name each generated frame using the convention: `[Wave]-[Member]-[Step] Screen Name` — e.g. `W1A-ZB-03 Intake Queue`, `W2A-LY-01 My Jobs`.

**Prompting order:** Follow the wave order (0 → 1A → 1B → 2A → 2B → 3A → 3B → 4). Within a wave, prompt in step order as screens build on each other visually.
