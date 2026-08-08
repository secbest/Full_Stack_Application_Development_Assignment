# Session Log - 2026-07-08 - Wave 1B Merge, Dev Server Fixes, Wave 3 Takeover

**Student:** Kwan Hua
**AI tool:** Claude Code
**Phases:** Integration, debugging, scoping

## Task 1: Merge Wave 1B into main without conflicts

**Prompt / direction:**
> ok my project mates just merge some branches can you merge my wave 1 into main since its complete
> without any merge conflicts make sure everything is proper procedure

**AI output/actions:**

- Fetched `origin/main`, merged `main` into `wave-1-1b-xero-api` first so any conflict was resolved on
  my branch rather than on `main`, then merged forward.
- Merge commits: `eb6ae8a` (main into branch) and `e90a7cf` (`Merge wave-1-1b-xero-api into main`).

**Outcome:** Accepted. No conflicts on `main`.

## Task 2: Frontend would not start

**Prompt / direction:**
> my frontend dont work can you check?

**AI output/actions:**

- Launched the app rather than reasoning about it, and traced the failure to Vite silently choosing a
  different port when 5173 was occupied, so the frontend was serving somewhere the configured API base
  did not expect.
- Pinned the Vite dev server to strict port 5173 so a port collision fails loudly instead of drifting.

**Outcome:** Accepted. Committed as `c06fce1` (`Pin Vite dev server to strict port 5173`).

## Task 3: Take over the whole of Wave 3

**Prompts / direction:**
> can you check whether I can start wave 3

> ok then can you close wave b1 branch after merging into main since Im dont with it

> ok branch off to wave 3

> Ok great now do my part for wave 3. Check whether If I need Xero key api and step by step on how to
> get it from xero developer mode if needed

> ok change of plans I will take over the whole wave 3 so can you do that as well

> ok before that change all necessary notes that I took over the wave so i can take credit for my work

> sure but I do have a change of mind I would like to have a actual xero api implementation

**AI output/actions:**

- Confirmed Wave 3 was unblocked, deleted the finished Wave 1B branch, and branched to `wave-3-ap-sync`.
- Gave step-by-step instructions for creating a Xero developer app and obtaining the client ID/secret,
  and which redirect URI to register.
- Built the full Wave 3 scope after the takeover: the AR billing/pricing engine, AP invoice sync, and
  Wave 2B pricing contracts.
- Switched the Xero integration from the simulated-only path to a real API implementation with
  `XERO_SIMULATION` as the switch, so the demo can run either way.
- Updated the README and design notes so the wave ownership change is recorded against my name.

**Outcome:** Accepted. Committed as `06a771b` (`Add Wave 3: AP invoice sync + AR billing/pricing engine,
with real Xero API`).

## Decision Notes

- I asked for the ownership notes to be updated at the same time as the code, not afterwards. The
  submission is graded on traceable individual contribution, so a takeover that is only visible in
  commit authorship is not enough.
- I changed my mind mid-session and asked for a real Xero implementation instead of a simulated one.
  Keeping `XERO_SIMULATION` as a flag was the compromise - the demo never depends on a live external
  service being up, but the real path exists and is exercised.
