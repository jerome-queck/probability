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
const relativeClose = (actual: number, expected: number, tolerance = 1e-11) => {
  assert.ok(
    Number.isFinite(actual),
    `expected finite ${expected}, got ${actual}`,
  );
  const error = Math.abs(actual - expected);
  const allowance = Math.abs(expected) * tolerance + 8 * Number.MIN_VALUE;
  assert.ok(error <= allowance, `${actual} vs ${expected}, error ${error}`);
};
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

test('balanced binomial mass stays finite after coefficient overflow', () => {
  relativeClose(binomialPmf(1100, 0.5, 550), 0.02405165776823181);
});

test('balanced hypergeometric mass stays finite after coefficient overflow', () => {
  relativeClose(hypergeometricPmf(2000, 1000, 1000, 500), 0.03566910390358188);
});

test('gamma function retains the finite factorial at 150', () => {
  relativeClose(gammaFunction(150), 3.80892263763057e260);
});

test('gamma density stays finite near a large shape mode', () => {
  relativeClose(gammaPdf(150, 1, 149), 0.03266435131989559);
});

test('binomial tail survives a subnormal powered factor', () => {
  relativeClose(binomialPmf(1000, 0.0006, 100), 2.430524582273285e-183);
});

test('gamma reflection retains a representable subnormal result', () => {
  relativeClose(gammaFunction(-171.5), 1.9316265431712e-310);
});

test('large binomial exponents do not amplify rounded complementation', () => {
  // Decimal reference uses the actual binary64 p, not the decimal 1e-12.
  relativeClose(binomialPmf(1e12, 1e-12, 1), 0.36787944117162624);
});

for (const x of [0, -0]) {
  test(`tiny gamma shape has an infinite density at ${Object.is(x, -0) ? '-0' : '+0'}`, () => {
    assert.equal(gammaPdf(1e-310, 2, x), Infinity);
  });
}

test('large discrete distributions normalize over their entire support', () => {
  for (const [n, p] of [
    [1100, 0.5],
    [1000, 0.0006],
    [1500, 0.2],
    [1500, 0.8],
  ]) {
    close(
      sum((k) => binomialPmf(n, p, k), 0, n),
      1,
      1e-11,
    );
  }
  for (const [N, m, n] of [
    [2000, 1000, 1000],
    [2000, 1, 1000],
    [2000, 1000, 1999],
  ]) {
    close(
      sum(
        (k) => hypergeometricPmf(N, m, n, k),
        Math.max(0, n - (N - m)),
        Math.min(n, m),
      ),
      1,
      1e-11,
    );
  }
});

test('binomial preserves exact display ties, endpoints and support', () => {
  for (const k of [1, 5]) {
    assert.equal(binomialPmf(6, 0.5, k), 0.09375);
    assert.equal(binomialPmf(6, 0.5, k).toFixed(4), '0.0938');
  }
  assert.equal(binomialPmf(0, 0, 0), 1);
  assert.equal(binomialPmf(0, 1, 0), 1);
  assert.equal(binomialPmf(1100, 0, 0), 1);
  assert.equal(binomialPmf(1100, 0, 550), 0);
  assert.equal(binomialPmf(1100, 1, 1100), 1);
  assert.equal(binomialPmf(1100, 1, 550), 0);
  for (const k of [-1, 1101, 0.5, Infinity, NaN]) {
    assert.equal(binomialPmf(1100, 0.5, k), 0);
  }
});

test('hypergeometric preserves degenerate samples and support boundaries', () => {
  assert.equal(hypergeometricPmf(0, 0, 0, 0), 1);
  assert.equal(hypergeometricPmf(2000, 0, 1000, 0), 1);
  assert.equal(hypergeometricPmf(2000, 2000, 1000, 1000), 1);
  assert.equal(hypergeometricPmf(2000, 1000, 0, 0), 1);
  assert.equal(hypergeometricPmf(2000, 1000, 2000, 1000), 1);
  for (const k of [-1, 1001, 0.5, Infinity, NaN]) {
    assert.equal(hypergeometricPmf(2000, 1000, 1000, k), 0);
  }
  assert.equal(hypergeometricPmf(2000, 1000, 1999, 998), 0);
});

test('gamma preserves reflection signs and exceptional argument classes', () => {
  relativeClose(gammaFunction(-0.5), -2 * Math.sqrt(Math.PI));
  relativeClose(gammaFunction(-1.5), (4 * Math.sqrt(Math.PI)) / 3);
  relativeClose(gammaFunction(-2.5), (-8 * Math.sqrt(Math.PI)) / 15);
  relativeClose(gammaFunction(-170.5), -3.312739521538607e-308);
  relativeClose(gammaFunction(-172.5), -1.11978350329e-312);
  assert.equal(gammaFunction(0), Infinity);
  assert.equal(gammaFunction(-0), -Infinity);
  for (const z of [Infinity, -Infinity, NaN])
    assert.ok(Number.isNaN(gammaFunction(z)));
  for (const z of [-1, -2, -3]) assert.ok(Number.isFinite(gammaFunction(z)));
});

test('gamma density has right limits at both zero signs and preserves nonfinite propagation', () => {
  for (const x of [0, -0]) {
    assert.equal(gammaPdf(0.5, 2, x), Infinity);
    assert.equal(gammaPdf(1, 2, x), 2);
    assert.equal(gammaPdf(2, 2, x), 0);
  }
  assert.equal(gammaPdf(0.5, 2, Infinity), 0);
  assert.equal(gammaPdf(1, 2, Infinity), 0);
  assert.ok(Number.isNaN(gammaPdf(2, 2, Infinity)));
  for (const shape of [0.5, 1, 2, 150]) {
    assert.equal(gammaPdf(shape, 2, -1), 0);
    assert.equal(gammaPdf(shape, 2, -Infinity), 0);
    assert.ok(Number.isNaN(gammaPdf(shape, 2, NaN)));
  }
});

test('integer gamma densities agree with their Erlang factorial formula', () => {
  for (const [shape, factorial] of [
    [2, 1],
    [3, 2],
    [5, 24],
    [8, 5040],
  ]) {
    for (const rate of [0.25, 2, 7]) {
      for (const x of [0.1, 1, 4]) {
        const expected =
          (rate ** shape * x ** (shape - 1) * Math.exp(-rate * x)) / factorial;
        relativeClose(gammaPdf(shape, rate, x), expected);
      }
    }
  }
});

test('distribution numerical paths retain parameter validation before support checks', () => {
  for (const n of [-1, 0.5, Infinity, NaN])
    assert.throws(() => binomialPmf(n, 0.5, -1), RangeError);
  for (const p of [-0.1, 1.1, Infinity, NaN])
    assert.throws(() => binomialPmf(10, p, -1), RangeError);
  for (const bad of [-1, 0.5, Infinity, NaN]) {
    assert.throws(() => hypergeometricPmf(bad, 0, 0, -1), RangeError);
    assert.throws(() => hypergeometricPmf(10, bad, 0, -1), RangeError);
    assert.throws(() => hypergeometricPmf(10, 0, bad, -1), RangeError);
  }
  assert.throws(() => hypergeometricPmf(10, 11, 0, -1), RangeError);
  assert.throws(() => hypergeometricPmf(10, 0, 11, -1), RangeError);
  for (const bad of [0, -1, Infinity, NaN]) {
    assert.throws(() => gammaPdf(bad, 2, -1), RangeError);
    assert.throws(() => gammaPdf(2, bad, -1), RangeError);
  }
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
