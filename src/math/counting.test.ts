import assert from 'node:assert/strict';
import test from 'node:test';
import {
  choose,
  derangementProbability,
  factorial,
  multinomial,
  permutations,
  sharedBirthdayProbability,
} from './counting.ts';

test('factorials, permutations and binomial coefficients are exact', () => {
  assert.equal(factorial(0), 1n);
  assert.equal(factorial(20), 2432902008176640000n);
  assert.equal(permutations(10, 3), 720n);
  assert.equal(choose(52, 5), 2598960n);
  assert.equal(choose(5, 7), 0n);
});

test('Pascal identity holds across a grid', () => {
  for (let n = 1; n < 30; n += 1)
    for (let r = 1; r <= n; r += 1)
      assert.equal(choose(n, r), choose(n - 1, r - 1) + choose(n - 1, r));
});

test('multinomial counts arrangements of MISSISSIPPI', () => {
  assert.equal(multinomial([1, 4, 4, 2]), 34650n);
});

test('23 people give a shared-birthday chance just above one half', () => {
  const p = sharedBirthdayProbability(23);
  assert.ok(p > 0.5 && p < 0.51, String(p));
  assert.equal(sharedBirthdayProbability(366), 1);
});

test('derangement probability approaches 1/e', () => {
  assert.equal(derangementProbability(1), 0);
  assert.equal(derangementProbability(2), 0.5);
  assert.ok(Math.abs(derangementProbability(12) - 1 / Math.E) < 1e-8);
});

test('invalid counting inputs are rejected', () => {
  assert.throws(() => factorial(-1), RangeError);
  assert.throws(() => choose(2.5, 1), RangeError);
});
