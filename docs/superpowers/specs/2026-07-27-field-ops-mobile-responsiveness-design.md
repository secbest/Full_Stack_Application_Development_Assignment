# Field Operations Mobile Responsiveness - Design

Date: 2026-07-27
Branch: `feature/wave2A-mobile-responsiveness`
Owner: Jasper (Wave 2A field ops scope)

## Problem

The client asked for mobile responsive support for field operations after the interim
review. Field crew create service memos at the roadside on a phone, but every field ops
screen is desktop-only: there is not a single responsive utility class in
`pages/jobs/`, `pages/jobs/memo-wizard/`, or `pages/memos/MemoHistoryPage.jsx`.

Concrete failures on a 375px viewport today:

- `AppLayout`'s sidebar is permanently visible at `w-60` (240px) - 64% of the screen.
- Every form field pair is a hard `grid-cols-2`, halving an already narrow column.
- `MemoHistoryPage` renders a 6-column table that cannot fit.
- The signature canvas mis-maps touch coordinates (see "Signature canvas" below).

## Scope

In scope - the field crew journey plus the shared shell:

| File | Why |
|---|---|
| `layouts/AppLayout.jsx` | Shared shell; nothing else is reachable on a phone without it |
| `pages/jobs/MyJobsPage.jsx` | Field crew landing screen |
| `pages/jobs/memo-wizard/MemoWizardPage.jsx` | Wizard shell |
| `pages/jobs/memo-wizard/WizardProgressBar.jsx` | 4 step labels cannot fit 343px |
| `pages/jobs/memo-wizard/Step1JobDetails.jsx` | 3x `grid-cols-2` |
| `pages/jobs/memo-wizard/Step2ServiceCharges.jsx` | Selects, 5 surcharge toggles, numeric pair |
| `pages/jobs/memo-wizard/Step3Signature.jsx` | Two-column split + canvas coordinate bug |
| `pages/jobs/memo-wizard/Step4StampSubmit.jsx` | Two-column split |
| `pages/jobs/memo-wizard/MemoSubmittedView.jsx` | Top margin only - already stacks |
| `pages/memos/MemoHistoryPage.jsx` | 6-column table |

Out of scope - AR, AP, MD, and Quotations *content* screens. They inherit the responsive
shell (so they are navigable on a phone) but their internals stay desktop-first. The AP
two-panel PDF review in particular has no sensible phone layout and is not being
attempted here.

## 1. Breakpoint strategy

**Mobile-first and additive-only.** Unprefixed utilities describe the phone; a prefixed
variant restores today's desktop value. `grid-cols-2` becomes `grid-cols-1 sm:grid-cols-2`.
Desktop rendering is therefore unchanged by construction - no existing behaviour can
regress from a layout edit.

Two breakpoints carry real decisions, for two different reasons:

| Breakpoint | Governs | Why here |
|---|---|---|
| `md` (768px) | App-shell drawer vs static sidebar | A 768px tablet has ample room for a 240px sidebar; only a phone does not |
| `lg` (1024px) | Memo table vs card list; the Step 3 / Step 4 two-column card splits; the three-column detail grid | Below `lg` the 240px sidebar leaves under 500px of content, which fits neither six columns nor two cards side by side |

`sm` (640px) is used for the within-card field pairs, where two inputs need roughly 200px
each.

This started as a single `md` breakpoint. The browser verification pass at 768px disproved
that: the six-column memo table was **clipped inside its card**, silently losing the
"Submitted" column, and the Step 3 split squeezed the signature pad to 182px. Both now
switch at `lg`. The clipping is worth recording because a document-level
`scrollWidth <= clientWidth` assertion cannot see it - the card's `overflow-hidden`
absorbs the overflow, so the page looks healthy while data is cut off. The verification
script now also walks each element's own scroll box.

## 2. Responsive app shell

New hook module `src/hooks/useIsMobile.js`, exported from `hooks/index.js`:

