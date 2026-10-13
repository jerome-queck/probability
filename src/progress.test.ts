import assert from 'node:assert/strict';
import test from 'node:test';
import { nextUnstudied, parseProgress } from './progress.ts';

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
