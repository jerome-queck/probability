## Intent

<!-- What and why, one paragraph. -->

## Done predicate

<!-- The falsifiable check that says this is finished. -->

## Pre-review self-check

<!-- The authoring-time checks you ran before asking for review, each with its result: npm run check (and which parts), test counts, smoke screenshots, check:results, and for content PRs the authoring-time math checker. Name anything you did not run. -->

## Verification

- Verifier verdict: <!-- VERIFIED <runner> <model> effort <effort> (session <full identity>) on <full head SHA>. Independent verifier using verify-probability. Example syntax uses runner codex, model gpt-6.1-sol, effort max. Record the actual configured values. -->
- Verified head: <!-- full 40-character SHA of the current head -->
- Review: <!-- clean / open items; independent review summary and resolved findings. A clean summary cannot override CHANGES NEEDED. -->
- Reviewer verdicts: <!-- one entry per completed independent session, separated by “;”: R1 codex gpt-6.1-sol effort max CLEAN (session /root/reviewer_one) on <full head SHA>; R2 codex gpt-6.1-sol effort max CLEAN (session /root/reviewer_two) on <full head SHA>. These are syntax examples, not receipts. Use actual runner/model/effort and full Codex UUID or canonical task path. Cursor runner cursor-agent requires its full UUID. Each reviewer and the verifier must be separate sessions that did not author the change. Rerun dropped reviewers. Every verdict must be CLEAN. Notes go in Review. -->
- Math review: <!-- content PRs: clean - <runner> <model> effort <effort> (session <full identity>) on <full checked commit SHA>; source check and corrections. Run independently while authoring, before verification/review, and again after any lesson edit. The checked commit must be an ancestor with unchanged PR lesson text at the head. -->
- Verify evidence: <!-- Every PR: successful check workflow run URL for the exact current head, with a nonempty, nonexpired verify-evidence artifact, plus the screenshots you opened and inspected, e.g. lessons/open.desktop.png -->
- Skills used: <!-- e.g. poteto-mode, verify-probability, interrogate; runner codex, model gpt-6.1-sol, effort max. Record actual runner, model and effort for each role that differs. -->
- Evidence: <!-- CI run URL, smoke drives, artifacts, transcripts -->

## Feature map entries touched

<!-- features/*.md, smoke.json steps -->

## Couldn't do

<!-- Anything skipped or blocked, and why. -->
