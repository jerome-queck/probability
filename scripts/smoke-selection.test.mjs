import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { selectSmokeStates } from './smoke-selection.mjs';

const states = [
  { feature: 'home', id: 'load' },
  { feature: 'home', id: 'start' },
  { feature: 'labs', id: 'birthday-moved', viewports: ['mobile'] },
];
const widths = ['desktop', 'mobile'];

test('exact state selection and explicit whole-feature selection retain their intended scope', () => {
  assert.deepEqual(selectSmokeStates(states, undefined, widths), states);
  assert.deepEqual(selectSmokeStates(states, 'home/load', widths), [states[0]]);
  assert.deepEqual(
    selectSmokeStates(states, undefined, widths, 'home'),
    states.slice(0, 2),
  );
  for (const value of ['', 'home', 'load', 'home/load-extra'])
    assert.throws(
      () => selectSmokeStates(states, value, widths),
      /unknown smoke state/,
    );
  assert.throws(
    () => selectSmokeStates(states, undefined, widths, 'missing'),
    /unknown smoke feature/,
  );
  assert.throws(() => selectSmokeStates([], undefined, widths), /no states/);
  assert.throws(
    () => selectSmokeStates(states, 'home/load', widths, 'home'),
    /Choose/,
  );
});

test('invalid viewport coverage cannot produce an empty successful run', () => {
  for (const viewports of [[], ['tablet']])
    assert.throws(
      () =>
        selectSmokeStates(
          [{ feature: 'home', id: 'load', viewports }],
          undefined,
          widths,
        ),
      /invalid viewports/,
    );
});

test('unknown and empty CLI selection fail before starting a server', () => {
  for (const args of [
    ['--only', 'load'],
    ['--only', ''],
    ['--feature', 'missing'],
  ]) {
    const result = spawnSync(
      process.execPath,
      ['scripts/control-probability.mjs', 'smoke', ...args],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /READY/);
    assert.match(result.stderr, /unknown|Missing/);
  }
});
