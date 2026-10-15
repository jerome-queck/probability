// Pure rules used by scripts/check-evidence.mjs, kept here so they can be tested on real PR bodies.

// “Reviewer verdicts:” lists every review session, separated by “;”. Each entry has exactly one
// form, with no free text, so a dropped or silent reviewer cannot be dressed up as a pass:
//   R<n> grok-4.7-<low|medium|high> <CLEAN|CHANGES NEEDED> (session <id>)
// Notes about the review go in “Review:”. A reviewer that dropped, timed out or never reported
// has no verdict to write here: rerun it before merging.
export const MIN_REVIEWERS = 2;
// The session id is the cursor-agent session_id (lowercase hex), its first 8 digits at least.
export const ENTRY =
  /^R([1-9]\d*) grok-4\.7-(low|medium|high) (CLEAN|CHANGES NEEDED) \(session ([0-9a-f]{8})((?:-[0-9a-f]+)*)\)$/;

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
  const sessions = new Set();
  for (const e of entries) {
    const m = ENTRY.exec(e);
    if (!m)
      errors.push(
        `“Reviewer verdicts:” entry “${e}” must read exactly “R<n> grok-4.7-<low|medium|high> <CLEAN|CHANGES NEEDED> (session <id>)”; a reviewer without its own reported verdict is rerun, and notes go in “Review:”`,
      );
    else if (seen.has(m[1]))
      errors.push(`“Reviewer verdicts:” lists R${m[1]} twice`);
    // One session is one review, whatever number it is listed under.
    else if (sessions.has(m[4]))
      errors.push(
        `“Reviewer verdicts:” lists session ${m[4]} twice; each reviewer is its own session`,
      );
    else if (/^0+$/.test(m[4]))
      errors.push(
        `“Reviewer verdicts:” session ${m[4]} is not a real session id`,
      );
    else {
      seen.add(m[1]);
      sessions.add(m[4]);
    }
  }
  return errors;
}
