import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nextUnstudied,
  parseProgress,
  setVerdictIn,
  toggleStudiedIn,
} from './progress.ts';

test('toggling and verdicts change only the lesson named and can be undone', () => {
  const start = { studied: ['F02'], practice: { F02: 'review' as const } };
  const marked = toggleStudiedIn(start, 'F01');
  assert.deepEqual(marked.studied, ['F02', 'F01']);
  assert.deepEqual(toggleStudiedIn(marked, 'F01').studied, ['F02']);
  const judged = setVerdictIn(start, 'F01', 'got-it');
  assert.deepEqual(judged.practice, { F02: 'review', F01: 'got-it' });
  assert.deepEqual(setVerdictIn(judged, 'F01', 'got-it').practice, {
    F02: 'review',
  });
  assert.deepEqual(start.practice, { F02: 'review' });
});

test('parseProgress tolerates missing, corrupt and foreign data', () => {
  assert.deepEqual(parseProgress(null), { studied: [], practice: {} });
  assert.deepEqual(parseProgress('{not json'), { studied: [], practice: {} });
  assert.deepEqual(
    parseProgress(
      JSON.stringify({
        studied: ['F01', 'F01', 3],
        practice: { F01: 'got-it', F02: 'maybe' },
      }),
    ),
    { studied: ['F01'], practice: { F01: 'got-it' } },
  );
});

test('nextUnstudied returns the first lesson not yet studied', () => {
  const progress = { studied: ['F01', 'F03'], practice: {} };
  assert.equal(nextUnstudied(['F01', 'F02', 'F03'], progress), 'F02');
  assert.equal(
    nextUnstudied(['F01'], { studied: ['F01'], practice: {} }),
    undefined,
  );
});
