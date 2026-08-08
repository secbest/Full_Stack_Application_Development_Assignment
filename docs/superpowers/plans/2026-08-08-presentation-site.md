# Presentation Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone, animated static presentation site under `presentation/` that tells the EFAR problem-statement story and closes with a live-app showcase, runnable via its own isolated dev script without ever affecting `frontend/` (port 5173) or `backend/` (port 3000).

**Architecture:** A fully independent Vite + React app (its own `package.json`, `node_modules`, `vite.config.js`) with zero shared dependencies or network calls to the real backend. A fixed dev port (5175) with `strictPort: true` plus a `predev` port-check script (mirroring `backend/src/scripts/check-port-free.js`) guarantee it can never silently collide with or interfere with the live dev servers. Content is a single scrollable page assembled from ordered section components, all copy centralized in one data file, animated with Framer Motion (`motion`) scroll-triggered reveals, and one `recharts` bar chart for success metrics.

**Tech Stack:** Vite 5, React 18, `motion` (Framer Motion / motion.dev's React library), `recharts` (already used in `frontend/`), plain CSS (no Tailwind - this is a one-off narrative page, not the app UI).

## Global Constraints

- Dev server MUST run on a fixed port `5175` with `strictPort: true` in `presentation/vite.config.js` - never auto-increment, never reuse 5173 (frontend) or 3000 (backend).
- `presentation/` MUST be fully standalone: its own `package.json`/`node_modules`/lockfile, no imports from `frontend/` or `backend/`, no API calls, no `.env` file needed.
- All narrative copy (problem statement, solution table, stakeholders, success metrics) MUST be transcribed from `project-requirement.md` into `presentation/src/data/content.js` - no invented facts or numbers.
- The closing section MUST embed the real live app URL `https://full-stack-application-development-pi.vercel.app` in an iframe inside a browser-chrome mockup, plus a `target="_blank"` launch button to the same URL as a fallback/hand-off point.
- No unit tests required (per spec: this is a non-graded, non-assessed static site) - verification is `npm run build` succeeding plus manual dev-server checks described in each task.
- Use a hyphen (`-`) instead of an em dash in all copy, per `CLAUDE.md`'s writing style rule.

---

### Task 1: Scaffold the standalone presentation app with port isolation

**Files:**
- Create: `presentation/package.json`
- Create: `presentation/vite.config.js`
- Create: `presentation/index.html`
- Create: `presentation/src/scripts/check-port-free.js`
- Create: `presentation/src/main.jsx`
- Create: `presentation/src/App.jsx`
- Create: `presentation/src/index.css`
- Modify: `.gitignore` (repo root)

**Interfaces:**
- Produces: a running Vite dev server on `http://localhost:5175` rendering a placeholder `<App />`. All later tasks add sections inside `App.jsx`'s `<main>`.

- [ ] **Step 1: Create `presentation/package.json`**

```json
{
  "name": "efar-presentation",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "predev": "node src/scripts/check-port-free.js",
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "motion": "^11.15.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "recharts": "^3.9.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.3.4"
  }
}
```

- [ ] **Step 2: Create `presentation/vite.config.js`**

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    strictPort: true,
  },
})
```

- [ ] **Step 3: Create `presentation/src/scripts/check-port-free.js`**

This mirrors the existing pattern in `backend/src/scripts/check-port-free.js` (connect-as-client check, since binding a second listener on Windows can silently "succeed" even when the port is taken).

```js
// Runs automatically before `npm run dev` (see package.json's "predev"). If another
// presentation dev server is already listening on PORT, refuse to start a second one.
// Checks by connecting as a client rather than trying to bind a server: on Windows,
// binding a second listener to an already-used port can silently succeed even though
// the original owner is still there.
const net = require('net')

const PORT = 5175

const socket = net.connect({ port: PORT, host: '127.0.0.1' })
socket.setTimeout(1000)

