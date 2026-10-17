export const MIN_REVIEWERS = 2;
export const FULL_SHA = /^[0-9a-f]{40}$/;
const MODEL = '[a-z][a-z0-9]*(?:[._:/-][a-z0-9]+)*';
const EFFORT = 'none|minimal|low|medium|high|xhigh|max|ultra';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const SESSION = `(?:${UUID}|/root(?:/[a-z][a-z0-9_]*)+)`;
const RUN = `(?<runner>codex|cursor-agent) (?<model>${MODEL}) effort (?<effort>${EFFORT})`;
const SOURCE = `\\(session (?<session>${SESSION})\\) on (?<sha>[0-9a-f]{40})`;
export const ENTRY = new RegExp(
  `^R(?<number>[1-9]\\d*) ${RUN} (?<verdict>CLEAN|CHANGES NEEDED) ${SOURCE}$`,
);
const VERIFIER_ENTRY = new RegExp(`^VERIFIED ${RUN} ${SOURCE}$`);
const EXAMPLE_SHA = '0747d3d290bf08c57b35fb458c8d410994137dad';
export const EXAMPLE = `R1 codex gpt-6.1-sol effort max CLEAN (session /root/reviewer_one) on ${EXAMPLE_SHA}; R2 codex gpt-6.1-sol effort max CLEAN (session /root/reviewer_two) on ${EXAMPLE_SHA}`;
export const RERUN =
  'rerun a dropped or failed reviewer in an independent session, then record its actual runner, model, effort, full session identity and reviewed head';

function sessionErrors(record, label) {
  return /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(record.session) ||
    (record.runner === 'cursor-agent' && record.session.startsWith('/'))
    ? [`${label} must name the full actual runner session identity`]
    : [];
}

export function verifiedHeadErrors(value, head) {
  return FULL_SHA.test(value) && value === head
    ? []
    : [`“Verified head:” must name the full current head ${head}`];
}

export function verifierErrors(line, head) {
  const record = VERIFIER_ENTRY.exec((line ?? '').trim())?.groups;
  if (!record)
    return {
      errors: [
        '“Verifier verdict:” must read “VERIFIED <runner> <model> effort <effort> (session <full identity>) on <full head SHA>”',
      ],
      session: null,
    };
  const errors = sessionErrors(record, '“Verifier verdict:”');
  if (record.sha !== head)
    errors.push(`the verifier must verify the current head ${head}`);
  return { errors, session: record.session };
}

export function skillsUsedErrors(line) {
  const run = new RegExp(
    `\\brunner (?:codex|cursor-agent), model ${MODEL}, effort (?:${EFFORT})(?:;|$)`,
  );
  return /\bverify-probability\b/.test(line) && run.test(line)
    ? []
    : [
        '“Skills used:” must list the skills used (at least verify-probability) and “runner <runner>, model <model>, effort <effort>”',
      ];
}

export function reviewerErrors(line, head, verifierSession) {
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
    const record = ENTRY.exec(e)?.groups;
    if (!record) {
      errors.push(
        `“Reviewer verdicts:” entry “${e}” must have the form “R1 <runner> <model> effort <effort> CLEAN (session <full identity>) on <full head SHA>”; notes go in “Review:”; ${RERUN}`,
      );
      continue;
    }
    if (seen.has(record.number))
      errors.push(
        `“Reviewer verdicts:” lists R${record.number} twice; number each reviewer once`,
      );
    if (sessions.has(record.session) || record.session === verifierSession)
      errors.push(
        `“Reviewer verdicts:” repeats session ${record.session}; the verifier and each reviewer need separate independent sessions; ${RERUN}`,
      );
    if (record.verdict !== 'CLEAN')
      errors.push(
        `R${record.number} reported CHANGES NEEDED; resolve the findings and obtain a clean independent review`,
      );
    if (record.sha !== head)
      errors.push(`R${record.number} must review the current head ${head}`);
    errors.push(...sessionErrors(record, `R${record.number}`));
    seen.add(record.number);
    sessions.add(record.session);
  }
  return errors;
}

export const MATH_EXAMPLE = `clean - codex gpt-6.1-sol effort max (session /root/math_check) on ${EXAMPLE_SHA}; every value recomputed`;
export const MATH_ENTRY = new RegExp(
  `^clean (?:—|-) ${RUN} ${SOURCE}(?:;.*)?$`,
);
export const MATH_RERUN =
  'run an independent math check on the head and record its actual runner, model, effort, full session identity and full checked commit SHA';

// Returns { errors, sha } for the “Math review:” field.
export function mathReviewErrors(line) {
  const record = MATH_ENTRY.exec((line ?? '').trim())?.groups;
  if (!record)
    return {
      errors: [
        `content changed: “Math review:” must read “${MATH_EXAMPLE}”; ${MATH_RERUN}`,
      ],
      sha: null,
    };
  const errors = sessionErrors(record, '“Math review:”');
  return { errors, sha: errors.length ? null : record.sha };
}

// compare: GitHub's compare of <sha>...<head> ({ status, files: [filename] }); prFiles: the
// PR's changed files. Fails when the checked commit is not an ancestor of the head, or when a
// lesson file the PR changes differs between them.
// GitHub's compare lists at most this many files; a full list may be truncated.
export const COMPARE_FILE_CAP = 300;

export function staleMathErrors(sha, compare, prFiles) {
  if (compare.files.length >= COMPARE_FILE_CAP)
    return [
      `content changed: the compare of the math check's commit ${sha} with the head lists ${compare.files.length} files, GitHub's cap, so it may be incomplete; ${MATH_RERUN}`,
    ];
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

// A compare that could not run (gh exited non-zero). stderr carries GitHub's own error line.
export function compareFailedErrors(sha, stderr) {
  const reason =
    String(stderr ?? '')
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('gh:')) ?? 'no error from gh';
  return /HTTP (404|422)\b/.test(reason)
    ? [
        `content changed: the math check's commit ${sha} was not found on GitHub (${reason}); push it, or ${MATH_RERUN}`,
      ]
    : [
        `could not compare the math check's commit ${sha} with the head (${reason}); re-run the evidence job`,
      ];
}
