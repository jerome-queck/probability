---
name: verify-probability
description: Drive Probability lessons, practice, reference, six labs and guest/account progress through the shared browser harness. Cursor compatibility entry point.
---

# Verify Probability

The canonical agent entry point is [verify](../../../.agents/skills/verify/SKILL.md). Cursor and Codex share `scripts/`, [feature descriptions](features/README.md), `verification/features.json` source ownership and `features/smoke.json` visual states.

## Launch

```bash
npm ci
npm run build
node scripts/control-probability.mjs launch --data-dir .verify-run/my-check
# Loopback sign-in fixture and isolated, migrated local D1:
node scripts/control-probability.mjs launch --mode dev --migrate --data-dir .verify-run/account-check
```

Wait for `READY`. Each data directory owns one process group and local storage. Preview serves the emitted Worker configuration at `dist/server/wrangler.json`. Development sign-in is the starter's loopback fixture. Neither establishes hosted ChatGPT authentication.

## Doctor

```bash
node scripts/control-probability.mjs doctor --data-dir .verify-run/my-check
```

Checks the nonce-tagged process, its process group, public shell and deep lesson route. Run before driving and after any surprising failure. A fresh browser context resets UI state; failed drives preserve evidence before cleanup.

## Drive

```bash
node scripts/control-probability.mjs open --url /lessons/f02 --data-dir .verify-run/my-check
node scripts/control-probability.mjs click --url / --role button --name 'Begin at the beginning' --data-dir .verify-run/my-check
node scripts/control-probability.mjs set-range --url /lessons/c04 --name people --value 40 --data-dir .verify-run/my-check
node scripts/control-probability.mjs snapshot --url /reference --path artifacts/reference.aria.txt --data-dir .verify-run/my-check
node scripts/control-probability.mjs screenshot --url /practice --path artifacts/practice.png --data-dir .verify-run/my-check
```

`smoke --only labs/birthday-moved --capture` drives exactly one state. `smoke --feature labs --capture` drives all lab states. Unknown, empty and ambiguous selections fail before launch. These captures are development evidence; comparison is explicitly skipped. Omit selection and capture for the release smoke run.

`npm run verify:browser` runs smoke followed by `scripts/verify-journeys.mjs`. Journeys prove guest persistence, filters, checkpoints, reference lookup, search/history/keyboard navigation, six numerical lab interactions and local-D1 account discovery/import/save/reload/isolation/retry/conflict/sign-out. Writes use normal UI. Network interception delays account discovery and injects unavailable-account and failed-save responses; a real second tab produces the stale-revision conflict. Server D1 tests cover handler boundary/concurrency details.

The full smoke sweep opens every lesson's hints and answer, all practice problems and checkpoints, both reference collections and all conditions at 390, 600, 860 and 1280px. Inventory counts fail incomplete reveals. Every page captures console and page errors. Rendering checks cover overflow, clipped/orphaned math, fonts and contrast. Journeys also probe 320px navigation reflow and direct `#lab` placement.

## Evidence

Automated runs create fresh directories under `artifacts/smoke/` and `artifacts/journeys/`; `--artifacts NEW_DIR` sets a named directory and refuses to overwrite evidence. Result JSON records failures, selection, full/development status, original screenshots and ARIA, Git head, dirty tracked/untracked source digests, feature-map digest and built-output digest. Source changes during a run invalidate it. CI uploads `artifacts/` as `verify-evidence`.

Mapped states capture the relevant region (`captureSelector`), such as the revealed answer, account panel or experiment. Full release smoke retains pixel comparison against committed baselines. Inspect every changed desktop and mobile screenshot. A passing DOM assertion or generated baseline is not a visual verdict.

Committed baselines use the Linux runner and pinned Chrome in `.github/workflows/check.yml`. Other platforms can differ with unchanged source and the same browser version. Preserve failed comparisons, run the complete journeys, and inspect the successful exact-head CI artifact before a release verdict. Keep replacement baselines in that Linux environment.

Content-region captures keep the declared width and temporarily grow viewport height to show the complete card. Sticky navigation is hidden outside its own captures; the original viewport is restored afterward. Rendering checks require readable axis labels, nonoverlapping ticks and legend colors matching their plotted series.
Requested hover and keyboard focus are asserted after capture positioning; hover captures restore the intended pointer target and require its computed background to change.

For intended changes, `smoke --update-baselines` generates candidates; inspect every changed image before accepting it. Preserve originals until that decision. Missing or differing baselines fail release checks. New visual states require smoke drives, feature documentation and inspected baselines together.

Changed mathematical text requires independent review on its final contents. Keep verifier, reviewer, mathematical and hosted-authentication evidence separate and truthful.

## Cleanup

```bash
node scripts/control-probability.mjs stop --data-dir .verify-run/my-check
```

Only exact owned process groups may stop. A stale or foreign PID is refused. Smoke/journeys clean their own servers and temporary D1 state after preserving logs. Artifact directories survive cleanup.

## Helpers

- `scripts/probability.mjs`: agent help, doctor, map, lessons, show, plan, launch, stop, journey, verify and remote public-shell check.
- `scripts/control-probability.mjs`: owned-instance CLI, exact smoke drives, region evidence, pixel comparison and semantic render sweep.
- `scripts/verify-journeys.mjs`: composed normal-UI study and local account journeys.
- `scripts/check-drift.mjs`: real ownership, feature/state documentation, labs, chapter inventory and baseline coverage.
- `features/smoke.json`: exact driven visual state registry. `verification/features.json`: source ownership.

Shared browser proof helpers live in `scripts/browser-probability.mjs`, without CLI state. For a short composed check, run `node scripts/verify-journeys.mjs --only accounts --viewport mobile --artifacts artifacts/new-account-check`. Mobile selections also run the 320px reference probe with every condition open. Selected runs remain development evidence.
