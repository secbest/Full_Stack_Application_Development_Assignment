# AI Workflow Logs - Tow Kwan Hwa (Kwan Hua)

Session-by-session record of AI usage on the EFAR Digital Operations-to-Billing Platform.
Each log records the phase, the prompts I gave, what the AI produced, and whether I accepted,
edited, or rejected it.

**Feature ownership:** Wave 1B (Xero connect, vendor invoice upload, Cloudinary, Gemini OCR),
Wave 2B (pricing contracts), Wave 3 (AR billing/pricing engine, AP invoice sync, Xero integration).

| Date | Log | Phase | Main outcome |
|---|---|---|---|
| 2026-06-19 | `handoff-2026-06-19.md` | Design | Early handoff record |
| 2026-07-02 | `Tow Kwan Hwa_2026-07-02-git-history-doc-sync.md` | Documentation | Git history and doc sync |
| 2026-07-03 | `Tow Kwan Hwa_2026-07-03-wave-1b-xero-api.md` | Design, coding, code review | Wave 1B endpoints built; 8-angle code review run, fixes deliberately deferred |
| 2026-07-08 | `Tow Kwan Hwa_2026-07-08-wave-1b-merge-and-wave-3-takeover.md` | Integration, scoping | Wave 1B merged; took over all of Wave 3; real Xero API implementation |
| 2026-07-09 | `Tow Kwan Hwa_2026-07-09-wave-3-merge-and-test-coverage.md` | Debugging, testing, integration | `contract_id NOT NULL` fix; Wave 3 merged; controller test coverage |
| 2026-07-11 | `Tow Kwan Hwa_2026-07-11-hotfix-wave-3-and-qa-suite.md` | Debugging, testing | Unmatched-invoice adjustment fix; `predev` port guard; QA test-case doc + REST Client suite |
| 2026-07-12 | `Tow Kwan Hwa_2026-07-12-interim-review-prep.md` | Gap analysis, coding, tooling | Public intake form built; `db:setup` one-command seeding |
| 2026-07-15 | `Tow Kwan Hwa_2026-07-15-sidebar-and-font-scaling.md` | Frontend coding | Collapsible sidebar, two-line nav, responsive font scale |
| 2026-07-16 | `Tow Kwan Hwa_2026-07-16-ui-polish-and-demo-reset.md` | Frontend coding, tooling | Stepper amount inputs with realistic caps; `db:reset` master demo script |
| 2026-08-04 | `Tow Kwan Hwa_2026-08-04-client-feedback-and-xero-scopes.md` | Requirements triage, coding | Client feedback assigned in README; nine Wave 3 fixes; Xero granular OAuth scopes |
| 2026-08-05 | `Tow Kwan Hwa_2026-08-05-money-defects-and-revenue-leakage.md` | Code review, coding, debugging | AP/Xero money + idempotency defects fixed; Revenue Leakage report built |
| 2026-08-07 | `Tow Kwan Hwa_2026-08-07-ap-workflow.md` | Coding, testing, live config | AP recovery, Gmail intake, OCR GST recovery, Xero currency diagnosis *(Codex)* |
| 2026-08-08 | `Tow Kwan Hwa_2026-08-08-ar-pricing-and-client-identity.md` | Coding, testing, docs | Published-rate surcharge pricing; client identity by organisation; 58 new AR tests |

Unless noted otherwise the tool was **Claude Code**; the 2026-08-07 session used **Codex**.

Session handoff documents for the same work are one level up in `my-project-ai/Tow_Kwan_Hwa/`.

The written reflection (`ai-reflection.md`) is deliberately not in this folder and is not AI-assisted -
`submission-guide.md` requires it to be written entirely in my own words.
