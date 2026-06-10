# Project Requirements
## Standardizing Financial Operations & Workflow Automation through Lean Digital Processes
**Emergencies First Aid & Rescue (EFAR) - Full-Stack Digital Platform**
*Document Date: June 2026*

---

## 1. Problem Statement

**Title:** Over-Reliance on Manpower for Financial Operations Despite Existing Systems

### Who
Managing Director (Doris Ching), Accounts Receivable (AR) Specialist (Sarah), Accounts Payable (AP) Specialist (Chloe), and Quotations Specialist (Camilla) at EFAR.

### What
EFAR struggles with an unsustainable over-reliance on manpower for financial operations despite having enterprise accounting software (Xero). Manual intervention is excessively high for quotation management, matching bank statements to invoices, and processing ad-hoc expenses. The volume of manual transcription creates significant operational drag and increases the risk of unrecorded field charges and revenue leakage.

### Barriers
- Unstructured customer queries across WhatsApp, email, and calls creating 5-day clarification delays.
- Handwritten paper service memos causing severe billing bottlenecks and lost paperwork.
- Inconsistent hospital standards requiring physical, ink-based stamps on service memos.
- Duplication of effort due to AR and AP functions being handled separately.

### Cause
- Underutilization of Xero, treating it as a passive digital filing cabinet rather than leveraging its active automation features.
- Processes designed around manual human support rather than lean digital operations.
- Absence of an integrated digital operations loop connecting field ambulance crews directly to the finance team.
- Crucial business knowledge (client rules, debt statuses) trapped in staff "mental notes" or personal email threads.

### Emotion
The management feels highly anxious over staff turnover disrupting financial backlogs and causing critical data loss, while the finance staff feel overwhelmed by matching fatigue and the frustration of acting as "human copy-paste machines".

### Outcome of Problem
- Inflated operational costs requiring 2-3 personnel locked into routine, manual financial tasks.
- Severe revenue leakage from unrecorded field surcharges (e.g., multi-floor evacuations, crew overtime) left off late paper slips.
- Artificial caps on company scalability because processing invoices one-by-one requires hiring more staff as the fleet grows.

---

## 2. Proposed Solution & Value Proposition

### AI Value Proposition
A custom full-stack digital operations-to-billing system that automates pre-accounting workflows, standardizes intake, and replaces manual data transcription.

| Capability | Expected Impact |
|---|---|
| Unified Digital Intake Portal | Eliminate 5-day communication loops; ensure all mandatory event parameters are collected upfront. |
| Mobile Digital Field Logger | Stop revenue leakage by mandatorily capturing overtime and evacuation charges instantly upon job completion. |
| Automated Booking & Pricing Matching | Reduce AR workload; instantly cross-reference field memos against client-specific pricing tables. |
| Intelligent Document Ingestion (OCR) | Eliminate AP hand-keying; auto-extract vendor bills and verify corporate 1% rebates automatically. |

### Key Research Question
Can an automated digital operations-to-billing ecosystem completely eliminate manual transcription gaps and prevent field-level revenue leakage while synchronizing seamlessly with existing accounting software like Xero?

---

## 3. Scope - Proof of Concept (PoC)

### In Scope
- Standardized web-based intake menu for customer queries.
- Digital service memos for field crews (with digital signature fallback).
- Automated pricing logic matrix for different client contracts.
- Executive command center for real-time fleet and overhead visibility.
- Integration with Xero for automated syncing of draft invoices and bank feeds.

### Out of Scope (for PoC)
- Eradicating physical hospital rubber stamps entirely (policy exception handling via image upload remains).
- Full HR payroll and shift rostering management.

---

## 4. System Integration Requirements

The PoC will need to interface with the following existing company systems:

| System | Role in PoC |
|---|---|
| Xero Accounting Software | Master financial ledger; handles final invoice generation, bank feed ingestion, and general ledger mapping. |
| PostgreSQL Database | Primary relational data store for operational bookings, user roles, pricing contracts, and field memos. |
| OCR/Vision Integration | Parses incoming ad-hoc vendor PDF invoices (diesel, repairs) to structure data for AP reconciliation. |

### Data Requirements
- This project will require access to company data, including hospital contract pricing tiers, past service order formats, and active vendor rebate structures.
- Secure environments (`.env`) must be utilized to protect API keys and sensitive financial routing logic.

---

## 5. Success Criteria

| Metric | Target |
|---|---|
| Reduction in manpower required for routine AR/AP tasks | 30% - 50% |
| Improvement in turnaround time for financial workflows | 40% - 60% |
| Transition of repetitive clerical workload to an automated system | 30% - 50% increase in system handling |
| Prevention of revenue leakage (unrecorded overtime/evacuations) | 100% captured via digital memos |

---

## 6. Stakeholders

| Role | Responsibility |
|---|---|
| Managing Director | Executive oversight, margin protection, and macro expense analytics. |
| Accounts Receivable (AR) | Validates automated booking matches, adjusts surcharges, and syncs batches to Xero. |
| Accounts Payable (AP) | Reviews AI-extracted vendor invoices and reconciles statement feeds. |
| Quotations Specialist | Manages the structured intake queue and verifies service tiers. |

This document is intended as a living requirements reference for the EFAR Digital Operations-to-Billing PoC. It should be reviewed and updated as the project progresses through discovery and build phases.
