/** Exact counting helpers. Results use bigint so large factorials stay exact. */
export function factorial(n: number): bigint {
  assertNaturalNumber(n, 'n');
  let result = 1n;
  for (let k = 2n; k <= BigInt(n); k += 1n) result *= k;
  return result;
}

export function permutations(n: number, r: number): bigint {
  assertNaturalNumber(n, 'n');
  assertNaturalNumber(r, 'r');
  if (r > n) return 0n;
  let result = 1n;
  for (let k = n - r + 1; k <= n; k += 1) result *= BigInt(k);
  return result;
}

export function choose(n: number, r: number): bigint {
  assertNaturalNumber(n, 'n');
  assertNaturalNumber(r, 'r');
  if (r > n) return 0n;
  const k = Math.min(r, n - r);
  let result = 1n;
  for (let i = 1; i <= k; i += 1) {
    result = (result * BigInt(n - k + i)) / BigInt(i);
  }
  return result;
}

export function multinomial(parts: number[]): bigint {
  const n = parts.reduce((sum, part) => sum + part, 0);
  return parts.reduce((acc, part) => acc / factorial(part), factorial(n));
}

/** Probability that at least two of n people share a birthday among d equally likely days. */
export function sharedBirthdayProbability(n: number, days = 365): number {
  assertNaturalNumber(n, 'n');
  if (n > days) return 1;
  let allDistinct = 1;
  for (let i = 0; i < n; i += 1) allDistinct *= (days - i) / days;
  return 1 - allDistinct;
}

/** Probability that a uniformly random permutation of n items has no fixed point. */
export function derangementProbability(n: number): number {
  assertNaturalNumber(n, 'n');
  let sum = 0;
  let term = 1;
  for (let k = 0; k <= n; k += 1) {
    if (k > 0) term /= -k;
    sum += term;
  }
  return sum;
}

export function assertNaturalNumber(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0)
    throw new RangeError(`${name} must be a non-negative integer.`);
}
