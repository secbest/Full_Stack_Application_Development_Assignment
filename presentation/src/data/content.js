const content = {
  hero: {
    eyebrow: 'EFAR Digital Operations-to-Billing Platform',
    title: 'From Intake to Xero, Automatically',
    subtitle:
      'A digital operations loop for Emergencies First Aid & Rescue (EFAR) - cutting manual workload across the entire billing process.',
  },

  problem: {
    title: 'Over-Reliance on Manpower for Financial Operations',
    who: 'Managing Director, AR Specialist, AP Specialist, and Quotations Specialist at EFAR.',
    what: 'Manual data entry everywhere - even with Xero already in place.',
    barriers: [
      'WhatsApp/email/call chaos - 5-day delays',
      'Handwritten paper memos, lost paperwork',
      'Ink stamps required from hospitals',
      'AR and AP duplicate the same work',
    ],
    cause: [
      'Xero used as a filing cabinet, not automated',
      'Processes built for manual support',
      'No digital link from field crew to finance',
      'Client rules trapped in staff\'s heads',
    ],
    emotion:
      'Management fears data loss from staff turnover; finance staff feel like "human copy-paste machines".',
    outcome: [
      '2-3 staff locked into manual tasks',
      'Revenue leaks from missed overtime/evacuations',
      'Growth capped - more bookings need more staff',
    ],
  },

  workflow: {
    before: {
      title: 'Before: Manual & Paper-Based',
      steps: [
        'Queries scattered across WhatsApp, email, calls',
        'Paper service memos, filled by hand',
        'Physical ink stamps from hospitals',
        'AR and AP re-key the same data',
        'Overtime and evacuation charges missed',
      ],
    },
    after: {
      title: 'After: Digital Operations Loop',
      steps: [
        'One digital intake portal, every field upfront',
        'Mobile field logger captures charges instantly',
        'Pricing engine auto-matches contracts',
        'Draft invoices sync straight to Xero',
        'Vendor bills OCR-extracted, rebate-verified',
      ],
    },
  },

  solution: [
    {
      capability: 'Unified Digital Intake Portal',
      impact: 'No more 5-day back-and-forth - everything captured upfront.',
    },
    {
      capability: 'Mobile Digital Field Logger',
      impact: 'Overtime and evacuation charges captured the moment the job ends.',
    },
    {
      capability: 'Automated Booking & Pricing Matching',
      impact: 'Field memos auto-matched to client pricing - no manual lookup.',
    },
    {
      capability: 'Intelligent Document Ingestion (OCR)',
      impact: 'Vendor bills auto-extracted, rebates auto-verified.',
    },
  ],

  stakeholders: [
    { role: 'Customer', responsibility: 'Submits job requests through the digital intake portal - no more WhatsApp/email/call back-and-forth.' },
    { role: 'Field Crew', responsibility: 'Logs job details, overtime, and evacuation charges on-site via the mobile field logger - the moment the job happens, not on a late paper slip.' },
    { role: 'Managing Director', responsibility: 'Executive oversight and margin protection.' },
    { role: 'Accounts Receivable (AR)', responsibility: 'Validates booking matches and syncs invoices to Xero.' },
    { role: 'Accounts Payable (AP)', responsibility: 'Reviews vendor invoices and reconciles statements.' },
    { role: 'Quotations Specialist', responsibility: 'Manages the intake queue and service tiers.' },
  ],

  successMetrics: [
    { metric: 'Less manpower on routine AR/AP tasks', rangeLabel: '30% - 50%', chartValue: 40 },
    { metric: 'Faster financial workflow turnaround', rangeLabel: '40% - 60%', chartValue: 50 },
    { metric: 'Clerical work shifted to automation', rangeLabel: '30% - 50% increase', chartValue: 40 },
    { metric: 'Revenue leakage prevented', rangeLabel: '100% captured', chartValue: 100 },
  ],

  liveApp: {
    url: 'https://full-stack-application-development-pi.vercel.app',
    buttonLabel: 'Launch EFAR Platform',
  },
}

export default content
