import { assertNaturalNumber, choose } from './counting.ts';

export type Summary = { mean: number; variance: number };

function assertProbability(p: number) {
  if (!(p >= 0 && p <= 1)) throw new RangeError('p must lie in [0, 1].');
}
function assertPositive(value: number, name: string) {
  if (!(value > 0) || !Number.isFinite(value))
    throw new RangeError(`${name} must be a positive finite number.`);
}

export function binomialPmf(n: number, p: number, k: number): number {
  assertNaturalNumber(n, 'n');
  assertProbability(p);
  if (!Number.isInteger(k) || k < 0 || k > n) return 0;
  return Number(choose(n, k)) * p ** k * (1 - p) ** (n - k);
}
export const binomialSummary = (n: number, p: number): Summary => ({
  mean: n * p,
  variance: n * p * (1 - p),
});

export function poissonPmf(lambda: number, k: number): number {
  assertPositive(lambda, 'lambda');
  if (!Number.isInteger(k) || k < 0) return 0;
  let logTerm = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i += 1) logTerm -= Math.log(i);
  return Math.exp(logTerm);
}
export const poissonSummary = (lambda: number): Summary => ({
  mean: lambda,
  variance: lambda,
});

/** Number of trials up to and including the first success. */
export function geometricPmf(p: number, k: number): number {
  assertProbability(p);
  if (!Number.isInteger(k) || k < 1) return 0;
  return (1 - p) ** (k - 1) * p;
}
export const geometricSummary = (p: number): Summary => ({
  mean: 1 / p,
  variance: (1 - p) / p ** 2,
});

/** Draw n without replacement from N items of which m are marked; k marked items drawn. */
export function hypergeometricPmf(
  N: number,
  m: number,
  n: number,
  k: number,
): number {
  for (const [name, v] of [
    ['N', N],
    ['m', m],
    ['n', n],
  ] as const)
    if (!Number.isInteger(v) || v < 0)
      throw new RangeError(`${name} must be a natural number`);
  if (m > N || n > N) throw new RangeError('need m ≤ N and n ≤ N');
  if (
    !Number.isInteger(k) ||
    k < Math.max(0, n - (N - m)) ||
    k > Math.min(n, m)
  )
    return 0;
  return Number(choose(m, k) * choose(N - m, n - k)) / Number(choose(N, n));
}
export function hypergeometricSummary(
  N: number,
  m: number,
  n: number,
): Summary {
  if (!(N >= 1 && m >= 0 && m <= N && n >= 0 && n <= N))
    throw new RangeError('need 0 ≤ m ≤ N, 0 ≤ n ≤ N and N ≥ 1');
  const p = m / N;
  return {
    mean: n * p,
    // With one item the draw is fixed, so the finite-population factor is 0.
    variance: N === 1 ? 0 : n * p * (1 - p) * ((N - n) / (N - 1)),
  };
}

/** Error function, Abramowitz–Stegun 7.1.26 (absolute error below 1.5e-7). */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly =
    t *
    (0.254829592 +
      t *
        (-0.284496736 +
          t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return sign * (1 - poly * Math.exp(-x * x));
}
export function normalPdf(x: number, mu = 0, sigma = 1): number {
  assertPositive(sigma, 'sigma');
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}
export function normalCdf(x: number, mu = 0, sigma = 1): number {
  assertPositive(sigma, 'sigma');
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

export function exponentialCdf(lambda: number, x: number): number {
  assertPositive(lambda, 'lambda');
  return x <= 0 ? 0 : 1 - Math.exp(-lambda * x);
}
export const exponentialSummary = (lambda: number): Summary => ({
  mean: 1 / lambda,
  variance: 1 / lambda ** 2,
});

/** Gamma function via the Lanczos approximation (g = 7). */
export function gammaFunction(z: number): number {
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gammaFunction(1 - z));
  const x = z - 1;
  let a = c[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i += 1) a += c[i] / (x + i);
  return Math.sqrt(2 * Math.PI) * t ** (x + 0.5) * Math.exp(-t) * a;
}
export function gammaPdf(alpha: number, lambda: number, x: number): number {
  assertPositive(alpha, 'alpha');
  assertPositive(lambda, 'lambda');
  if (x < 0) return 0;
  return (
    (lambda * Math.exp(-lambda * x) * (lambda * x) ** (alpha - 1)) /
    gammaFunction(alpha)
  );
}
export const gammaSummary = (alpha: number, lambda: number): Summary => ({
  mean: alpha / lambda,
  variance: alpha / lambda ** 2,
});

export const uniformSummary = (a: number, b: number): Summary => ({
  mean: (a + b) / 2,
  variance: (b - a) ** 2 / 12,
});

/** Normal approximation to P(X = k), X ~ Bin(n,p), with continuity correction. */
export function normalApproxBinomialPoint(
  n: number,
  p: number,
  k: number,
): number {
  const { mean, variance } = binomialSummary(n, p);
  const sd = Math.sqrt(variance);
  return normalCdf(k + 0.5, mean, sd) - normalCdf(k - 0.5, mean, sd);
}

/** Moment generating functions, written for the standard parameterisations. */
export const mgf = {
  binomial: (n: number, p: number, t: number) => (1 - p + p * Math.exp(t)) ** n,
  poisson: (lambda: number, t: number) => Math.exp(lambda * (Math.exp(t) - 1)),
  exponential: (lambda: number, t: number) => {
    if (t >= lambda)
      throw new RangeError('The mgf exists only for t < lambda.');
    return lambda / (lambda - t);
  },
  normal: (mu: number, sigma: number, t: number) =>
    Math.exp(mu * t + (sigma * sigma * t * t) / 2),
};

/** Discrete distribution helpers. */
export function summarize(values: number[], probabilities: number[]): Summary {
  const total = probabilities.reduce((a, b) => a + b, 0);
  if (Math.abs(total - 1) > 1e-9)
    throw new RangeError('Probabilities must sum to 1.');
  const mean = values.reduce((acc, v, i) => acc + v * probabilities[i], 0);
  const second = values.reduce(
    (acc, v, i) => acc + v * v * probabilities[i],
    0,
  );
  return { mean, variance: second - mean * mean };
}

/** Bayes' rule over a finite partition. Returns posterior probabilities. */
export function bayesPosterior(
  priors: number[],
  likelihoods: number[],
): number[] {
  const joint = priors.map((prior, i) => prior * likelihoods[i]);
  const evidence = joint.reduce((a, b) => a + b, 0);
  if (evidence === 0)
    throw new RangeError('The observed event has probability 0.');
  return joint.map((value) => value / evidence);
}

/** Chebyshev upper bound on P(|X - mu| >= k sigma). */
export const chebyshevBound = (k: number) => (k <= 1 ? 1 : 1 / (k * k));