socket.once('connect', () => {
  socket.destroy()
  console.error(`\n[predev] Port ${PORT} is already in use - a presentation dev server is probably already running in another terminal.`)
  console.error(`[predev] Switch to that terminal instead of starting another one, or stop it first (Ctrl+C) if it's stuck.\n`)
  process.exit(1)
})
socket.once('timeout', () => {
  socket.destroy()
  process.exit(0)
})
socket.once('error', () => {
  // ECONNREFUSED (or similar) - nothing is listening on this port.
  process.exit(0)
})
```

Note: `package.json` (Step 1) has no `"type": "module"` field, matching `frontend/`'s existing package.json - so this file runs as CommonJS (`require('net')` works) while `vite.config.js` still uses `import`/`export` syntax, since Vite pre-processes its own config file with esbuild regardless of the package's module type.

- [ ] **Step 4: Create `presentation/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EFAR - Digital Operations-to-Billing Platform</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `presentation/src/main.jsx`**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 6: Create a placeholder `presentation/src/App.jsx`**

```jsx
export default function App() {
  return (
    <main>
      <h1>EFAR Presentation</h1>
    </main>
  )
}
```

- [ ] **Step 7: Create a minimal `presentation/src/index.css`**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: #0b1220;
  color: #e2e8f0;
}
```

- [ ] **Step 8: Add presentation build artifacts to root `.gitignore`**

Add these two lines under the existing "Build output" section of `.gitignore`:

```
presentation/dist/
```

(`node_modules/` is already covered by the existing generic `node_modules/` pattern, so no change needed for that.)

- [ ] **Step 9: Install dependencies and verify the dev server starts in isolation**

Run:
```bash
cd presentation && npm install
```
Expected: installs without errors, creates `presentation/package-lock.json` and `presentation/node_modules/`.

Then, with `frontend/` and `backend/` dev servers left running (or stopped - either way), run:
```bash
cd presentation && npm run dev
```
Expected: console shows `predev` port check pass silently, then Vite prints `Local: http://localhost:5175/`. Visiting that URL shows "EFAR Presentation". Confirm with `netstat -ano | grep ":5173\|:3000\|:5175"` that all three ports can coexist independently (5173/3000 unaffected, 5175 now listening).

Stop the dev server (Ctrl+C) before moving on.

- [ ] **Step 10: Commit**

```bash
git add presentation/package.json presentation/package-lock.json presentation/vite.config.js presentation/index.html presentation/src/scripts/check-port-free.js presentation/src/main.jsx presentation/src/App.jsx presentation/src/index.css .gitignore
git commit -m "feat(presentation): scaffold standalone presentation app on isolated port 5175"
```

---

### Task 2: Transcribe problem-statement content into a single data file

**Files:**
- Create: `presentation/src/data/content.js`

**Interfaces:**
- Produces: a default-exported `content` object with keys `hero`, `problem`, `workflow`, `solution`, `stakeholders`, `successMetrics`, `liveApp` - consumed by every section component in Tasks 3-9.

- [ ] **Step 1: Create `presentation/src/data/content.js`**

```js
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
```

- [ ] **Step 2: Verify the file has no syntax errors**

Run:
```bash
cd presentation && node -e "require('esbuild')" 2>/dev/null; node --input-type=module -e "import('./src/data/content.js').then(m => console.log(Object.keys(m.default)))"
```
Expected output: `[ 'hero', 'problem', 'workflow', 'solution', 'stakeholders', 'successMetrics', 'liveApp' ]`

- [ ] **Step 3: Commit**

```bash
git add presentation/src/data/content.js
git commit -m "feat(presentation): add centralized problem-statement content data"
```

---

### Task 3: Design tokens and shared layout CSS

**Files:**
- Modify: `presentation/src/index.css`

**Interfaces:**
- Produces: CSS custom properties (`--bg`, `--panel`, `--accent`, etc.) and utility classes (`.section`, `.container`, `.card`, `.grid-2`, `.grid-4`) that every section component in Tasks 4-9 relies on.

