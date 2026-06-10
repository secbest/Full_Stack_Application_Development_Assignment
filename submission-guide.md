# Assignment Submission Guide
Full Stack Application Development · Folder Structure & File Requirements

---

## Project Root Structure

```
your-project/                          # submit as a zipped Git repository
│
├── design/                            # design documentation
│   ├── problem-statement.md           # Group - project problem statement
│   ├── architecture.md                # Group - system architecture
│   ├── architecture-diagram.md        # Group - system diagram (Mermaid)
│   ├── architecture-diagram.png       # Group - system diagram (PNG)
│   ├── er-diagram.md                  # Group - full ER diagram (Mermaid)
│   ├── er-diagram.png                 # Group - full ER diagram (PNG)
│   └── <student-name>/                # One folder per student
│       ├── use-cases.md               # Individual
│       ├── api-documentation.md       # Individual
│       └── database-schema.md         # Individual
│
├── frontend/                          # React application
│   ├── src/                           # structure left to student design
│   ├── tests/                         # Frontend unit tests
│   │   └── <student-name>/            # One folder per student
│   │       ├── test-cases.md          # List of all test cases
│   │       └── *.test.js              # Individual unit test files
│   ├── package.json
│   └── .env.example
│
├── backend/                           # Node / Express API
│   ├── src/                           # structure left to student design
│   ├── tests/                         # Backend unit tests
│   │   └── <student-name>/            # One folder per student
│   │       ├── test-cases.md          # List of all test cases
│   │       └── *.test.js              # Individual unit test files
│   ├── package.json
│   └── .env.example
│
├── .gitignore                         # never commit .env
├── .git/                              # Git history - submit with the project
├── deployment.md                      # Group - cloud services with public URLs
└── README.md                          # Group - solution, task allocation, setup


your-project-ai/                       # individual submission - each student submits their own
│
└── <student-name>/                    # One folder per student
    ├── ai-logs/                       # Individual - workflow logs
    │   └── *.jsonl                    # Claude Code log files
    └── ai-reflection.md               # Individual - written reflection
```

---

## Section A - Technical Build

### System Design & Architecture

| File | Scope | Description |
|------|-------|-------------|
| `design/problem-statement.md` | Group | Describe the problem the project is solving - the client's need, target users, and what success looks like. This is the starting point that all design decisions should trace back to. |
| `design/architecture.md` | Group | Document the system architecture covering: (1) the detailed folder structure for `frontend/src` and `backend/src` - designed by the team, explaining what each folder contains and its purpose, (2) any third-party services used (e.g. Map API), (3) any Generative AI services integrated into the app (e.g. Gemini AI), and (4) the cloud services used for deployment - frontend, backend, database, and file storage. |
| `design/architecture-diagram.md` and `design/architecture-diagram.png` | Group | A visual diagram showing the full system - component interactions and the cloud services used. Submit both: the `.md` file with the Mermaid source, and the `.png` exported from it. Reference the diagram from architecture.md. |
| `design/er-diagram.md` and `design/er-diagram.png` | Group | A single ER diagram covering all entities and relationships across the full system. Submit both: the `.md` file with the Mermaid source, and the `.png` exported from it. This is a shared artefact agreed and maintained by the whole team. |
| `design/<student-name>/use-cases.md` | Individual | Define use cases for the features you are responsible for. Each use case should name the actor, trigger, main flow, and any edge-case or alternative flows. |
| `design/<student-name>/api-documentation.md` | Individual | Document the API endpoints you are responsible for - method, path, example request body, expected response, and error codes returned. |
| `design/<student-name>/database-schema.md` | Individual | Detailed schema definition for your own features - table names, fields, data types, and constraints. Does not need to cover the full system; focus on the tables your features own. |

### Code Implementation & Integration

| File | Scope | Description |
|------|-------|-------------|
| `frontend/src/` | Individual | React components, pages, hooks, and utilities. Each team member's individual contributions should be traceable through Git commit history. |
| `backend/src/` | Individual | Routes, controllers, models, and middleware. Auth and protected routes must be implemented. No credentials or secrets committed - use `.env.example` instead. |
| `.git/` | Group | Submit the full `.git` folder. Contains the complete Git history - commits, branches, and individual contributions from all team members. |
| `README.md` | Group | Must include: (1) a brief description of the problem being solved and how the app addresses it, (2) task allocation - what each team member is responsible for, and (3) how to run the project locally. |

### Testing & Deployment

