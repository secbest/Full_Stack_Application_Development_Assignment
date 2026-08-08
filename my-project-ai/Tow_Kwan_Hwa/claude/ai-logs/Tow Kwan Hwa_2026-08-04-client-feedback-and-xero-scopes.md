# Session Log - 2026-08-04 - Client Feedback Triage, Nine Wave 3 Fixes, Live Xero App Setup

**Student:** Kwan Hua
**AI tool:** Claude Code
**Phases:** Requirements triage, self-review, coding, live integration setup

## Task 1: Turn the client interview transcript into assigned work

**Prompts / direction:**
> I had a follow up interview/presentation of what I currently have for my prototype and there were
> some noticeable add ons by the project clients. Im Tow in jasper's team and would like you to review
> the transscript

> can you update this into the readme so the ones responsible for the affected parts and push it to main

**AI output/actions:**

- Read the client review transcript and extracted the concrete requested changes rather than
  summarising the meeting.
- Mapped each item to the student who owns that feature area, and recorded the feedback and owners in
  the README so the allocation is visible to the whole team.

**Outcome:** Accepted. Committed as `71d520d` (`Record EFAR interim review feedback and assign owners
in README`).

## Task 2: Review my own features as a user would

**Prompts / direction:**
> ok nice now I want you to fully review my parts as well as act as the user using this software. I
> would like you to suggest ideas to improve my software it can be as broad as possible

> can you branch out and fix the major issues?

**AI output/actions:**

- Drove the running app through my AR and AP flows as each role rather than reading the source, and
  reported both correctness defects and improvement ideas.
- Branched and fixed nine correctness issues across the AR and AP flows.

**Outcome:** Accepted. Committed as `812adab` (`Fix nine Wave 3 correctness issues across the AR and AP
flows`).

## Task 3: Create the real Xero developer app

**Prompts / direction:**
> can you control my browser and use the xero app to create the api so I can implement it?

> I have this issue / ok check now / im currently here / the link doesnt work / where give me a step by
> step / I dont see it / how to know if im through

**AI output/actions:**

- Walked me through the Xero developer console step by step while I clicked through it myself,
  correcting course each time a screen did not look like the description.
- Once the app existed and the credentials were in place, found that the integration was still
  requesting Xero's retired broad OAuth scopes. Replaced them with the current granular scopes
  (`accounting.transactions`, `accounting.contacts`, and the rest) so the consent screen would actually
  grant access.

**Outcome:** Accepted. Committed as `f83d443` (`Request Xero's granular scopes instead of the retired
broad ones`).

## Task 4: Backend would not start

**Prompts / direction:**
> I cant run the abckend due to the port being used

> how to use the node

**AI output/actions:**

- Identified and cleared the process holding port 3000, and explained running the backend directly with
  `node src/index.js` versus through the dev script.

**Outcome:** Accepted.

## Task 5: Hold the branch

**Prompt / direction:**
> sure but dont merge into main first

**Outcome:** Branch held rather than merged. It went in later as PR #3 (`7ae60d5`) once the client-feedback
work from the other students was ready to land together.

## Decision Notes

- The scope failure was mine to catch: the Xero app was created correctly and still would not authorise,
  because the code was asking for scopes Xero had retired. Nothing in the app's own error message said
  so - it needed someone to check the request against Xero's current documentation.
- I explicitly blocked the merge at the end. The client-feedback work spanned three students, and
  merging my branch alone would have put `main` in a half-delivered state during a review week.
