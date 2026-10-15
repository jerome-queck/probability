// Pure rules used by scripts/check-evidence.mjs, kept here so they can be tested on real PR bodies.

// “Reviewer verdicts:” lists every review session the lead spawned, separated by “;”. Each entry
// names the reviewer, its grok-4.7 model and the verdict it reported itself. A reviewer that
// dropped, timed out or never reported does not count: rerun it before merging.
export const MIN_REVIEWERS = 2;
const VERDICT = /\b(CLEAN|CHANGES NEEDED)\b/;
const MISSING =
  /\b(dropped|timed? ?out|no report|not report|never reported|did not return|pending|missing|n\/a)\b/i;

export function reviewerErrors(line) {
  const entries = (line ?? '')
    .split(';')
    .map((e) => e.trim())
    .filter(Boolean);
  const errors = [];
  if (entries.length < MIN_REVIEWERS)
    errors.push(
      `“Reviewer verdicts:” must list each review session (at least ${MIN_REVIEWERS}, “;”-separated) with its model and its own verdict; rerun any reviewer that dropped before merging`,
    );
  for (const e of entries) {
    if (MISSING.test(e) || !VERDICT.test(e))
      errors.push(
        `“Reviewer verdicts:” entry “${e}” has no reported verdict (CLEAN or CHANGES NEEDED); rerun that reviewer`,
      );
    else if (!/grok-4\.7-(low|medium|high)\b/.test(e))
      errors.push(
        `“Reviewer verdicts:” entry “${e}” must name its model (grok-4.7-<tier>)`,
      );
  }
  return errors;
}
