import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  COMPARE_FILE_CAP,
  compareFailedErrors,
  EXAMPLE,
  MATH_EXAMPLE,
  mathReviewErrors,
  reviewerErrors,
  skillsUsedErrors,
  staleMathErrors,
  verifiedHeadErrors,
  verifierErrors,
} from './evidence-rules.mjs';

const head = '0747d3d290bf08c57b35fb458c8d410994137dad';
const oldHead = '1b4a785399e55446fb71214551587e77c95bab6f';
const first = `R1 codex gpt-6.1-sol effort max CLEAN (session /root/reviewer_one) on ${head}`;
const second = `R2 codex gpt-6.1-sol effort max CLEAN (session /root/reviewer_two) on ${head}`;
const verifier = `VERIFIED codex gpt-6.1-sol effort max (session /root/verifier) on ${head}`;
const math = `clean - codex gpt-6.1-sol effort max (session /root/math_check) on ${head}`;
const pr18 = readFileSync('scripts/fixtures/pr18-review-line.txt', 'utf8');
const pr13 = JSON.parse(
  readFileSync('scripts/fixtures/pr13-math-review.json', 'utf8'),
);

test('PR #18: a lead-only review with dropped reviewers fails', () => {
  const field = /^- Reviewer verdicts:\s*(.+)$/m.exec(pr18)?.[1];
  assert.equal(field, undefined);
  assert.ok(reviewerErrors(field, head).length > 0);
});

test('two completed Codex reviewers on the exact head pass', () => {
  assert.deepEqual(reviewerErrors(`${first}; ${second}`, head), []);
  assert.deepEqual(reviewerErrors(EXAMPLE, head), []);
});

test('one completed reviewer is insufficient', () => {
  assert.match(reviewerErrors(first, head).join('\n'), /at least 2/);
});

test('CHANGES NEEDED fails even when the other reviewer is clean', () => {
  assert.match(
    reviewerErrors(
      `${first}; ${second.replace('CLEAN', 'CHANGES NEEDED')}`,
      head,
    ).join('\n'),
    /reported CHANGES NEEDED/,
  );
});

test('dropped, silent and annotated reviewers fail', () => {
  for (const bad of [
    'R2 dropped before reporting',
    second.replace('CLEAN', 'CLEAN (silent)'),
    second.replace('CLEAN', 'CLEAN, not reported'),
    `${second}; no verdict`,
  ])
    assert.match(
      reviewerErrors(`${first}; ${bad}`, head).join('\n'),
      /must have the form/,
      bad,
    );
});

test('reviewer numbers and full session identities must be distinct', () => {
  assert.match(
    reviewerErrors(`${first}; ${second.replace('R2', 'R1')}`, head).join('\n'),
    /R1 twice/,
  );
  assert.match(
    reviewerErrors(
      `${first}; ${second.replace('/root/reviewer_two', '/root/reviewer_one')}`,
      head,
    ).join('\n'),
    /repeats session/,
  );
  assert.match(
    reviewerErrors(`${first}; ${second}`, head, '/root/reviewer_one').join(
      '\n',
    ),
    /separate independent sessions/,
  );
});

test('full UUIDs and nested canonical Codex task identities are accepted', () => {
  for (const session of [
    '5e19ac26-2c3f-4de0-9840-96c135a1e1b8',
    '/root/review_round/reviewer_one',
  ])
    assert.deepEqual(
      reviewerErrors(
        `${first.replace('/root/reviewer_one', session)}; ${second}`,
        head,
      ),
      [],
    );
});

test('full sessions sharing an eight-character prefix remain distinct', () => {
  const one = first.replace(
    '/root/reviewer_one',
    '5e19ac26-2c3f-4de0-9840-96c135a1e1b8',
  );
  const two = second.replace(
    '/root/reviewer_two',
    '5e19ac26-2c3f-4de0-9840-96c135a1e1b9',
  );
  assert.deepEqual(reviewerErrors(`${one}; ${two}`, head), []);
});

test('truncated, malformed, nil and noncanonical identities fail', () => {
  for (const session of [
    '5e19ac26',
    '5e19ac26-2c3f',
    '5e19ac26-2c3f-4de0-9840-96c135a1e1b8-',
    '5E19AC26-2C3F-4DE0-9840-96C135A1E1B8',
    '00000000-0000-0000-0000-000000000000',
    '/root',
    '/root/reviewer-one',
    '/root/reviewer_one/',
  ])
    assert.ok(
      reviewerErrors(
        `${first}; ${second.replace('/root/reviewer_two', session)}`,
        head,
      ).length > 0,
      session,
    );
});

test('legacy aliases, omitted effort and unsupported effort fail', () => {
  for (const bad of [
    second.replace('R2', 'R02'),
    second.replace('(session ', '(task '),
    second.replace(' effort max', ''),
    second.replace('effort max', 'effort inherit'),
    second.replace('codex ', 'unknown-runner '),
  ])
    assert.match(
      reviewerErrors(`${first}; ${bad}`, head).join('\n'),
      /must have the form/,
      bad,
    );
});

