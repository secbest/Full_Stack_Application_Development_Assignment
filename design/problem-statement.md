# Problem Statement

**Project:** Emergencies First Aid & Rescue (EFAR) - Full-Stack Digital Platform
**Scope:** Proof of Concept (PoC)

---

## 1. Core Problem

EFAR is an ambulance services company that already uses Xero as its accounting software but treats it as a passive filing tool rather than an active automation engine. The result is an over-reliance on 2-3 staff members performing manual, repetitive financial tasks - transcribing handwritten field memos into invoices, matching bank statements by hand, and chasing customer queries across WhatsApp, email, and phone.

The root failure is the absence of a connected digital loop from the field (ambulance crew completing a job) to the finance desk (billing that job). Because this loop is broken, critical charges - overtime, multi-floor evacuation fees - routinely go unrecorded on late paper slips, causing direct revenue leakage. As the fleet grows, the only current way to handle more work is to hire more people, making the business structurally unscalable.

---

## 2. User Roles

### Managing Director (Doris Ching)
- Needs macro visibility over fleet operations, overhead costs, and financial margins.
- Currently lacks a real-time dashboard; relies on manual reports compiled by staff.
- **Primary need:** Executive command center showing live operational and financial health.

### Accounts Receivable Specialist (Sarah)
- Responsible for turning completed field jobs into invoices and syncing them to Xero.
- Currently receives handwritten or verbally relayed service memos and manually transcribes them, then manually cross-checks against each client's pricing contract.
- **Primary need:** Automated matching of field memo data against client-specific pricing tables, with one-click Xero sync for validated invoices.

### Accounts Payable Specialist (Chloe)
- Responsible for processing incoming vendor invoices (diesel, vehicle repairs) and verifying rebates.
- Currently hand-keys data from PDF vendor bills and manually checks for the contracted 1% corporate rebate.
- **Primary need:** OCR/AI extraction of vendor invoice data with automated rebate verification, reducing her role to reviewing and approving rather than transcribing.

### Quotations Specialist (Camilla)
- Manages inbound customer queries and converts them into service bookings.
- Currently receives unstructured queries across multiple channels (WhatsApp, email, calls), leading to 5-day clarification delays before a booking can even be confirmed.
- **Primary need:** A structured digital intake form that enforces mandatory fields upfront, eliminating back-and-forth clarification loops.

---

## 3. End-to-End Workflows

### Workflow A - AR: Customer Intake to Invoice (Accounts Receivable)

```
Customer submits structured query via intake portal
  -> Camilla reviews intake queue, verifies service tier, confirms booking
  -> Field crew completes job and fills digital service memo
     (captures: job details, overtime hours, evacuation floor count, digital signature)
  -> System auto-matches memo data against client pricing contract
  -> Sarah reviews matched invoice, adjusts surcharges if needed
  -> Sarah approves and syncs batch to Xero as draft invoices
  -> Xero handles final invoice generation and bank feed ingestion
```

### Workflow B - AP: Vendor Invoice Processing (Accounts Payable)

```
Vendor sends PDF invoice (diesel, repairs, etc.)
  -> Staff uploads PDF into the platform
  -> OCR/Gemini AI extracts structured data (vendor, amount, line items, date)
  -> System automatically checks for contracted 1% corporate rebate
  -> Chloe reviews extracted data and rebate calculation
  -> Chloe approves; reconciled data syncs to Xero AP ledger
```

### Workflow C - Executive Oversight

```
Managing Director logs in to command center dashboard
  -> Views real-time fleet status and job completion rates
  -> Reviews overhead cost breakdown and vendor expense trends
  -> Monitors AR batch status (pending, matched, synced to Xero)
  -> Identifies margin risks or unresolved surcharges
```

---

## 4. Highest-Risk and Most Complex Areas

### 4.1 - Client-Specific Pricing Matrix (High Complexity)
Each hospital or client has a unique pricing contract with different base rates, overtime multipliers, evacuation floor surcharges, and billing rules. The automated matching engine must correctly apply the right contract to each job. Errors here directly produce wrong invoices. This requires a well-designed pricing rules table in the database and thorough test coverage.

### 4.2 - OCR / AI Document Ingestion (High Risk)
Using Gemini API to extract structured data from uncontrolled vendor PDF invoices is inherently error-prone - vendors format invoices differently. The system must handle extraction failures gracefully, flag low-confidence results for human review, and never silently pass incorrect data to Chloe for approval.

### 4.3 - Xero API Integration (High Risk)
Xero OAuth2 flows, token refresh cycles, and API rate limits add significant integration complexity. Any failure in the Xero sync path means invoices are created in the platform but never reach the accounting system, breaking the entire billing loop. Error handling and retry logic are critical here.

### 4.4 - Digital Field Memo Capture (Medium-High Complexity)
The memo form must be usable by field ambulance crew on mobile devices under time pressure. All revenue-sensitive fields (overtime, evacuation floors) must be mandatory and validated before submission. The digital signature fallback (for cases where hospital stamps are required) adds an image upload and storage concern via Cloudinary.

### 4.5 - Role-Based Access Control (Medium Complexity)
Four distinct roles need different views and permissions. A field crew member must not see the finance dashboard; the MD must not be able to accidentally approve an invoice. Getting this wrong is a security and data integrity risk. Must be enforced at both the API and UI layers.

---

## 5. Out of Scope for the PoC

- **Eliminating physical hospital rubber stamps** - The policy requiring ink stamps on service memos from certain hospitals is a regulatory/client constraint that cannot be solved by software. The PoC accommodates this via an image upload fallback (staff photograph and attach the stamp), but does not remove the requirement.
- **HR payroll and shift rostering** - Managing crew schedules, wages, and payroll calculations is a separate domain outside the financial operations-to-billing focus of this PoC.

---

## 6. Success Criteria

| Metric | Target |
|--------|--------|
| Reduction in manpower for routine AR/AP tasks | 30% - 50% |
| Improvement in financial workflow turnaround time | 40% - 60% |
| Repetitive clerical work handled by the system | 30% - 50% increase |
| Field charges captured without revenue leakage | 100% via mandatory digital memos |
