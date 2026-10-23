---
name: progress-integrity
description: Check account progress integrity after changes to ownership, async responses, revisions, retries, or the progress store and handler. Maintain the finite TLA+ models and actual-code bridge.
---

# Check progress integrity

Account intents must stay with their expected owner. Stale completions must not settle a newer session, replace a newer confirmed revision, or acknowledge an unrelated retry.

## Run

1. Read `formal/progress/README.md` for the code correspondence and limits.
2. Install Node 24+, Java 11+, and dependencies with `npm ci`.
3. Run `npm run verify:formal -- --mutations`.
4. Inspect the printed evidence directory. Both baseline models and the actual-code bridge must pass. Every model mutant must violate its named invariant with a trace. Every real-code mutant must fail its named assertion. Setup errors, timeouts, missing tools, and checksum failures are blocked checks.

The command downloads TLC release 1.7.4 into ignored `artifacts/`, validates its SHA256, and retains original logs and scratch variants. `formal/progress/coverage.json` owns the pin and source digests. The shorter `npm run verify:formal` skips real-code mutation checks while retaining model sensitivity checks. This suite is separate from `npm run check` and does not replace browser verification.

## Covered code

Last confirmed sync commit is `46c239421de3d2f19395e334a07f9ceeb0ad66d8`.

- `server/progress.ts` covers the expected-owner branch in `handleProgress`, `write`'s atomic INSERT/UPDATE revision comparison, and its separate fallback SELECT and exact retry acknowledgement.
- `src/progress.ts` covers `parseRecords` and `createProgressStore`'s `active` and `mergeRecord`; the successful response continuations of `flush` and `acceptRemote`; `loadSession`'s single refresh transition and same-owner retention; and `retry`'s command reuse after a lost response.
- The bridge imports these actual TypeScript files and runs actual migrations and SQL through local D1. Model-only fault switches do not change product code. Real-code variants copy and change the exact source in ignored scratch directories.

## Maintain after a change

1. Run the check before edits. Preserve any failures.
2. Read every commit and working change since the sync commit in the covered files. Search for moved functions and new writers to `generation`, `session`, records, pending queues, and `lesson_progress`.
3. Compare each await and SQL boundary with the action map in `formal/progress/README.md`. Classify each change as no effect, model drift, an intended promise change with evidence, or a possible bug.
4. Update verification to describe the code before rerunning. Preserve properties unless the intended promise changed. Replay a failing trace in code terms. Report feasible failures as bugs; correct impossible model steps as drift.
5. Run the full command. Make a scratch mutation in the changed product guard, using the runner's mutation mechanism or an isolated worktree. Require the predicted semantic failure, restore the guard, and require a passing baseline.
6. After confirming correspondence, update `coverage.json` source SHA256 values and its full `syncCommit`. Update the sync commit above in the same change. Use a commit whose product source exactly matches the checked source. A verification-only descendant may retain the earlier sync commit.
7. Report `in sync`, `updated`, `bug`, or `blocked` for each check. Keep verification changes separate from product fixes.

The source digest gate deliberately fails after any covered source edit. A passing bridge alone does not authorize moving the sync record. Inspect the changed code and action map first.

## Scope

TLC exhausts two finite models, not the TypeScript program. The server model has two owners, one lesson, two requests, Boolean studied values, two mutation IDs, initial revisions 0 or 1, and expected revisions 0 or 1. The client model has two owners, one refresh, one write completion, one read completion, and revisions 0 through 2. Every enabled interleaving within those bounds is checked. See the README for atomicity, environmental assumptions, and omitted behavior.

The bridge checks enumerated schedules of actual code. It supplies trusted identities directly and proves no hosted authentication claim. It does not drive UI. For browser and release evidence, use the separate project [verify skill](../verify/SKILL.md).