test('Cursor remains usable with a full UUID and explicit model and effort', () => {
  const cursor = second
    .replace('codex', 'cursor-agent')
    .replace('/root/reviewer_two', '3cbed3fe-2c3f-4de0-9840-96c135a1e1b8');
  assert.deepEqual(reviewerErrors(`${first}; ${cursor}`, head), []);
  assert.ok(
    reviewerErrors(`${first}; ${second.replace('codex', 'cursor-agent')}`, head)
      .length > 0,
  );
});

test('stale and shortened reviewer head SHAs fail', () => {
  assert.match(
    reviewerErrors(`${first}; ${second.replace(head, oldHead)}`, head).join(
      '\n',
    ),
    /must review the current head/,
  );
  assert.ok(
    reviewerErrors(`${first}; ${second.replace(head, head.slice(0, 7))}`, head)
      .length > 0,
  );
});

test('verifier requires a complete independent exact-head record', () => {
  assert.deepEqual(verifierErrors(verifier, head), {
    errors: [],
    session: '/root/verifier',
  });
  for (const bad of [
    'VERIFIED by the lead',
    verifier.replace('VERIFIED', 'INCONCLUSIVE'),
    verifier.replace('VERIFIED', 'NOT VERIFIED'),
    verifier.replace(head, head.slice(0, 7)),
    verifier.replace(head, oldHead),
    verifier.replace('/root/verifier', '5e19ac26'),
  ])
    assert.ok(verifierErrors(bad, head).errors.length > 0, bad);
});

test('the verified-head field requires the exact full head', () => {
  assert.deepEqual(verifiedHeadErrors(head, head), []);
  for (const bad of ['', head.slice(0, 7), `${head}0`, oldHead])
    assert.ok(verifiedHeadErrors(bad, head).length > 0, bad);
});

test('skills record the actual runner, model and effort', () => {
  assert.deepEqual(
    skillsUsedErrors(
      'poteto-mode, verify-probability, interrogate; runner codex, model gpt-6.1-sol, effort max',
    ),
    [],
  );
  for (const bad of [
    'verify-probability',
    'verify-probability; runner codex, model gpt-6.1-sol',
    'verify-probability; runner codex, model gpt-6.1-sol, effort unknown',
    'poteto-mode; runner codex, model gpt-6.1-sol, effort max',
  ])
    assert.ok(skillsUsedErrors(bad).length > 0, bad);
});

test('PR #13: free-text math review fails the fixed form', () => {
  assert.match(
    mathReviewErrors(pr13.mathReview).errors.join('\n'),
    /must read/,
  );
});

test('PR #13: changed lesson text after the math check fails', () => {
  assert.match(
    staleMathErrors(head, pr13.compare, pr13.prFiles).join('\n'),
    /content changed after the math check .*src\/content\/part07\.json/,
  );
});

test('clean math records require the full checked commit', () => {
  assert.deepEqual(mathReviewErrors(MATH_EXAMPLE), { errors: [], sha: head });
  assert.deepEqual(mathReviewErrors(math), { errors: [], sha: head });
  assert.deepEqual(
    staleMathErrors(head, { status: 'identical', files: [] }, pr13.prFiles),
    [],
  );
});

test('only lesson files this PR changes affect math freshness', () => {
  assert.deepEqual(
    staleMathErrors(
      head,
      {
        status: 'ahead',
        files: ['src/content/part03.json', 'scripts/x.mjs', 'baseline.png'],
      },
      pr13.prFiles,
    ),
    [],
  );
});

test('a non-ancestor math commit fails', () => {
  for (const status of ['behind', 'diverged'])
    assert.match(
      staleMathErrors(head, { status, files: [] }, pr13.prFiles).join('\n'),
      /not an ancestor of the head/,
    );
});

test('incomplete and failed math records fail', () => {
  for (const bad of [
    'clean',
    math.replace(' effort max', ''),
    math.replace(head, head.slice(0, 7)),
    math.replace(head, `${head}z`),
    math.replace('clean', 'CHANGES NEEDED'),
    math.replace('/root/math_check', '74c693ac'),
    math.replace('/root/math_check', '00000000-0000-0000-0000-000000000000'),
    `${math}, then edited`,
  ])
    assert.ok(mathReviewErrors(bad).errors.length > 0, bad);
});

test('a failed GitHub compare names its error and correction', () => {
  assert.match(
    compareFailedErrors(head, 'gh: Not Found (HTTP 404)\n').join('\n'),
    /was not found on GitHub .*push it, or run an independent math check/,
  );
  assert.match(
    compareFailedErrors(head, 'gh: Service Unavailable (HTTP 503)').join('\n'),
    /could not compare .*HTTP 503.*re-run the evidence job/,
  );
});

test("a compare at GitHub's file cap fails closed", () => {
  const files = Array.from({ length: COMPARE_FILE_CAP }, (_, i) => `f${i}`);
  assert.match(
    staleMathErrors(head, { status: 'ahead', files }, pr13.prFiles).join('\n'),
    /lists 300 files, GitHub's cap/,
  );
});
