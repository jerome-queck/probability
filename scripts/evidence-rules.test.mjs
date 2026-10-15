import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { reviewerErrors } from './evidence-rules.mjs';

// PR #18's merged body: the review line says both second-opinion sessions dropped, and there
// was no per-reviewer record. That merge should not have passed.
const pr18 = readFileSync('scripts/fixtures/pr18-review-line.txt', 'utf8');

test('PR #18: a lead-only review with dropped reviewers fails', () => {
  const field = /^- Reviewer verdicts:\s*(.+)$/m.exec(pr18)?.[1];
  assert.equal(field, undefined);
  assert.ok(reviewerErrors(field).length > 0);
});

const ok =
  'R1 grok-4.7-high CLEAN (session 5e19ac26-2c3f); R2 grok-4.7-high CHANGES NEEDED (session 3cbed3fe)';

test('every reviewer reported, in the fixed form: passes', () => {
  assert.deepEqual(reviewerErrors(ok), []);
});

test('one reviewer is not enough', () => {
  assert.match(
    reviewerErrors('R1 grok-4.7-high CLEAN (session 5e19ac26)').join('\n'),
    /at least 2/,
  );
});

// Every phrasing the verifiers of #20 got past the earlier word-matching rules (r1, r2).
test('dropped, silent or annotated entries fail', () => {
  for (const bad of [
    'R2 grok-4.7-high dropped before reporting',
    'R2 grok-4.7-high CLEAN (silent)',
    'R2 grok-4.7-high CLEAN (timed-out)',
    'R2 grok-4.7-high CLEAN, not reported',
    'R2 grok-4.7-high CLEAN, silently',
    'R2 grok-4.7-high CLEAN (no verdicts)',
    'R2 CLEAN (session 3cbed3fe)',
  ])
    assert.match(
      reviewerErrors(`R1 grok-4.7-high CLEAN (session 5e19ac26); ${bad}`).join(
        '\n',
      ),
      /must read exactly/,
      bad,
    );
});

test('-fast, xhigh and slash tiers fail', () => {
  for (const t of [
    'grok-4.7-high-fast',
    'grok-4.7-xhigh',
    'grok-4.7-high/fast',
  ])
    assert.match(
      reviewerErrors(
        `R1 grok-4.7-high CLEAN (session 5e19ac26); R2 ${t} CLEAN (session 3cbed3fe)`,
      ).join('\n'),
      /must read exactly/,
      t,
    );
});

test('the same reviewer twice does not make two', () => {
  assert.match(
    reviewerErrors(
      'R1 grok-4.7-high CLEAN (session 5e19ac26); R1 grok-4.7-high CLEAN (session 5e19ac27)',
    ).join('\n'),
    /R1 twice/,
  );
});
