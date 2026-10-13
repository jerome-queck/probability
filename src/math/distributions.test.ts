import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bayesPosterior,
  binomialPmf,
  binomialSummary,
  chebyshevBound,
  exponentialCdf,
  gammaFunction,
  gammaPdf,
  geometricPmf,
  hypergeometricPmf,
  hypergeometricSummary,
  mgf,
  normalApproxBinomialPoint,
  normalCdf,
  poissonPmf,
  summarize,
} from './distributions.ts';

const close = (a: number, b: number, tol = 1e-6) =>
  assert.ok(Math.abs(a - b) < tol, `${a} vs ${b}`);
const sum = (f: (k: number) => number, from: number, to: number) => {
  let s = 0;
  for (let k = from; k <= to; k += 1) s += f(k);
  return s;
};

test('each pmf sums to one', () => {
  close(
    sum((k) => binomialPmf(12, 0.3, k), 0, 12),
    1,
  );
  close(
    sum((k) => poissonPmf(4, k), 0, 80),
    1,
  );
  close(
    sum((k) => geometricPmf(0.2, k), 1, 400),
    1,
  );
  close(
    sum((k) => hypergeometricPmf(20, 7, 5, k), 0, 5),
    1,
  );
});

test('moments from the pmf match the closed forms', () => {
  const values = Array.from({ length: 13 }, (_, k) => k);
  const s = summarize(
    values,
    values.map((k) => binomialPmf(12, 0.3, k)),
  );
  close(s.mean, binomialSummary(12, 0.3).mean);
  close(s.variance, binomialSummary(12, 0.3).variance);
  const h = summarize(
    [0, 1, 2, 3, 4, 5],
    [0, 1, 2, 3, 4, 5].map((k) => hypergeometricPmf(20, 7, 5, k)),
  );
  close(h.mean, hypergeometricSummary(20, 7, 5).mean);
  close(h.variance, hypergeometricSummary(20, 7, 5).variance);
});

test('Poisson approximates a binomial with small p', () => {
  for (let k = 0; k < 6; k += 1)
    close(binomialPmf(1000, 0.003, k), poissonPmf(3, k), 1e-3);
});

test('standard normal table values', () => {
  close(normalCdf(0), 0.5);
  close(normalCdf(1.96), 0.975, 1e-4);
  close(normalCdf(-1), 0.158655, 1e-5);
  close(normalCdf(110, 100, 10), normalCdf(1), 1e-12);
});

test('continuity-corrected normal approximation is close for Bin(40, 1/2)', () => {
  close(normalApproxBinomialPoint(40, 0.5, 20), binomialPmf(40, 0.5, 20), 2e-3);
});

test('exponential is memoryless', () => {
  const tail = (x: number) => 1 - exponentialCdf(0.5, x);
  close(tail(5) / tail(2), tail(3), 1e-12);
});

test('gamma function and gamma density', () => {
  close(gammaFunction(5), 24, 1e-9);
  close(gammaFunction(0.5), Math.sqrt(Math.PI), 1e-9);
  close(gammaPdf(1, 2, 0.7), 2 * Math.exp(-1.4), 1e-12);
});

test('mgf derivatives at zero give the mean', () => {
  const h = 1e-5;
  const d = (f: (t: number) => number) => (f(h) - f(-h)) / (2 * h);
  close(
    d((t) => mgf.binomial(10, 0.4, t)),
    4,
    1e-5,
  );
  close(
    d((t) => mgf.poisson(3, t)),
    3,
    1e-5,
  );
  close(
    d((t) => mgf.exponential(2, t)),
    0.5,
    1e-5,
  );
  close(
    d((t) => mgf.normal(1.5, 2, t)),
    1.5,
    1e-5,
  );
  assert.throws(() => mgf.exponential(2, 2), RangeError);
});

test('Bayes posterior for a rare condition with an accurate test', () => {
  const [sick] = bayesPosterior([0.005, 0.995], [0.95, 0.01]);
  close(sick, 0.00475 / (0.00475 + 0.00995), 1e-12);
});

test('Chebyshev bound', () => {
  assert.equal(chebyshevBound(2), 0.25);
  assert.equal(chebyshevBound(0.5), 1);
});

test('hypergeometric rejects impossible inputs and returns 0 off the support', () => {
  assert.equal(hypergeometricPmf(20, 7, 5, 6), 0);
  assert.equal(hypergeometricPmf(10, 8, 5, 2), 0); // at least 3 marked items must be drawn
  assert.throws(() => hypergeometricPmf(10, 3, 12, 0), RangeError);
  assert.equal(hypergeometricSummary(1, 1, 1).variance, 0);
});
