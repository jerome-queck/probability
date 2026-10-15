// Named results in lessons: every result a lesson names must be registered in
// src/content/results.json, and a result the site does not prove (status "quoted") must carry an
// explicit marker such as "quoted without proof" in the lesson where it is named.
// "background" is reserved for calculus and analysis tools the whole site assumes (Taylor,
// Fubini). Pure functions; scripts/check-results.mjs runs them on the content.

// A marker that tells the reader the result is used without a proof on this site.
export const MARKER =
  /\b(quoted|stated)( here)? without proof|\bnot proved here|\bdo not reprove|\btaken as known|\bis assumed\b|\bassumes the\b|\bassumed through\b/i;

// An eponymous or titled result: "Name's theorem" (straight or curly apostrophe), "Name–Name
// inequality", "Wald's equation", "De Morgan's laws", accented names such as "Hölder's inequality". Each match must be
// covered by a registry pattern.
const NAMED =
  /(?<!\p{L})(?:De )?\p{Lu}\p{Ll}+(?:[-–]\p{Lu}\p{Ll}+)*(?:['’]s?)? (?:theorem|inequality|identity|expansion|approximation|lemma|bound|laws?|formula|rule|equation|principle|paradox|fallacy|criterion)(?!\p{L})/gu;
// Capitalised words that only start ordinary phrases ("The bound", "This formula"). Words that
// begin real titles (Binomial, Poisson, Weak, Continuity, ...) are not here: a title that
// starts with them is scanned like any other (PR #19 reviewer 1).
const NOT_A_NAME = new Set(
  'The This That Then These Those Both Each Every Same Such Its Our An A Upper Lower Tail Product Exact General'.split(
    ' ',
  ),
);
// Ordinary phrases the eponymous pattern also matches: a distribution name before "formula",
// "law" or "approximation" describes a formula, not a named result.
const ORDINARY =
  /^(?:Normal|Poisson|Binomial|Gamma|Exponential|Uniform) (?:formula|laws?|rule|bound)$/;

// A titled result in lowercase: "the central limit theorem", "the cdf criterion", "the
// multiplication principle", "the strong law", "the law of total probability",
// inclusion-exclusion. Only "theorem", "criterion" and "principle" are titles after "the":
// "the variance formula" or "the chain rule" are ordinary words, so those must be registered
// by hand (see AGENTS.md).
const TITLED =
  /(?<!\p{L})(?:[Tt]he ((?:\p{L}[\p{L}'’–-]* ){1,3})(?:theorem|criterion|principle)|(?:strong|weak) laws?|laws? of (?:total \p{L}+|large numbers|the unconscious statistician)|inclusion[-–]exclusion)(?!\p{L})/gu;
// Words after "the" that make an ordinary reference, not a title ("the same theorem").
const NOT_A_TITLE =
  /^(?:same|previous|above|next|following|last|first|second|general|stated|proposed|whole|main|key|preceding|earlier|later) /i;

export const strings = (value, path = '') =>
  typeof value === 'string'
    ? [{ path, text: value }]
    : Array.isArray(value)
      ? value.flatMap((v, i) => strings(v, `${path}[${i}]`))
      : value && typeof value === 'object'
        ? Object.entries(value).flatMap(([k, v]) =>
            strings(v, path ? `${path}.${k}` : k),
          )
        : [];

const compile = (results) =>
  results.map((r) => ({
    ...r,
    // A straight apostrophe in a pattern also matches the curly one the lessons often use.
    res: r.patterns.map((p) => new RegExp(p.replace(/'/g, "['’]"), 'i')),
  }));

// Returns error strings, each naming the lesson, field and fix.
export function checkResults(lessons, results) {
  const errors = [];
  const registry = compile(results);
  const ids = new Set(lessons.map((l) => l.id));
  for (const r of registry) {
    if (!['proved', 'quoted', 'background'].includes(r.status))
      errors.push(
        `results.json ${r.id}: status must be proved, quoted or background`,
      );
    if (r.status !== 'background' && !ids.has(r.in))
      errors.push(
        `results.json ${r.id}: "in" must name the lesson that proves or quotes it`,
      );
    const home = lessons.find((l) => l.id === r.in);
    if (home && !strings(home).some((e) => r.res.some((re) => re.test(e.text))))
      errors.push(
        `results.json ${r.id}: lesson ${r.in} never names it; fix "in" or the patterns`,
      );
  }
  for (const l of lessons) {
    const entries = strings(l);
    for (const { path, text } of entries) {
      const names = [];
      for (const m of text.matchAll(NAMED)) {
        const first = m[0].split(/[\s'’]/)[0];
        if (!NOT_A_NAME.has(first) && !ORDINARY.test(m[0])) names.push(m[0]);
      }
      for (const m of text.matchAll(TITLED))
        if (!NOT_A_TITLE.test(m[1] ?? '')) names.push(m[0]);
      for (const name of names)
        if (!registry.some((r) => r.res.some((re) => re.test(name))))
          errors.push(
            `${l.id} ${path}: "${name}" is not in src/content/results.json; register it with the lesson that proves it, or status "quoted" (used without proof) or "background" (calculus the site assumes)`,
          );
    }
    for (const r of registry) {
      if (r.status !== 'quoted') continue;
      const hits = entries.filter((e) => r.res.some((re) => re.test(e.text)));
      if (hits.length && !hits.some((e) => MARKER.test(e.text)))
        errors.push(
          `${l.id} ${hits[0].path}: ${r.id} is quoted, not proved; add "quoted without proof" (or "stated without proof", "not proved here") in an entry that names it`,
        );
    }
  }
  return errors;
}