- `useMediaQuery(query)` - subscribes to any query with a `change` listener
- `useIsMobile()` - the `md` cutoff, used by the shell
- `MOBILE_QUERY` (`max-width: 767px`) and `NARROW_QUERY` (`max-width: 1023px`)

The queries sit one pixel below the Tailwind breakpoint they mirror (767, not 768), or the
JS state and the CSS layout disagree at exactly that width.

Why JavaScript rather than pure CSS: the drawer needs open/closed *state*, must close on
route change, must trap Escape, and must not render a backdrop on desktop. A CSS-only
`peer`-checkbox pattern cannot close itself on navigation. Memo History needs it for a
different reason - it chooses between two component trees, not two stylings.

| Concern | Under `md` | `md` and up |
|---|---|---|
| Sidebar | `fixed inset-y-0 left-0 z-50 w-72`, `-translate-x-full` closed, `translate-x-0` open | unchanged `w-60` / `w-[68px]` static |
| Top bar | 56px, `#1E293B`, hamburger + wordmark | `md:hidden` |
| Backdrop | `bg-black/50`, tap closes | not rendered |
| Collapse rail toggle | hidden - collapsing is a desktop concept | unchanged |

The same `<aside>` markup serves both breakpoints; no second navigation component is
introduced. The drawer closes on nav-link tap, backdrop tap, and Escape. Accessibility:
`aria-expanded` and `aria-controls` on the hamburger, `role="dialog"` + `aria-modal`
while open on mobile, and body scroll locked while open.

## 3. Screen-by-screen

| Screen | Change |
|---|---|
| MyJobsPage | Job card row stacks; action button full-width and 44px tall; filter tabs become `grid-cols-2 md:inline-flex`; `p-6` -> `p-4 md:p-6` |
| MemoWizardPage | Header stacks; title `text-xl md:text-2xl`; padding as above |
| WizardProgressBar | Step labels `hidden md:block`; a "Step 2 of 4 - Service & Charges" line added above the circles so the mobile view still names the step |
| Step1JobDetails | 3x `grid-cols-2` -> `grid-cols-1 sm:grid-cols-2`; blue summary block `mx-4 md:mx-6` |
| Step2ServiceCharges | Selects, surcharge toggle grid, and numeric pair -> 1 column on phone; `ToggleRow` checkbox `h-5 w-5 md:h-4 md:w-4`, padding `py-3 md:py-2.5` |
| Step3Signature | `grid-cols-2` -> `grid-cols-1 lg:grid-cols-2`; canvas rework per section 4 |
| Step4StampSubmit | `grid-cols-2` -> `grid-cols-1 lg:grid-cols-2`; summary values `min-w-0 break-words`; upload copy says "Tap" below `md` |
| MemoSubmittedView | `mt-12` -> `mt-8 md:mt-12`; taller buttons |
| MemoHistoryPage | Card list below `lg`, table from `lg` up; pagination extracted to a shared `PaginationBar` used by both |

Two decisions worth recording:

**Wizard footers use `flex-col-reverse md:flex-row`.** On a phone the primary action
(Next / Submit) sits above Back - thumb-nearest and first in reading order - while DOM
order stays Back-then-Next so keyboard tab sequence is unchanged.

**Memo History gets two presentations, not one compressed one.** Six columns cannot
compress below `lg`. Rejected alternatives: `overflow-x-auto` (horizontal scrolling a
primary screen is poor on touch and hides columns behind an invisible affordance) and
column-hiding (silently drops data the crew needs). To avoid duplicating the per-memo
fetch and its loading/error states across the two presentations, the expanded-detail body
is extracted into `pages/memos/MemoDetailGrid.jsx` and consumed by both the desktop
table row and the mobile card; `PaginationBar` is shared the same way.

The mobile card's toggle is a real `<button>` with `aria-expanded`, so it is keyboard
operable and announced - an accessibility improvement over the desktop table row it
replaces, which is only mouse-clickable.

## 4. Signature canvas