| File | Scope | Description |
|------|-------|-------------|
| `frontend/tests/<student-name>/` | Individual | Frontend unit tests. Include a `test-cases.md` listing all test cases - what is being tested and the expected outcome. Test files should be clear, well-named, and include meaningful assertions. All tests must pass before submission. |
| `backend/tests/<student-name>/` | Individual | Backend unit tests. Include a `test-cases.md` listing all test cases - what is being tested and the expected outcome. Test files should be clear, well-named, and include meaningful assertions. All tests must pass before submission. |
| `deployment.md` | Group | List all cloud services used for deployment (e.g. Vercel, Render, Neon, Cloudinary) with the public URLs and the environment variables required. Do not include actual secret values; use placeholder descriptions instead. |

---

## Section B - Client Engagement

> ℹ️ Section B is assessed through **live review sessions** - interim and final. There are no files to submit for this section. Prepare your demo and be ready to answer questions about your system.

### Interim Review

Demonstrate your **working prototype** live. No submission required. Ensure your prototype is deployed or runs reliably before the session. Bring notes on any gaps and your plan to address them.

### Final Review

Demonstrate the **complete application** live. The deployed URL from your README will be used. Your team must present together - prepare a user journey walkthrough that covers usability, security, performance, and edge cases.

> ⚠️ If your team is not selected for the industry client meeting, your tutor will serve as the client. The same preparation and expectations apply.

---

## Section C - AI Workflow & Reflection

> ℹ️ Section C is an **individual submission**, separate from the main project repository. Each student submits their own `your-project-ai/` folder independently - do not combine with teammates. AI log files can be large, which is why this is kept out of the project repo.

| File | Scope | Description |
|------|-------|-------------|
| `your-project-ai/<student-name>/ai-logs/` | Individual | **AI Workflow.** A folder containing your AI usage logs across the project. Use `.jsonl` files exported from Claude Code. Each entry should cover: (1) the phase (design / coding / testing / deployment), (2) the prompt used, (3) the AI output, and (4) what you did with it - accepted, edited, or rejected. Multiple files are fine - one per phase or session. |
| `your-project-ai/<student-name>/ai-reflection.md` | Individual | **AI Reflection.** A written reflection document. Explain where AI genuinely added value to your work, and where you chose to reject or significantly modify AI suggestions - with your reasoning. This must be written entirely in your own words - do not use AI to write or draft this document. |

> ✅ Keep your `ai-logs/` folder updated continuously as you work. Don't leave it to the end - your logs should show AI usage across all phases, not just one sprint.

---

## Checklist - Before You Submit

### Design

- [ ] `design/problem-statement.md` - problem, target users, and success criteria defined
- [ ] `design/architecture.md` - folder structure, cloud services, third-party and Gen AI services documented
- [ ] `design/architecture-diagram.md` - system diagram (Mermaid)
- [ ] `design/architecture-diagram.png` - system diagram (PNG)
- [ ] `design/er-diagram.md` - full ER diagram (Mermaid)
- [ ] `design/er-diagram.png` - full ER diagram (PNG)
- [ ] `design/<student-name>/use-cases.md` - use cases for own features with flows and edge cases
- [ ] `design/<student-name>/api-documentation.md` - endpoints for own features with example requests and error codes
- [ ] `design/<student-name>/database-schema.md` - detailed schema for own features: tables, fields, types, and constraints

### Code

- [ ] `frontend/` - React app builds without errors (`npm run build` passes)
- [ ] `frontend/.env.example` - placeholder env vars present; no real values committed
- [ ] `frontend/tests/<student-name>/test-cases.md` - all frontend test cases listed with expected outcomes
- [ ] `frontend/tests/<student-name>/` - frontend unit tests well-named, meaningful assertions, all passing
- [ ] `backend/` - Node server starts without errors (`node src/index.js` or equivalent)
- [ ] `backend/.env.example` - placeholder env vars present; no real values committed
- [ ] `backend/tests/<student-name>/test-cases.md` - all backend test cases listed with expected outcomes
- [ ] `backend/tests/<student-name>/` - backend unit tests well-named, meaningful assertions, all passing
- [ ] `.git/` folder included - submit the full repository so Git history is visible
- [ ] `README.md` - problem and solution described, task allocation per student, setup steps to run locally
- [ ] `deployment.md` - cloud services listed with public URLs and environment variables

### AI _(individual submission - your-project-ai/ submitted separately)_

- [ ] `your-project-ai/<student-name>/ai-logs/` - logs across all project phases with prompts, outputs, and decisions
- [ ] `your-project-ai/<student-name>/ai-reflection.md` - written reflection with reasoning on AI value and modifications
