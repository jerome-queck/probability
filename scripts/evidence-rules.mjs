// Pure rules used by scripts/check-evidence.mjs, kept here so they can be tested on real PR bodies.

// “Reviewer verdicts:” lists every review session, separated by “;”. Each entry has exactly one
// form, with no free text, so a dropped or silent reviewer cannot be dressed up as a pass:
//   R<n> grok-4.7-<low|medium|high> <CLEAN|CHANGES NEEDED> (session <id>)
// Notes about the review go in “Review:”. A reviewer that dropped, timed out or never reported
// has no verdict to write here: rerun it as its own top-level session before merging.
export const MIN_REVIEWERS = 2;
// The session id is the cursor-agent session_id (lowercase hex), its first 8 digits at least.
export const ENTRY =
  /^R([1-9]\d*) grok-4\.7-(low|medium|high) (CLEAN|CHANGES NEEDED) \(session ([0-9a-f]{8})((?:-[0-9a-f]+)*)\)$/;

// Shown in the errors. EXAMPLE passes this check as written (tested).
export const EXAMPLE =
  'R1 grok-4.7-high CLEAN (session 5e19ac26); R2 grok-4.7-high CHANGES NEEDED (session 3cbed3fe)';
export const RERUN =
  'rerun a dropped reviewer as its own top-level session (scripts/agent-run.sh review <prompt> <out>, no Task subagents), one reviewer at a time, and list the session= id it prints';

export function reviewerErrors(line) {
  const entries = (line ?? '')
    .split(';')
    .map((e) => e.trim())
    .filter(Boolean);
  const errors = [];
  if (entries.length < MIN_REVIEWERS)
    errors.push(
      `“Reviewer verdicts:” must list each review session (at least ${MIN_REVIEWERS}, “;”-separated), e.g. “${EXAMPLE}”; ${RERUN}`,
    );
  const seen = new Set();
  const sessions = new Set();
  for (const e of entries) {
    const m = ENTRY.exec(e);
    if (!m)
      errors.push(
        `“Reviewer verdicts:” entry “${e}” must have the form “R1 grok-4.7-high CLEAN (session 5e19ac26)”: R and a number from 1, the tier (low, medium or high), CLEAN or CHANGES NEEDED, and the lowercase session id agent-run.sh printed (8 hex digits or more); notes go in “Review:”. A reviewer without its own reported verdict: ${RERUN}`,
      );
    else if (seen.has(m[1]))
      errors.push(
        `“Reviewer verdicts:” lists R${m[1]} twice; number the reviewers R1, R2, … once each`,
      );
    // One session is one review, whatever number it is listed under.
    else if (sessions.has(m[4]))
      errors.push(
        `“Reviewer verdicts:” lists session ${m[4]} twice; each reviewer is its own session, so ${RERUN}`,
      );
    else if (/^0+$/.test(m[4]))
      errors.push(
        `“Reviewer verdicts:” session ${m[4]} is not a real session id; use the session= id agent-run.sh printed for that reviewer`,
      );
    else {
      seen.add(m[1]);
      sessions.add(m[4]);
    }
  }
  return errors;
}
