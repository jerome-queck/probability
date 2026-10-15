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
// Capitalised words that start ordinary phrases ("The bound", "Normal approximation").
const NOT_A_NAME = new Set(
  'The This That Then These Those Both Each Every Same Such Its Our An A Upper Lower Tail Product Normal Poisson Binomial Multinomial Continuity Weak Strong Central Exact General'.split(
    ' ',
  ),
);

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
    for (const { path, text } of entries)
      for (const m of text.matchAll(NAMED)) {
        const first = m[0].split(/[\s'’]/)[0];
        if (NOT_A_NAME.has(first)) continue;
        if (!registry.some((r) => r.res.some((re) => re.test(m[0]))))
          errors.push(
            `${l.id} ${path}: "${m[0]}" is not in src/content/results.json; register it with the lesson that proves it, or status "quoted"`,
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
