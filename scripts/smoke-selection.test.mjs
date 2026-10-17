import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { selectSmokeStates } from './smoke-selection.mjs';

const states = JSON.parse(
  readFileSync(
    new URL(
      '../.cursor/skills/verify-probability/features/smoke.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const viewports = ['desktop', 'mobile'];

test('no selector preserves the complete smoke suite', () => {
  assert.deepEqual(selectSmokeStates(states, undefined, viewports), states);
});

test('an exact selector runs only the named state', () => {
  assert.deepEqual(selectSmokeStates(states, 'home/start', viewports), [
    states.find((step) => step.feature === 'home' && step.id === 'start'),
  ]);
});

test('substrings, empty and unknown state selectors fail', () => {
  for (const only of ['', 'home', 'start', 'home/star', 'unknown/state'])
    assert.throws(
      () => selectSmokeStates(states, only, viewports),
      /unknown smoke state/,
      only,
    );
});

test('an empty suite and states without runnable viewports fail', () => {
  assert.throws(
    () => selectSmokeStates([], undefined, viewports),
    /no states to run/,
  );
  for (const widths of [[], ['unknown']])
    assert.throws(
      () =>
        selectSmokeStates(
          [{ feature: 'home', id: 'load', viewports: widths }],
          'home/load',
          viewports,
        ),
      /invalid viewports/,
    );
});

test('the CLI rejects invalid selections before launching a server or browser', () => {
  const driver = fileURLToPath(
    new URL('./control-probability.mjs', import.meta.url),
  );
  for (const args of [
    ['--only', 'home'],
    ['--only', 'unknown/state'],
    ['--only'],
  ]) {
    const result = spawnSync(process.execPath, [driver, 'smoke', ...args], {
      encoding: 'utf8',
      cwd: '/',
      timeout: 5000,
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /unknown smoke state/);
    assert.doesNotMatch(result.stdout, /READY|doctor:|smoke ok/);
  }
});
