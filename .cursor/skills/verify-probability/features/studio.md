# Model studio

`/studio` constructs a finite model from 1 to 12 named outcomes, raw whole-number weights from 0 to 999 and membership in A and B. All probabilities are reduced exact fractions. No Studio work is saved to progress, browser storage or a server.

## Sub-features

- Native outcome names, weights and membership checkboxes define one canonical model. Add and remove preserve the one-outcome and twelve-outcome bounds.
- Whole-model and B-evidence controls label each outcome as numerator and denominator, denominator only, or excluded. Zero-weight outcomes keep their memberships.
- Invalid drafts suppress every current result. Total weight zero is invalid. Zero evidence in a valid model makes the conditional undefined while exact product independence still applies.
- A pin copies the valid model and descriptions. Presets keep the pin and reflection. Clear comparison keeps current work and reflection. Start over clears the entire visit.
- Download model note preserves raw input, validation issues, available exact answers, pin and reflection. The form stays usable during delayed or unavailable account discovery.

## How to get to it (user POV)

Top bar → Studio, or open `/studio`. Pin the balanced model. Change HH's weight to 3 and select Condition on B. The current conditional becomes 3/4 while the pin stays 1/2. Open Describe the model and events to edit descriptions.

## Driving it with control-probability

`smoke --feature studio --capture` captures each mapped state at desktop and mobile widths. `node scripts/verify-journeys.mjs --only studio` edits only native controls, checks exact results and contribution labels, inspects downloads, tests invalid drafts and outcome bounds, and proves retention through history and delayed/failed discovery. Successful account and progress responses are never injected. The unfiltered sweep keeps all 200 prior records and adds Studio at 390, 600, 860 and 1280px. The mobile journey also tests 320px.

## Visual states

- `load` (desktop, mobile)
- `descriptions` (desktop, mobile)
- `conditional` (desktop, mobile)
- `comparison` (desktop, mobile)
- `invalid-input` (desktop, mobile)
- `zero-total` (desktop, mobile)
- `zero-evidence` (desktop, mobile)

Inspect the untouched original PNGs for every state at both widths. Journey captures include outcome bounds, clear/reset behavior, discovery lifecycle and 320px. Linux baselines remain the release comparison source.

## Gotchas

Studio state belongs to the unkeyed App. Internal navigation and in-page discovery/retry retain it. Reload and Start over clear it. Page departure normally discards it, but browser Back may restore the document from memory. Top-level sign-in or sign-out can depart the page. Do not claim retention across authentication navigation or confuse this visit with account-owned lesson progress. Descriptions do not define membership. Pinned and current event descriptions must remain labelled separately.
