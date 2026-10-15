## Intent

<!-- What and why, one paragraph. -->

## Done predicate

<!-- The falsifiable check that says this is finished. -->

## Pre-review self-check

<!-- The authoring-time checks you ran before asking for review, each with its result: npm run check (and which parts), test counts, smoke screenshots, check:results, and for content PRs the authoring-time math checker. Name anything you did not run. -->

## Verification

- Verifier verdict: <!-- VERIFIED / NOT VERIFIED / INCONCLUSIVE — by whom, using verify-probability -->
- Verified head: <!-- short SHA of the head that was verified -->
- Review: <!-- clean / open items — multi-model review summary (Act on / Consider / Noted / Dismissed) -->
- Reviewer verdicts: <!-- one entry per review session, “;”-separated, exactly: R1 grok-4.7-high CLEAN (session <id>); R2 grok-4.7-high CHANGES NEEDED (session <id>). <id> is the session= id scripts/agent-run.sh printed. Each reviewer is its own top-level session (scripts/agent-run.sh review, no Task subagents), run one at a time; rerun any that dropped the same way. Notes go in Review. -->
- Math review: <!-- content PRs, exactly: clean — grok-4.7-high (session <id>) on <sha>; then notes (what was checked against which sources). <id> is the session= id scripts/agent-run.sh math printed; <sha> the commit it checked. Run it while authoring, before verifier and reviewers, and again after any later lesson edit: the evidence job fails if a lesson file this PR changes differs at the head. -->
- Verify evidence: <!-- CI run URL (verify-evidence artifact) + the screenshots you opened and inspected, e.g. lessons/open.desktop.png -->
- Skills used: <!-- e.g. poteto-mode, verify-probability, interrogate — runner cursor-agent, model and effort as grok-4.7 tiers per role (e.g. verifier grok-4.7-high) -->
- Evidence: <!-- CI run URL, smoke drives, artifacts, transcripts -->

## Feature map entries touched

<!-- features/*.md, smoke.json steps -->

## Couldn't do

<!-- Anything skipped or blocked, and why. -->
