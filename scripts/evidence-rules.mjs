// Pure rules used by scripts/check-evidence.mjs, kept here so they can be tested on real PR bodies.

// “Reviewer verdicts:” lists every review session, separated by “;”. Each entry has exactly one
// form, with no free text, so a dropped or silent reviewer cannot be dressed up as a pass:
//   R<n> grok-4.7-<low|medium|high> <CLEAN|CHANGES NEEDED> (session <id>)
// Notes about the review go in “Review:”. A reviewer that dropped, timed out or never reported
// has no verdict to write here: rerun it before merging.
export const MIN_REVIEWERS = 2;
export const ENTRY =
  /^R(\d+) grok-4\.7-(low|medium|high) (CLEAN|CHANGES NEEDED) \((?:session|task) [0-9a-f]{8}[0-9a-f-]*\)$/;

export function reviewerErrors(line) {
  const entries = (line ?? '')
    .split(';')
    .map((e) => e.trim())
    .filter(Boolean);
  const errors = [];
  if (entries.length < MIN_REVIEWERS)
    errors.push(
      `“Reviewer verdicts:” must list each review session (at least ${MIN_REVIEWERS}, “;”-separated); rerun any reviewer that dropped before merging`,
    );
  const seen = new Set();
  for (const e of entries) {
    const m = ENTRY.exec(e);
    if (!m)
      errors.push(
        `“Reviewer verdicts:” entry “${e}” must read exactly “R<n> grok-4.7-<low|medium|high> <CLEAN|CHANGES NEEDED> (session <id>)”; a reviewer without its own reported verdict is rerun, and notes go in “Review:”`,
      );
    else if (seen.has(m[1]))
      errors.push(`“Reviewer verdicts:” lists R${m[1]} twice`);
    else seen.add(m[1]);
  }
  return errors;
}
