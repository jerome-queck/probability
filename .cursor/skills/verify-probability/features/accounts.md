# Account progress

The Progress menu offers guest storage or a signed-in account. Public reading remains available while account checks or saves fail.

## Sub-features

- `accounts.discovery`: hide guest marks and disable studied/rating controls while identity loads or is unavailable. Failed discovery offers "Retry account"; public reading and the static library remain available. Guided plan controls and personal counts are hidden until discovery resolves.
- `accounts.sign-in`: top-level “Sign in with ChatGPT” and “Sign out” return to the current route.
- `accounts.import`: preview and explicitly import guest studied marks/self-ratings; cancel leaves both copies unchanged. Existing account ratings take precedence.
- `accounts.save`: account marks and ratings persist in D1; show saving, saved, failed or conflicting state truthfully.
- `accounts.recover`: retry failed changes or accept the account version after a stale revision. Active recall retains roster, cursor, scratch and reveals through saving/error/conflict for the same owner.
- `accounts.isolate`: anonymous browser contexts cannot see account marks; sign-out restores the existing guest copy.

## How to get to it (user POV)

Top bar → Progress. Sign in, read the import preview, then choose whether to import. Lesson studied/rating controls show their save state; Progress offers recovery.

## Driving it with control-probability

`smoke --feature accounts --capture` captures the guest panel. `node scripts/verify-journeys.mjs` launches isolated migrated local D1 and drives actual sign-in/import/save/reload/active-recall retry/two-tab conflict/sign-out at desktop/mobile widths. It also checks a separate anonymous context and reads the account API after UI writes.

## Visual states

- `guest` (desktop, mobile): public preview Progress panel.

Journey evidence also captures unavailable and pending account discovery, imported/saved account controls, failed save, stale conflict and the guest copy after sign-out. Inspect `account-unavailable` and `account-discovery-pending` at desktop/mobile widths for disabled controls and hidden guest marks. Planner captures also preserve the active set beside failed-save and real stale-conflict feedback. One labelled injected PATCH 401 holds then continues real account discovery, proving a same-owner visit reset. Real sign-out in another tab causes an unauthorized old-tab write and guest reset. Sign-in again starts choose. These local fixture captures do not establish hosted authentication.

## Gotchas

Local development sign-in is a loopback fixture. Built preview has no mock account. Hosted ChatGPT sign-in and a real second account remain a separate live prerequisite. Retry preserves unsaved changes only in the current tab; reload may discard them.
