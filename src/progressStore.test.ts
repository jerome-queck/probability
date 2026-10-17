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
const { createProgressStore } = await import('./progress.ts');
const progressStore = createProgressStore({
  fetch: async () => Response.json({ kind: 'guest' }),
});
await progressStore.initialize();
const key = 'probability.progress.v1';

// Each test starts from the same stored state, whatever ran before it.
function reset(stored: object) {
  blocked = false;
  data.set(key, JSON.stringify(stored));
  progressStore.reload();
}

test('a change made in another tab is kept by the next local change', () => {
  reset({ studied: ['F01'], practice: {} });
  data.set(key, JSON.stringify({ studied: ['F01', 'F02'], practice: {} }));
  progressStore.setVerdict('F03', 'review');
  assert.deepEqual(JSON.parse(data.get(key) ?? ''), {
    studied: ['F01', 'F02'],
    practice: { F03: 'review' },
  });
});

test('when storage fails the change is kept for the visit and marked unsaved', () => {
  reset({ studied: [], practice: { F03: 'review' } });
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