`Step3Signature` declares a fixed `400x200` bitmap but stretches it with `w-full`.
`getCanvasPos` feeds raw `getBoundingClientRect` offsets into that unscaled bitmap, so
whenever the rendered width is not exactly 400px the ink lands away from the pointer,
with error proportional to the mismatch. At 375px the canvas renders about 311px wide -
roughly a 29% horizontal offset. This is a pre-existing bug that also affects desktop;
mobile makes it unmissable. Handover signatures are the proof-of-delivery artefact for
the AR flow, so it is fixed here rather than deferred.

Two pure helpers in `src/lib/canvas.js`, kept out of the component so they are unit
testable without a jsdom canvas implementation:

```js
resizeCanvasToDisplaySize(canvas, dpr)  // bitmap = rendered box x devicePixelRatio
toCanvasPos(canvas, clientX, clientY)   // offsets scaled by bitmap/rect ratio
```

The canvas becomes `h-40 md:h-[200px] w-full` (`touch-none` is already present, which
stops the page scrolling while signing). A `ResizeObserver` re-sizes the bitmap on
orientation change. Because resizing a canvas clears it per spec, the pad is cleared and
- only when ink was already present - a toast fires: "Signature pad was resized - please
sign again." Sizing to `devicePixelRatio` also means signatures are captured at device
resolution instead of being upscaled from 400x200.

## 5. Testing

Jest, in `frontend/tests/jasper/`:

| Test file | Tests | Covers |
|---|---|---|
| `canvas.test.js` | 9 | `toCanvasPos` scaling, identity when bitmap equals rect, rect origin offset, retina case, zero-layout guard; `resizeCanvasToDisplaySize` sizing, rounding, no-op detection |
| `useIsMobile.test.js` | 5 | True under 768px, false above, the 767/768 boundary, updates on resize, listener cleanup on unmount |
| `AppLayout.mobile.test.jsx` | 11 | Hamburger gated on mobile and absent on desktop, dialog semantics, closes on nav click / backdrop / Escape / close button, body scroll lock and restore, open drawer discarded when resized to desktop |
| `MemoHistoryPage.test.jsx` | 9 | Table at `lg` and up, card list below it (including 768px), all six columns' data present in a card, expand and collapse, pagination reachable, empty state |

Explicit limitation: jsdom does not evaluate CSS, so asserting on a class string such as
`lg:grid-cols-2` proves only that the string reached the DOM - never that the layout works.
Tests therefore cover behaviour jsdom can genuinely decide (state, gating, which component
tree is rendered, arithmetic).

The layouts themselves are verified in a real headless browser at 375 / 768 / 1024 /
1280px, driving the full wizard end to end with the API stubbed by request interception -
no backend or database needed, since the axios `baseURL` falls back to a relative `/api`.
Per viewport it asserts no document overflow, no content clipped inside any scroll box,
correct hamburger gating, the memo presentation, and - for the signature pad - that the
bitmap equals the rendered box times `devicePixelRatio` and that a stroke drawn to the
right edge actually reaches ~90% of the bitmap. 1280px doubles as the desktop
no-regression check. Script and screenshots are session artefacts, not committed.

`tests/setup/jest.setup.js` needs a `window.matchMedia` stub, since jsdom does not
implement it at all. That file is shared by all four students, but the change is purely
additive - it defines a global that currently does not exist - so it cannot alter
existing test behaviour. The full suite is re-run to confirm.

## Risks

| Risk | Mitigation |
|---|---|
| Shared `jest.setup.js` edit affects other students' tests | Additive only; full suite re-run |
| `AppLayout` is shared by all five roles | Desktop classes unchanged; only `md`-and-below behaviour is new |
| `MemoHistoryPage` split could drift between presentations | Shared `MemoDetailGrid` keeps the detail body single-sourced |
| Existing `tests/jasper/MyJobsPage.test.jsx` queries markup being restructured | Run it after each edit; queries are role/text based, not class based |
