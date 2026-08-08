# Presentation Site Design

**Date:** 2026-08-08
**Status:** Approved

## Purpose

A standalone, animated static website for the final EFAR project review/presentation, under a new top-level `presentation/` folder. It tells the problem-statement story (from `project-requirement.md`) with descriptions, charts, and scroll-triggered animations, then closes by showcasing the live deployed application with a link into it.

It must run via its own dev script without ever risking the live production site or the team's local dev servers (`frontend/` on port 5173, `backend/` on port 3000).

## Non-goals

- Not deployed anywhere yet - local-only for the review session. Deployment can be a separate follow-up later.
- Not connected to the backend API, the database, or any live data - purely static content compiled from `project-requirement.md`.
- Not a replacement for the real app's login/auth flow - the live app is only shown via an embedded preview and a launch link, never re-implemented.

## Architecture & Isolation

`presentation/` is a fully independent app, structurally parallel to `frontend/` and `backend/` (own `package.json`, own `node_modules`, own Vite config) but with zero shared dependencies, ports, or build tooling.

- **Stack:** Vite + React + `motion` (Framer Motion, the React-specific library from the motion.dev team) + `recharts` for the metrics chart.
- **Port:** fixed at `5175` via `server.port: 5175` and `server.strictPort: true` in `presentation/vite.config.js`, so a collision fails loudly instead of silently shifting port or colliding with 5173/3000.
- **Port safety script:** `presentation/src/scripts/check-port-free.js`, mirroring the existing pattern in `backend/src/scripts/check-port-free.js`, wired as an npm `predev` hook. It checks port 5175 is free before Vite starts.
- **No API/proxy config:** the site makes no network calls to the backend, so there is no proxy setup and no path by which running it could affect `backend/` state.

`presentation/package.json` scripts:
```json
{
  "scripts": {
    "predev": "node src/scripts/check-port-free.js",
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

## Content Structure

Single scrollable page assembled from ordered section components under `presentation/src/sections/`:

1. **Hero** - title, tagline, animated entrance.
2. **Problem** - Who / What / Barriers / Cause / Emotion / Outcome (`project-requirement.md` §1), as staggered reveal cards.
3. **WorkflowComparison** - before (manual/paper-based) vs after (digital intake -> memo -> pricing match -> Xero sync) animated comparison.
4. **Solution** - the 4-row capability/impact value-prop table (§2) as animated feature cards.
5. **StakeholderRoles** - 4 cards for MD, AR, AP, Quotations Specialist with responsibilities (§6).
6. **SuccessMetrics** - bar chart (via `recharts`) of the 4 target metrics (§5), with animated count-up triggered on scroll into view.
7. **LiveAppCTA** - closing section, detailed below.

All copy is centralized in `presentation/src/data/content.js`, transcribed from `project-requirement.md`, so content edits ahead of the review don't require touching JSX/component files.

Animation approach: Framer Motion `whileInView` scroll-triggered reveals and staggered children for cards/lists; no animation library beyond `motion` + `recharts`.

## Closing Section - Live App Showcase

- A browser-chrome mockup (fake traffic-light dots + address bar displaying `https://full-stack-application-development-pi.vercel.app`) scales/fades into view via Framer Motion when scrolled into view.
- Inside the mockup, an `<iframe src="https://full-stack-application-development-pi.vercel.app">` renders the real live app so the actual login screen is visible directly in the presentation. (Verified at build time: the frontend's `vercel.json` sets no `X-Frame-Options`/CSP `frame-ancestors` headers, so embedding is expected to succeed.)
- Below/over the mockup, a prominent "Launch EFAR Platform" button links to the same URL with `target="_blank"` - this is the actual hand-off point where the presenter clicks through into the real, live application.
- If the iframe fails to load (network issue, a future header change on the Vercel project), the launch button remains a working fallback so the presentation never ends on a broken embed.

## Testing

- No unit tests required for this presentation-only, non-graded static site (it has no per-student ownership folder requirement in `submission-guide.md` and isn't part of the assessed app).
- Manual verification before the live review: run `npm run dev` in `presentation/`, confirm it starts on port 5175 without needing `frontend/` or `backend/` to be stopped, and confirm the closing iframe actually loads the live Vercel deployment.