- [ ] **Step 1: Replace `presentation/src/index.css` with full design tokens and layout utilities**

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #0b1220;
  --panel: #111827;
  --panel-border: #1e293b;
  --text: #e2e8f0;
  --text-muted: #94a3b8;
  --accent: #3b82f6;
  --success: #22c55e;
  --warning: #f59e0b;
  --danger: #ef4444;
  --radius: 12px;
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
}

.container {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 32px;
}

.section {
  padding: 96px 0;
}

.section-title {
  font-size: 32px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 16px;
}

.section-subtitle {
  font-size: 16px;
  color: var(--text-muted);
  max-width: 640px;
  margin-bottom: 48px;
}

.card {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius);
  padding: 24px;
}

.grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
}

.grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 24px;
}

@media (max-width: 900px) {
  .grid-2,
  .grid-3,
  .grid-4 {
    grid-template-columns: 1fr;
  }
}

.pill {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pill-accent {
  background: rgba(59, 130, 246, 0.15);
  color: var(--accent);
}

.pill-danger {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

.pill-success {
  background: rgba(34, 197, 94, 0.15);
  color: var(--success);
}

ul.bullet-list {
  list-style: none;
}

ul.bullet-list li {
  position: relative;
  padding-left: 20px;
  margin-bottom: 12px;
  color: var(--text-muted);
}

ul.bullet-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}
```

- [ ] **Step 2: Verify no build errors**

Run:
```bash
cd presentation && npm run build
```
Expected: `vite build` succeeds (placeholder `App.jsx` from Task 1 still renders fine with the new CSS loaded).

- [ ] **Step 3: Commit**

```bash
git add presentation/src/index.css
git commit -m "feat(presentation): add design tokens and shared layout CSS"
```

---

### Task 4: Hero section

**Files:**
- Create: `presentation/src/sections/Hero.jsx`
- Modify: `presentation/src/App.jsx`

**Interfaces:**
- Consumes: `content.hero` (`{ eyebrow, title, subtitle }`) from Task 2's `presentation/src/data/content.js`.
- Produces: default-exported `Hero` component, rendered first inside `App.jsx`'s `<main>`.

- [ ] **Step 1: Create `presentation/src/sections/Hero.jsx`**

```jsx
import { motion } from 'motion/react'
import content from '../data/content.js'

export default function Hero() {
  const { eyebrow, title, subtitle } = content.hero

  return (
    <section className="hero">
      <div className="container hero-inner">
        <motion.p
          className="pill pill-accent"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {eyebrow}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          {title}
        </motion.h1>
        <motion.p
          className="hero-subtitle"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          {subtitle}
        </motion.p>
        <motion.div
          className="hero-scroll-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          Scroll to explore ↓
        </motion.div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Append Hero-specific CSS to `presentation/src/index.css`**

```css
.hero {
  min-height: 100vh;
  display: flex;
  align-items: center;
  background: radial-gradient(circle at 20% 20%, rgba(59, 130, 246, 0.15), transparent 40%), var(--bg);
}

.hero-inner {
  max-width: 780px;
}

.hero h1 {
  font-size: 44px;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.2;
  margin: 20px 0;
}

.hero-subtitle {
  font-size: 18px;
  color: var(--text-muted);
  margin-bottom: 40px;
}

.hero-scroll-hint {
  font-size: 14px;
  color: var(--text-muted);
}
```

- [ ] **Step 3: Wire `Hero` into `presentation/src/App.jsx`**

```jsx
import Hero from './sections/Hero.jsx'

export default function App() {
  return (
    <main>
      <Hero />
    </main>
  )
}
```

- [ ] **Step 4: Verify in the browser**

Run:
```bash
cd presentation && npm run dev
```
Visit `http://localhost:5175`. Expected: full-height dark hero with the title/subtitle fading and sliding up on load, "Scroll to explore" hint visible. Stop the server after checking (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
git add presentation/src/sections/Hero.jsx presentation/src/App.jsx presentation/src/index.css
git commit -m "feat(presentation): add animated hero section"
```

---

### Task 5: Problem section

**Files:**
- Create: `presentation/src/sections/Problem.jsx`
- Modify: `presentation/src/App.jsx`

**Interfaces:**
- Consumes: `content.problem` (`{ title, who, what, barriers[], cause[], emotion, outcome[] }`).
- Produces: default-exported `Problem` component, rendered second in `App.jsx`.

- [ ] **Step 1: Create `presentation/src/sections/Problem.jsx`**

```jsx
import { motion } from 'motion/react'
import content from '../data/content.js'

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

function ProblemCard({ label, children, delay }) {
  return (
    <motion.div
      className="card"
      variants={cardVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay }}
    >
      <p className="pill pill-danger">{label}</p>
      <div className="problem-card-body">{children}</div>
    </motion.div>
  )
}

export default function Problem() {
  const { title, who, what, barriers, cause, emotion, outcome } = content.problem

  return (
    <section className="section" id="problem">
      <div className="container">
        <h2 className="section-title">The Problem</h2>
        <p className="section-subtitle">{title}</p>

        <div className="grid-2">
          <ProblemCard label="Who" delay={0}>
            <p>{who}</p>
          </ProblemCard>
          <ProblemCard label="What" delay={0.05}>
            <p>{what}</p>
          </ProblemCard>
          <ProblemCard label="Barriers" delay={0.1}>
            <ul className="bullet-list">
              {barriers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </ProblemCard>
          <ProblemCard label="Root Cause" delay={0.15}>
            <ul className="bullet-list">
              {cause.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </ProblemCard>
          <ProblemCard label="Emotion" delay={0.2}>
            <p>{emotion}</p>
          </ProblemCard>
          <ProblemCard label="Outcome" delay={0.25}>
            <ul className="bullet-list">
              {outcome.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </ProblemCard>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Append Problem-specific CSS to `presentation/src/index.css`**

```css
.problem-card-body p {
  color: var(--text-muted);
  margin-top: 12px;
}

.problem-card-body ul.bullet-list {
  margin-top: 12px;
}
```

- [ ] **Step 3: Wire `Problem` into `presentation/src/App.jsx`**

```jsx
import Hero from './sections/Hero.jsx'
import Problem from './sections/Problem.jsx'

export default function App() {
  return (
    <main>
      <Hero />
      <Problem />
    </main>
  )
}
```

- [ ] **Step 4: Verify in the browser**

Run `cd presentation && npm run dev`, visit `http://localhost:5175`, scroll to the Problem section. Expected: 6 cards (Who/What/Barriers/Root Cause/Emotion/Outcome) fade/slide up in a staggered sequence as they enter the viewport. Stop the server after checking.

- [ ] **Step 5: Commit**

```bash
git add presentation/src/sections/Problem.jsx presentation/src/App.jsx presentation/src/index.css
git commit -m "feat(presentation): add animated problem section"
```

---

### Task 6: Before/after workflow comparison section

**Files:**
- Create: `presentation/src/sections/WorkflowComparison.jsx`
- Modify: `presentation/src/App.jsx`

**Interfaces:**
- Consumes: `content.workflow` (`{ before: { title, steps[] }, after: { title, steps[] } }`).
- Produces: default-exported `WorkflowComparison` component, rendered third in `App.jsx`.

- [ ] **Step 1: Create `presentation/src/sections/WorkflowComparison.jsx`**

```jsx
import { motion } from 'motion/react'
import content from '../data/content.js'

function WorkflowColumn({ title, steps, direction, pillClass }) {
  return (
    <motion.div
      className="card workflow-column"
      initial={{ opacity: 0, x: direction === 'left' ? -40 : 40 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6 }}
    >
      <p className={`pill ${pillClass}`}>{title}</p>
      <ol className="workflow-steps">
        {steps.map((step, index) => (
          <li key={step}>
            <span className="workflow-step-number">{index + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </motion.div>
  )
}

export default function WorkflowComparison() {
  const { before, after } = content.workflow

  return (
    <section className="section" id="workflow">
      <div className="container">
        <h2 className="section-title">The Shift</h2>
        <p className="section-subtitle">
          From a manual, paper-based operation to a connected digital loop from intake to Xero.
        </p>
        <div className="grid-2">
          <WorkflowColumn title={before.title} steps={before.steps} direction="left" pillClass="pill-danger" />
          <WorkflowColumn title={after.title} steps={after.steps} direction="right" pillClass="pill-success" />
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Append workflow-specific CSS to `presentation/src/index.css`**

```css
.workflow-column {
  display: flex;
  flex-direction: column;
}

.workflow-steps {
  list-style: none;
  margin-top: 20px;
}

.workflow-steps li {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  color: var(--text-muted);
}

.workflow-step-number {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--panel-border);
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 3: Wire `WorkflowComparison` into `presentation/src/App.jsx`**

```jsx
import Hero from './sections/Hero.jsx'
import Problem from './sections/Problem.jsx'
import WorkflowComparison from './sections/WorkflowComparison.jsx'

export default function App() {
  return (
    <main>
      <Hero />
      <Problem />
      <WorkflowComparison />
    </main>
  )
}
```

- [ ] **Step 4: Verify in the browser**

Run `cd presentation && npm run dev`, scroll to the "The Shift" section. Expected: left column ("Before") slides in from the left, right column ("After") slides in from the right, each numbered step list visible. Stop the server after checking.

- [ ] **Step 5: Commit**

```bash
git add presentation/src/sections/WorkflowComparison.jsx presentation/src/App.jsx presentation/src/index.css
git commit -m "feat(presentation): add before/after workflow comparison section"
```

---

### Task 7: Solution value-proposition section

**Files:**
- Create: `presentation/src/sections/Solution.jsx`
- Modify: `presentation/src/App.jsx`

**Interfaces:**
- Consumes: `content.solution` (array of `{ capability, impact }`).
- Produces: default-exported `Solution` component, rendered fourth in `App.jsx`.

- [ ] **Step 1: Create `presentation/src/sections/Solution.jsx`**

```jsx
import { motion } from 'motion/react'
import content from '../data/content.js'

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

export default function Solution() {
  return (
    <section className="section" id="solution">
      <div className="container">
        <h2 className="section-title">The Solution</h2>
        <p className="section-subtitle">
          A custom full-stack digital operations-to-billing system that automates pre-accounting workflows,
          standardizes intake, and replaces manual data transcription.
        </p>
        <div className="grid-2">
          {content.solution.map((item, index) => (
            <motion.div
              key={item.capability}
              className="card"
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <p className="pill pill-accent">{item.capability}</p>
              <p className="solution-impact">{item.impact}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Append solution-specific CSS to `presentation/src/index.css`**

```css
.solution-impact {
  color: var(--text-muted);
  margin-top: 16px;
}
```

- [ ] **Step 3: Wire `Solution` into `presentation/src/App.jsx`**

```jsx
import Hero from './sections/Hero.jsx'
import Problem from './sections/Problem.jsx'
import WorkflowComparison from './sections/WorkflowComparison.jsx'
import Solution from './sections/Solution.jsx'

export default function App() {
  return (
    <main>
      <Hero />
      <Problem />
      <WorkflowComparison />
      <Solution />
    </main>
  )
}
```

- [ ] **Step 4: Verify in the browser**

Run `cd presentation && npm run dev`, scroll to "The Solution". Expected: 4 cards (Unified Digital Intake Portal, Mobile Digital Field Logger, Automated Booking & Pricing Matching, Intelligent Document Ingestion) staggering in. Stop the server after checking.

- [ ] **Step 5: Commit**

```bash
git add presentation/src/sections/Solution.jsx presentation/src/App.jsx presentation/src/index.css
git commit -m "feat(presentation): add solution value-proposition section"
```

---

### Task 8: Stakeholder roles section

**Files:**
- Create: `presentation/src/sections/StakeholderRoles.jsx`
- Modify: `presentation/src/App.jsx`

**Interfaces:**
- Consumes: `content.stakeholders` (array of `{ role, responsibility }`).
- Produces: default-exported `StakeholderRoles` component, rendered fifth in `App.jsx`.

- [ ] **Step 1: Create `presentation/src/sections/StakeholderRoles.jsx`**

```jsx
import { motion } from 'motion/react'
import content from '../data/content.js'

const cardVariants = {
  hidden: { opacity: 0, scale: 0.92, y: 16 },
  visible: { opacity: 1, scale: 1, y: 0 },
}

export default function StakeholderRoles() {
  return (
    <section className="section" id="stakeholders">
      <div className="container">
        <h2 className="section-title">Who It's For</h2>
        <p className="section-subtitle">Four roles, one connected operations loop.</p>
        <div className="grid-4">
          {content.stakeholders.map((person, index) => (
            <motion.div
              key={person.role}
              className="card stakeholder-card"
              variants={cardVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.45, delay: index * 0.1 }}
            >
              <h3>{person.role}</h3>
              <p>{person.responsibility}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Append stakeholder-specific CSS to `presentation/src/index.css`**

```css
.stakeholder-card h3 {
  font-size: 16px;
  color: #ffffff;
  margin-bottom: 12px;
}

.stakeholder-card p {
  font-size: 14px;
  color: var(--text-muted);
}
```

- [ ] **Step 3: Wire `StakeholderRoles` into `presentation/src/App.jsx`**

```jsx
import Hero from './sections/Hero.jsx'
import Problem from './sections/Problem.jsx'
import WorkflowComparison from './sections/WorkflowComparison.jsx'
import Solution from './sections/Solution.jsx'
import StakeholderRoles from './sections/StakeholderRoles.jsx'

export default function App() {
  return (
    <main>
      <Hero />
      <Problem />
      <WorkflowComparison />
      <Solution />
      <StakeholderRoles />
    </main>
  )
}
```

- [ ] **Step 4: Verify in the browser**

Run `cd presentation && npm run dev`, scroll to "Who It's For". Expected: 4 cards (Managing Director, AR, AP, Quotations Specialist) scaling/fading in with a stagger. On a narrow window, the grid collapses to 1 column (per the `.grid-4` media query in Task 3). Stop the server after checking.

- [ ] **Step 5: Commit**

```bash
git add presentation/src/sections/StakeholderRoles.jsx presentation/src/App.jsx presentation/src/index.css
git commit -m "feat(presentation): add stakeholder roles section"
```

---

### Task 9: Success metrics chart section

**Files:**
- Create: `presentation/src/sections/SuccessMetrics.jsx`
- Modify: `presentation/src/App.jsx`

**Interfaces:**
- Consumes: `content.successMetrics` (array of `{ metric, rangeLabel, chartValue }`).
- Produces: default-exported `SuccessMetrics` component, rendered sixth in `App.jsx`.

- [ ] **Step 1: Create `presentation/src/sections/SuccessMetrics.jsx`**

```jsx
import { motion } from 'motion/react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import content from '../data/content.js'

const BAR_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#ef4444']

function ChartTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const point = payload[0].payload
  return (
    <div className="chart-tooltip">
      <p>{point.metric}</p>
      <p className="chart-tooltip-value">{point.rangeLabel}</p>
    </div>
  )
}

export default function SuccessMetrics() {
  const data = content.successMetrics

  return (
    <section className="section" id="success-metrics">
      <div className="container">
        <h2 className="section-title">Success Criteria</h2>
        <p className="section-subtitle">Target outcomes for the proof of concept.</p>

        <motion.div
          className="card chart-card"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={data} layout="vertical" margin={{ left: 24, right: 24 }}>
              <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" tickFormatter={(v) => `${v}%`} />
              <YAxis
                type="category"
                dataKey="metric"
                width={260}
                stroke="#94a3b8"
                tick={{ fontSize: 12 }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="chartValue" radius={[0, 6, 6, 0]}>
                {data.map((entry, index) => (
                  <Cell key={entry.metric} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <div className="grid-4 metrics-legend">
          {data.map((item, index) => (
            <motion.div
              key={item.metric}
              className="card"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: index * 0.08 }}
            >
              <p className="metric-range" style={{ color: BAR_COLORS[index % BAR_COLORS.length] }}>
                {item.rangeLabel}
              </p>
              <p className="metric-label">{item.metric}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Append chart-specific CSS to `presentation/src/index.css`**

```css
.chart-card {
  margin-bottom: 24px;
}

.chart-tooltip {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  padding: 8px 12px;
  max-width: 240px;
}

.chart-tooltip p {
  font-size: 12px;
  color: var(--text-muted);
}

.chart-tooltip-value {
  color: #ffffff;
  font-weight: 700;
  margin-top: 4px;
}

.metric-range {
  font-size: 24px;
  font-weight: 800;
  margin-bottom: 8px;
}

.metric-label {
  font-size: 13px;
  color: var(--text-muted);
}
```

- [ ] **Step 3: Wire `SuccessMetrics` into `presentation/src/App.jsx`**

```jsx
import Hero from './sections/Hero.jsx'
import Problem from './sections/Problem.jsx'
import WorkflowComparison from './sections/WorkflowComparison.jsx'
import Solution from './sections/Solution.jsx'
import StakeholderRoles from './sections/StakeholderRoles.jsx'
import SuccessMetrics from './sections/SuccessMetrics.jsx'

export default function App() {
  return (
    <main>
      <Hero />
      <Problem />
      <WorkflowComparison />
      <Solution />
      <StakeholderRoles />
      <SuccessMetrics />
    </main>
  )
}
```

- [ ] **Step 4: Verify in the browser**

Run `cd presentation && npm run dev`, scroll to "Success Criteria". Expected: horizontal bar chart with 4 colored bars, hovering shows a tooltip with the metric name and range, 4 legend cards below showing the range label and metric text. Stop the server after checking.

- [ ] **Step 5: Commit**

```bash
git add presentation/src/sections/SuccessMetrics.jsx presentation/src/App.jsx presentation/src/index.css
git commit -m "feat(presentation): add success metrics chart section"
```

---

### Task 10: Closing live-app showcase section

**Files:**
- Create: `presentation/src/sections/LiveAppCTA.jsx`
- Modify: `presentation/src/App.jsx`

**Interfaces:**
- Consumes: `content.liveApp` (`{ url, buttonLabel }`).
- Produces: default-exported `LiveAppCTA` component, rendered last in `App.jsx`.

- [ ] **Step 1: Create `presentation/src/sections/LiveAppCTA.jsx`**

```jsx
import { motion } from 'motion/react'
import content from '../data/content.js'

export default function LiveAppCTA() {
  const { url, buttonLabel } = content.liveApp

  return (
    <section className="section" id="live-app">
      <div className="container live-app-inner">
        <h2 className="section-title">See It Live</h2>
        <p className="section-subtitle">The platform, running end to end.</p>

        <motion.div
          className="browser-chrome"
          initial={{ opacity: 0, scale: 0.94, y: 24 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7 }}
        >
          <div className="browser-chrome-bar">
            <span className="browser-dot" style={{ background: '#ef4444' }} />
            <span className="browser-dot" style={{ background: '#f59e0b' }} />
            <span className="browser-dot" style={{ background: '#22c55e' }} />
            <span className="browser-address">{url}</span>
          </div>
          <iframe
            className="browser-chrome-frame"
            src={url}
            title="EFAR live application preview"
            loading="lazy"
          />
        </motion.div>

        <motion.a
          className="launch-button"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          {buttonLabel} →
        </motion.a>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Append live-app-specific CSS to `presentation/src/index.css`**

```css
.live-app-inner {
  text-align: center;
}

.browser-chrome {
  background: #1e293b;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--panel-border);
  text-align: left;
}

.browser-chrome-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #0f172a;
}

.browser-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.browser-address {
  margin-left: 12px;
  font-size: 13px;
  color: var(--text-muted);
  background: #1e293b;
  padding: 4px 12px;
  border-radius: 6px;
  flex: 1;
}

.browser-chrome-frame {
  width: 100%;
  height: 480px;
  border: none;
  background: #f8fafc;
}

.launch-button {
  display: inline-block;
  margin-top: 32px;
  padding: 16px 32px;
  background: var(--accent);
  color: #ffffff;
  font-weight: 700;
  text-decoration: none;
  border-radius: 8px;
  font-size: 16px;
}
```

- [ ] **Step 3: Wire `LiveAppCTA` into `presentation/src/App.jsx` (final assembly)**

```jsx
import Hero from './sections/Hero.jsx'
import Problem from './sections/Problem.jsx'
import WorkflowComparison from './sections/WorkflowComparison.jsx'
import Solution from './sections/Solution.jsx'
import StakeholderRoles from './sections/StakeholderRoles.jsx'
import SuccessMetrics from './sections/SuccessMetrics.jsx'
import LiveAppCTA from './sections/LiveAppCTA.jsx'

export default function App() {
  return (
    <main>
      <Hero />
      <Problem />
      <WorkflowComparison />
      <Solution />
      <StakeholderRoles />
      <SuccessMetrics />
      <LiveAppCTA />
    </main>
  )
}
```

- [ ] **Step 4: Verify the iframe actually loads the live site**

Run `cd presentation && npm run dev`, scroll to "See It Live". Expected: browser-chrome mockup scales/fades in, the iframe inside it shows the real EFAR login page (confirms `full-stack-application-development-pi.vercel.app` sends no `X-Frame-Options`/frame-blocking headers). Click "Launch EFAR Platform" and confirm it opens the live site in a new tab. If the iframe shows blank/refused-to-connect instead, note it and keep the launch button as the working fallback per the spec - do not treat it as a task failure requiring a workaround, since the fallback is by design.

- [ ] **Step 5: Full-page smoke test and production build**

Run:
```bash
cd presentation && npm run build
```
Expected: build succeeds with no errors.

Run:
```bash
cd presentation && npm run preview
```
Visit the printed local preview URL and scroll through the entire page top to bottom. Expected: all 7 sections render in order (Hero, Problem, Workflow, Solution, Stakeholders, Success Metrics, Live App), animations trigger once per section on first scroll into view, no console errors. Stop the preview server after checking.

- [ ] **Step 6: Confirm dev-server isolation one more time end-to-end**

With `presentation` dev server running (`npm run dev` in `presentation/`), separately start (or confirm already running) `frontend`'s `npm run dev` (port 5173) and `backend`'s `npm run dev` (port 3000) per `CLAUDE.md`'s existing backend port-check rules. Run `netstat -ano | grep "LISTENING"` and confirm ports 3000, 5173, and 5175 are all listening independently with no port conflicts or crashed processes. Stop all dev servers you started for this check.

- [ ] **Step 7: Commit**

```bash
git add presentation/src/sections/LiveAppCTA.jsx presentation/src/App.jsx presentation/src/index.css
git commit -m "feat(presentation): add closing live-app showcase section"
```

---

## Post-Plan Notes

- The `presentation/` app is local-only (no Vercel project, no deploy pipeline) per the approved spec - a future task can add deployment if wanted later.
- If the live-app iframe ever gets blocked by a future header change on the Vercel project, no code change is needed here - the launch button already carries the hand-off.
