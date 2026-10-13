import assert from 'node:assert/strict';
import test from 'node:test';
import {
  histogram,
  runningProportion,
  seededRandom,
  standardizedUniformSums,
} from './simulation.ts';

test('the seeded generator is reproducible and in [0,1)', () => {
  const a = seededRandom(7);
  const b = seededRandom(7);
  for (let i = 0; i < 100; i += 1) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('the running proportion of heads settles near one half', () => {
  const path = runningProportion(20000, 11);
  assert.ok(Math.abs(path[path.length - 1] - 0.5) < 0.02);
});

test('standardised uniform sums have mean near 0 and variance near 1', () => {
  const z = standardizedUniformSums(12, 5000, 3);
  const mean = z.reduce((a, b) => a + b, 0) / z.length;
  const variance = z.reduce((a, b) => a + (b - mean) ** 2, 0) / z.length;
  assert.ok(Math.abs(mean) < 0.05, String(mean));
  assert.ok(Math.abs(variance - 1) < 0.07, String(variance));
});

test('histogram densities integrate to the in-range share', () => {
  const bins = histogram([0.1, 0.2, 0.6, 0.9, 2], 0, 1, 4);
  const area = bins.reduce((a, b) => a + b.density * (b.to - b.from), 0);
  assert.ok(Math.abs(area - 0.8) < 1e-12);
});
