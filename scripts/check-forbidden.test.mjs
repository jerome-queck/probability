import assert from 'node:assert/strict';
import test from 'node:test';
import { findForbidden } from './forbidden-patterns.mjs';

// Fixtures are assembled at runtime so the banned strings never sit in the tree.
const join = (...parts) => parts.join('');

test('each banned identifier is caught', () => {
  const samples = [
    join('N', 'TU'),
    join('n', 'tu'),
    join('MH', '2500'),
    join('MH', ' ', '2500'),
    join('Nan', 'yang Technological University'),
    join('Hand', 'out 6 Part 2'),
    join('Hand', '06'),
    join('A', 'Y26/27'),
    join('S', 'PMS'),
    join('ZZ', '9999'),
  ];
  for (const sample of samples)
    assert.ok(findForbidden(`see ${sample} here`).length > 0, sample);
});

test('ordinary probability text passes', () => {
  const text =
    'The central limit theorem (Ross, A First Course in Probability, §8.3) uses mgfs. In 2026 we toss 1000 coins; P(X=3) and E[X] are defined. Chapter 5.';
  assert.deepEqual(findForbidden(text), []);
});

test('lockfile hashes are not treated as course codes', () => {
  const lock = `"integrity": "sha512-q+${join('AB', '1234')}/xyz"`;
  assert.deepEqual(findForbidden(lock, 'package-lock.json'), []);
  assert.ok(findForbidden(lock, 'notes.md').length > 0);
});

test('an allowed technical code does not hide a real one on the same line', () => {
  assert.ok(
    findForbidden(`target ES2022 and ${join('QQ', '1234')}`).length > 0,
  );
});
