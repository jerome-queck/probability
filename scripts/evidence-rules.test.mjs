import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { EXAMPLE, reviewerErrors } from './evidence-rules.mjs';

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
      /must have the form/,
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
      /must have the form/,
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

// Found by #20 verifier r3: one session listed twice, R01 beside R1, a task id, a zero id or a
// trailing hyphen all counted as separate reported reviewers.
test('one session listed twice does not make two reviewers', () => {
  for (const second of ['5e19ac26', '5e19ac26-2c3f'])
    assert.match(
      reviewerErrors(
        `R1 grok-4.7-high CLEAN (session 5e19ac26); R2 grok-4.7-high CLEAN (session ${second})`,
      ).join('\n'),
      /session 5e19ac26 twice/,
      second,
    );
});

test('R01, task ids, zero ids and trailing hyphens fail', () => {
  for (const bad of [
    'R01 grok-4.7-high CLEAN (session 3cbed3fe)',
    'R2 grok-4.7-high CLEAN (task 3cbed3fe)',
    'R2 grok-4.7-high CLEAN (session 3cbed3fe-)',
    'R2 grok-4.7-high CLEAN (session 3CBED3FE)',
  ])
    assert.match(
      reviewerErrors(`R1 grok-4.7-high CLEAN (session 5e19ac26); ${bad}`).join(
        '\n',
      ),
      /must have the form/,
      bad,
    );
  assert.match(
    reviewerErrors(
      'R1 grok-4.7-high CLEAN (session 5e19ac26); R2 grok-4.7-high CLEAN (session 00000000)',
    ).join('\n'),
    /not a real session id/,
  );
});

// PR #20 reviewer 2 (081b7938): the shape the errors showed did not pass the check, and the
// "rerun" advice did not say how, so an agent reran the same dropping Task path.
test('every error shows a form that passes and says how to rerun', () => {
  assert.deepEqual(reviewerErrors(EXAMPLE), []);
  const cases = {
    missing: reviewerErrors(undefined),
    malformed: reviewerErrors(
      'R1 grok-4.7-high CLEAN (session 5e19ac26); R2 dropped',
    ),
    sameSession: reviewerErrors(
      'R1 grok-4.7-high CLEAN (session 5e19ac26); R2 grok-4.7-high CLEAN (session 5e19ac26)',
    ),
  };
  for (const [name, errors] of Object.entries(cases)) {
    const text = errors.join('\n');
    assert.match(text, /own top-level session/, name);
    assert.match(text, /one reviewer at a time/, name);
    assert.match(text, /no Task subagents/, name);
  }
  // The form quoted in the malformed-entry error passes as written (with a second reviewer).
  const quoted = /form “([^”]+)”/.exec(cases.malformed.join('\n'))?.[1];
  assert.ok(quoted);
  assert.deepEqual(
    reviewerErrors(
      `${quoted}; ${quoted.replace('R1', 'R2').replace('5e19ac26', '3cbed3fe')}`,
    ),
    [],
  );
  assert.ok(cases.missing.join('\n').includes(EXAMPLE));
});

test('duplicate number and fake id errors name the correction', () => {
  assert.match(
    reviewerErrors(
      'R1 grok-4.7-high CLEAN (session 5e19ac26); R1 grok-4.7-high CLEAN (session 3cbed3fe)',
    ).join('\n'),
    /number the reviewers R1, R2, … once each/,
  );
  assert.match(
    reviewerErrors(
      'R1 grok-4.7-high CLEAN (session 5e19ac26); R2 grok-4.7-high CLEAN (session 00000000)',
    ).join('\n'),
    /session= id agent-run\.sh printed/,
  );
});
