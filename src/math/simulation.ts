/** Seeded generator (mulberry32) so labs and tests are reproducible. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Running proportion of heads in n fair coin tosses. */
export function runningProportion(n: number, seed: number, p = 0.5): number[] {
  const random = seededRandom(seed);
  const out: number[] = [];
  let heads = 0;
  for (let i = 1; i <= n; i += 1) {
    if (random() < p) heads += 1;
    out.push(heads / i);
  }
  return out;
}

/**
 * Standardised sample means of n uniform(0,1) draws, repeated `repeats` times.
 * Each value is (S_n - n/2) / sqrt(n/12).
 */
export function standardizedUniformSums(
  n: number,
  repeats: number,
  seed: number,
): number[] {
  const random = seededRandom(seed);
  const out: number[] = [];
  const sd = Math.sqrt(n / 12);
  for (let r = 0; r < repeats; r += 1) {
    let sum = 0;
    for (let i = 0; i < n; i += 1) sum += random();
    out.push((sum - n / 2) / sd);
  }
  return out;
}

export function histogram(
  values: number[],
  min: number,
  max: number,
  bins: number,
) {
  const counts = Array.from({ length: bins }, () => 0);
  const width = (max - min) / bins;
  for (const v of values) {
    if (v < min || v >= max) continue;
    counts[Math.floor((v - min) / width)] += 1;
  }
  return counts.map((count, i) => ({
    from: min + i * width,
    to: min + (i + 1) * width,
    density: count / (values.length * width),
  }));
}
