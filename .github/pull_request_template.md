## Intent

<!-- What and why, one paragraph. -->

## Done predicate

<!-- The falsifiable check that says this is finished. -->

## Verification

- Verifier verdict: <!-- VERIFIED / NOT VERIFIED / INCONCLUSIVE — by whom, using verify-probability -->
- Verified head: <!-- short SHA of the head that was verified -->
- Review: <!-- clean / open items — multi-model review summary (Act on / Consider / Noted / Dismissed) -->
- Reviewer verdicts: <!-- one entry per review session, “;”-separated, exactly: R1 grok-4.7-high CLEAN (session <id>); R2 grok-4.7-high CHANGES NEEDED (session <id>). <id> is the session= id scripts/agent-run.sh printed. Each reviewer is its own top-level session (scripts/agent-run.sh review, no Task subagents), run one at a time; rerun any that dropped the same way. Notes go in Review. -->
- Math review: <!-- content PRs: clean — independent reviewer, what was checked against which sources -->
- Verify evidence: <!-- CI run URL (verify-evidence artifact) + the screenshots you opened and inspected, e.g. lessons/open.desktop.png -->
- Skills used: <!-- e.g. poteto-mode, verify-probability, interrogate — runner cursor-agent, model and effort as grok-4.7 tiers per role (e.g. verifier grok-4.7-high) -->
- Evidence: <!-- CI run URL, smoke drives, artifacts, transcripts -->

## Feature map entries touched

<!-- features/*.md, smoke.json steps -->

## Couldn't do

<!-- Anything skipped or blocked, and why. -->
