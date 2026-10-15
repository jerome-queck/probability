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

test('a dropped reviewer fails even when listed', () => {
  const errors = reviewerErrors(
    'R1 grok-4.7-high CLEAN (task a1); R2 grok-4.7-high dropped before reporting',
  );
  assert.match(errors.join('\n'), /R2 .* has no reported verdict/);
});

test('one reviewer is not enough', () => {
  assert.match(
    reviewerErrors('R1 grok-4.7-high CLEAN (task a1)').join('\n'),
    /at least 2/,
  );
});

test('every reviewer reported, with model and verdict: passes', () => {
  assert.deepEqual(
    reviewerErrors(
      'R1 grok-4.7-high CLEAN (task a1); R2 grok-4.7-high CHANGES NEEDED, one Consider, dismissed by the lead (task b2)',
    ),
    [],
  );
});

test('an entry without a model fails', () => {
  assert.match(
    reviewerErrors('R1 CLEAN; R2 grok-4.7-high CLEAN').join('\n'),
    /must name its model/,
  );
});
