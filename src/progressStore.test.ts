import assert from 'node:assert/strict';
import test from 'node:test';

// A fake localStorage installed before the store module loads.
const data = new Map<string, string>();
let blocked = false;
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (blocked) throw new Error('QuotaExceededError');
      data.set(k, v);
    },
  },
});
const { progressStore } = await import('./progress.ts');
const key = 'probability.progress.v1';

test('a change made in another tab is kept by the next local change', () => {
  progressStore.toggleStudied('F01');
  data.set(key, JSON.stringify({ studied: ['F01', 'F02'], practice: {} }));
  progressStore.setVerdict('F03', 'review');
  assert.deepEqual(JSON.parse(data.get(key) ?? ''), {
    studied: ['F01', 'F02'],
    practice: { F03: 'review' },
  });
});

test('when storage fails the change is kept for the visit and marked unsaved', () => {
  blocked = true;
  progressStore.setVerdict('F03', 'review');
  assert.equal(progressStore.getSnapshot().practice.F03, undefined);
  assert.equal(progressStore.getSnapshot().unsaved, true);
  progressStore.setVerdict('F03', 'review');
  assert.equal(progressStore.getSnapshot().practice.F03, 'review');
  blocked = false;
  progressStore.toggleStudied('F03');
  assert.equal(progressStore.getSnapshot().unsaved, undefined);
  assert.deepEqual(JSON.parse(data.get(key) ?? '').practice, { F03: 'review' });
});
