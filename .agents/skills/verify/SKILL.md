---
name: verify
description: Drive and verify Probability mathematics, public study journeys, six labs, guest progress and authenticated account storage.
---

# Verify Probability

Use `npm run agent -- help` for discovery. `verification/features.json` owns feature purpose and source ownership. `.cursor/skills/verify-probability/features/smoke.json` owns exact visual states; sibling Markdown files describe user behavior. Curriculum inventory comes from `src/content/order.json` and `part*.json`.

## Launch

Run `npm ci` and `npm run build`. `npm run agent -- launch --data-dir .verify-run/my-check` serves the emitted local Worker. Add `--mode dev --migrate` for the starter's loopback-only sign-in fixture and isolated local D1 with generated migrations. The account fixture requires a build for binding identity. `npm run verify:browser` manages its own instances.

Built preview and hosted Sites do not simulate a signed-in visitor. Development sign-in proves only the local fixture, never hosted ChatGPT authentication.

## Doctor

`npm run agent -- doctor` reports runtime, source, dependencies, browser and Site binding. For a launched instance, use `node scripts/control-probability.mjs doctor --data-dir .verify-run/my-check` before driving. Browser commands also check their owned instance. Diagnose surprising failures; use a fresh context or instance before another journey.

## Drive

`npm run agent -- map --check` validates feature coverage. `show --id R05` prints one full lesson. `plan --base main` selects affected features; unmapped files expand to full coverage.

`journey --id lessons/answer-shown` drives exactly one mapped state. `journey --feature lessons` drives that feature. These commands create fresh instances and capture development evidence, explicitly skipping baseline comparison. Unknown and empty selections fail before launch.

`verify --layer all --evidence artifacts/release/new-result.json` runs source checks, build and full browser verification. `--layer source` or `browser` runs only that layer. Publication requires the full release run. Browser verification composes baseline smoke and normal-UI journeys.

Study journeys prove guest studied/rating reloads, capture the home study overview and chapter grid, activate a chapter lesson and Continue, and check static library chapter/order selection, checkpoint solutions and reference lookup. Guided journeys build captured topic/review paths through normal controls, preserve roster, cursor, scratch, reveals and focus through ratings, reach K03 in sets of three and five, explicitly refresh review membership, and check route history, reload, all-studied recall and hidden-panel accessibility. Navigation journeys retain concept search, browser history and mobile keyboard focus. They also activate Skip to content, the visible desktop Probability home button, generic not-found recovery and short lesson-alias canonicalization. Six labs verify every slider, numerical results and readable chart/table labels, including updated table values after λ, p and New run changes. A 320px reflow probe covers the chooser, long path, active card, summary, opened count-model checkpoint, reference and search. It complements the complete 390/600/860/1280px sweep.

Account journeys use real local D1: discovery loading/failure, top-level fixture sign-in, explicit guest import, account marks/ratings through reload, isolated anonymous context, active-recall failed-save feedback/retry, actual stale two-tab conflict and sign-out restoring the unchanged guest copy. Roster, scratch and reveals survive saving, failure and conflict. Delayed/unavailable discovery hides personal planning. One explicitly labelled injected PATCH 401 is followed by real same-owner discovery; real sign-out in another tab triggers owner-loss discovery in the old recall. Both reset the visit. Network interception supplies only delays and failed responses, never successful identity or progress bodies. No internal store is driven. Handler tests cover account/write boundaries and concurrency. Hosted sign-in and a real second account require separate live verification.

The full semantic sweep opens all lesson hints/answers, all practice problems/checkpoints, every reference condition and the distribution guide. Inventory assertions fail incomplete coverage. It retains the 200 original page-width records and four Studio records, then adds home at the same four widths, for 208 records. Home asserts the complete ordered lesson catalogue and chapter inventory with the scope disclosure open. Every page listens for console and runtime errors. Rendering checks report duplicate document IDs, including hidden elements. Every captured recall member is activated before its rendering verdict; hidden panels are also checked for native hidden state, missing layout boxes, accessibility exclusion and keyboard isolation.

Studio journeys use native controls to construct, condition, pin, compare, clear, reset and download finite models. Invalid raw attempts remain exportable. Delays and failed discovery responses prove retention across account-keyed reader remounts without injecting successful account or progress bodies. Studio writes no progress, browser storage or server state. History and lesson links retain the visit. Reload and Start over clear it; browser Back may restore a previous document visit. The Studio journey also runs at 320px. Use `node scripts/verify-journeys.mjs --only studio` for a focused development run.

## Evidence

Automated runs preserve immutable PNG/ARIA files, logs and structured results in fresh artifact directories. Results include selection, full/development status, failures, Git head, dirty tracked/untracked source digest, feature-map digest and built-output digest. Source changes invalidate a run. Explicit artifact/result paths must be new.

Smoke captures the changed region, including answers and lab controls. Full release runs compare pixels with committed baselines. Inspect changed desktop/mobile images before a visual verdict or baseline acceptance. `--capture` and `--update-baselines` never count as release comparison. Preserve original baselines until consciously accepting inspected replacements.

Committed baselines use the Linux runner and pinned Chrome in `.github/workflows/check.yml`. Other platforms can produce pixel differences with unchanged source and the same Chrome version. Preserve those failures, run the complete journeys, and use the successful exact-head CI artifact for release comparison. Never replace Linux baselines with another platform's captures to clear that failure.

Content-region captures keep the declared width and temporarily grow viewport height to show the complete card. Sticky navigation is hidden outside its own captures; the original viewport is restored afterward. Rendering checks require readable axis labels, nonoverlapping ticks and legend colors matching their plotted series.
Requested hover and keyboard focus are asserted after capture positioning; hover captures restore the intended pointer target and require its computed background to change.

Changed content needs independent mathematical review on its final text. Keep verifier, two reviewer verdicts, actual runner/model/effort/session and exact reviewed contents distinct. Bugbot adds feedback; it does not replace independent verdicts.

For publication, preserve `.openai/hosting.json`, use the supported Sites workflow and verify the literal deployed URL and source/version receipt. Label unavailable hosted authentication, second-account and assistive-technology checks.

## Cleanup

`npm run agent -- stop --data-dir .verify-run/my-check` stops only the exact nonce-tagged owned process group. Stale/foreign PIDs are refused. Automated runs preserve logs before removing their temporary local state. Artifacts survive cleanup; remote verification never stops a server.

## Helpers

`scripts/probability.mjs` provides discovery, affected-feature planning and orchestration. `scripts/control-probability.mjs` owns mapped visual states, region captures, release pixel comparison and the full render sweep. `scripts/verify-journeys.mjs` proves composed study/account behavior. `scripts/check-drift.mjs` validates real source ownership, state documentation, curriculum/lab coverage and baselines.

Cursor uses the same scripts and evidence through its compatibility skill. Keep both entry points aligned with actual CLI help.

Shared browser proof helpers live in `scripts/browser-probability.mjs`, without CLI state. For a short composed check, run `node scripts/verify-journeys.mjs --only accounts --viewport mobile --artifacts artifacts/new-account-check`. Use `--only guided` for a focused planner diagnosis. Mobile selections also run all 320px planner, checkpoint, reference and search probes, with every reference condition open. Selected runs remain development evidence.
