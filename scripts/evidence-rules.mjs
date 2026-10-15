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

// “Math review:” (content PRs) names the math-check session and the commit whose lesson text it
// checked, in one fixed form, then any notes after “;”:
//   clean — grok-4.7-<low|medium|high> (session <id>) on <sha>; notes
// The math check runs while authoring, before the verifier and reviewers, and again after any
// later change to the lesson text: check-evidence fails when a lesson file this PR changes is
// different at the head than at <sha> (PR #13 merged with E03 edited after its math check).
export const MATH_EXAMPLE =
  'clean — grok-4.7-high (session 74c693ac) on 7b6bf0c; every value recomputed';
export const MATH_ENTRY =
  /^clean\s*(?:—|-|:)\s*grok-4\.7-(low|medium|high) \(session ([0-9a-f]{8})(?:-[0-9a-f]+)*\) on ([0-9a-f]{7,40})(?![0-9a-z])\s*(?:;|$)/;
export const MATH_RERUN =
  'run the math check on the head (scripts/agent-run.sh math <prompt> <out>) and record its session= id and the commit it checked';

// Returns { errors, sha } for the “Math review:” field.
export function mathReviewErrors(line) {
  const m = MATH_ENTRY.exec((line ?? '').trim());
  if (!m)
    return {
      errors: [
        `content changed: “Math review:” must read “${MATH_EXAMPLE}”: clean, the math checker's tier, the session= id agent-run.sh printed and the commit whose lesson text it checked, then notes after “;”; ${MATH_RERUN}`,
      ],
      sha: null,
    };
  if (/^0+$/.test(m[2]))
    return {
      errors: [
        `content changed: “Math review:” session ${m[2]} is not a real session id; ${MATH_RERUN}`,
      ],
      sha: null,
    };
  return { errors: [], sha: m[3] };
}

// compare: GitHub's compare of <sha>...<head> ({ status, files: [filename] }); prFiles: the
// PR's changed files. Fails when the checked commit is not an ancestor of the head, or when a
// lesson file the PR changes differs between them.
export function staleMathErrors(sha, compare, prFiles) {
  if (!['ahead', 'identical'].includes(compare.status))
    return [
      `content changed: the math check's commit ${sha} is not an ancestor of the head (compare status “${compare.status}”); ${MATH_RERUN}`,
    ];
  const lessons = new Set(prFiles.filter((f) => f.startsWith('src/content/')));
  const changed = compare.files.filter((f) => lessons.has(f));
  return changed.length
    ? [
        `content changed after the math check on ${sha}: ${changed.join(', ')}; ${MATH_RERUN}`,
      ]
    : [];
}
