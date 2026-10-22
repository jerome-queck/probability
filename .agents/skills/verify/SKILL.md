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

Study journeys prove guest studied/rating reloads, scratch-work lifetime, chapter/review filtering, checkpoint solutions, reference conditions/distributions, concept search, browser history and mobile keyboard focus. Six labs verify changed controls, numerical results and readable chart/table labels. A 320px reflow probe complements the full 390/600/860/1280px sweep.

Account journeys use real local D1: discovery loading/failure, top-level fixture sign-in, explicit guest import, account marks/ratings through reload, isolated anonymous context, failed-save feedback/retry, actual stale two-tab conflict and sign-out restoring the unchanged guest copy. Network interception delays account discovery and injects unavailable-account and failed-save responses; no internal store or fake UI is used. Handler tests cover account/write boundaries and concurrency. Hosted sign-in and a real second account require separate live verification.

The full semantic sweep opens all lesson hints/answers, all practice problems/checkpoints, every reference condition and the distribution guide. Inventory assertions fail incomplete coverage. Every page listens for console and runtime errors.

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

Shared browser proof helpers live in `scripts/browser-probability.mjs`, without CLI state. For a short composed check, run `node scripts/verify-journeys.mjs --only accounts --viewport mobile --artifacts artifacts/new-account-check`. Mobile selections also run the 320px reference probe with every condition open. Selected runs remain development evidence.
