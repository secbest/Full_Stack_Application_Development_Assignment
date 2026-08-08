const content = {
  hero: {
    eyebrow: 'EFAR Digital Operations-to-Billing Platform',
    title: 'Standardizing Financial Operations & Workflow Automation through Lean Digital Processes',
    subtitle:
      'A full-stack proof of concept for Emergencies First Aid & Rescue (EFAR) - replacing manual transcription with a connected digital operations loop, from intake to Xero.',
  },

  problem: {
    title: 'Over-Reliance on Manpower for Financial Operations Despite Existing Systems',
    who: 'Managing Director (Doris Ching), Accounts Receivable (AR) Specialist (Sarah), Accounts Payable (AP) Specialist (Chloe), and Quotations Specialist (Camilla) at EFAR.',
    what: 'EFAR struggles with an unsustainable over-reliance on manpower for financial operations despite having enterprise accounting software (Xero). Manual intervention is excessively high for quotation management, matching bank statements to invoices, and processing ad-hoc expenses. The volume of manual transcription creates significant operational drag and increases the risk of unrecorded field charges and revenue leakage.',
    barriers: [
      'Unstructured customer queries across WhatsApp, email, and calls creating 5-day clarification delays.',
      'Handwritten paper service memos causing severe billing bottlenecks and lost paperwork.',
      'Inconsistent hospital standards requiring physical, ink-based stamps on service memos.',
      'Duplication of effort due to AR and AP functions being handled separately.',
    ],
    cause: [
      'Underutilization of Xero, treating it as a passive digital filing cabinet rather than leveraging its active automation features.',
      'Processes designed around manual human support rather than lean digital operations.',
      'Absence of an integrated digital operations loop connecting field ambulance crews directly to the finance team.',
      'Crucial business knowledge (client rules, debt statuses) trapped in staff "mental notes" or personal email threads.',
    ],
    emotion:
      'The management feels highly anxious over staff turnover disrupting financial backlogs and causing critical data loss, while the finance staff feel overwhelmed by matching fatigue and the frustration of acting as "human copy-paste machines".',
    outcome: [
      'Inflated operational costs requiring 2-3 personnel locked into routine, manual financial tasks.',
      'Severe revenue leakage from unrecorded field surcharges (e.g., multi-floor evacuations, crew overtime) left off late paper slips.',
      'Artificial caps on company scalability because processing invoices one-by-one requires hiring more staff as the fleet grows.',
    ],
  },

  workflow: {
    before: {
      title: 'Before: Manual & Paper-Based',
      steps: [
        'Customer queries scattered across WhatsApp, email, and calls - 5-day clarification delays.',
        'Field crews fill handwritten paper service memos.',
        'Physical ink stamps required from hospitals for verification.',
        'AR and AP teams separately re-key the same job data by hand.',
        'Overtime and evacuation charges routinely missed on late paper slips.',
      ],
    },
    after: {
      title: 'After: Digital Operations Loop',
      steps: [
        'Unified digital intake portal captures every mandatory field upfront.',
        'Mobile digital field logger captures job details, overtime, and evacuation charges instantly.',
        'Automated pricing engine matches field memos against client-specific contracts.',
        'Draft invoices sync automatically to Xero for AR review.',
        'AP invoices are OCR-extracted and rebate-verified without hand-keying.',
      ],
    },
  },

  solution: [
    {
      capability: 'Unified Digital Intake Portal',
      impact: 'Eliminate 5-day communication loops; ensure all mandatory event parameters are collected upfront.',
    },
    {
      capability: 'Mobile Digital Field Logger',
      impact: 'Stop revenue leakage by mandatorily capturing overtime and evacuation charges instantly upon job completion.',
    },
    {
      capability: 'Automated Booking & Pricing Matching',
      impact: 'Reduce AR workload; instantly cross-reference field memos against client-specific pricing tables.',
    },
    {
      capability: 'Intelligent Document Ingestion (OCR)',
      impact: 'Eliminate AP hand-keying; auto-extract vendor bills and verify corporate 1% rebates automatically.',
    },
  ],

  stakeholders: [
    { role: 'Managing Director', responsibility: 'Executive oversight, margin protection, and macro expense analytics.' },
    { role: 'Accounts Receivable (AR)', responsibility: 'Validates automated booking matches, adjusts surcharges, and syncs batches to Xero.' },
    { role: 'Accounts Payable (AP)', responsibility: 'Reviews AI-extracted vendor invoices and reconciles statement feeds.' },
    { role: 'Quotations Specialist', responsibility: 'Manages the structured intake queue and verifies service tiers.' },
  ],

  successMetrics: [
    { metric: 'Reduction in manpower required for routine AR/AP tasks', rangeLabel: '30% - 50%', chartValue: 40 },
    { metric: 'Improvement in turnaround time for financial workflows', rangeLabel: '40% - 60%', chartValue: 50 },
    { metric: 'Transition of repetitive clerical workload to an automated system', rangeLabel: '30% - 50% increase', chartValue: 40 },
    { metric: 'Prevention of revenue leakage (unrecorded overtime/evacuations)', rangeLabel: '100% captured', chartValue: 100 },
  ],

  liveApp: {
    url: 'https://full-stack-application-development-pi.vercel.app',
    buttonLabel: 'Launch EFAR Platform',
  },
}

export default content
