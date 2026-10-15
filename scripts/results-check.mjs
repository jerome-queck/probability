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
  /(?<!\p{L})(?:[Tt]he ((?:\p{L}[\p{L}'’–-]* ){1,3})(?:theorem|criterion|principle)|(?:[Ss]trong|[Ww]eak) laws?|[Ll]aws? [Oo]f (?:[Tt]otal \p{L}+|[Ll]arge [Nn]umbers|[Tt]he [Uu]nconscious [Ss]tatistician)|[Ii]nclusion[-–][Ee]xclusion)(?!\p{L})/gu;
// The same titles as a heading or at the start of a sentence, with no "the": "Central limit
// theorem.", "Basic counting principle." (PR #19 verifier r5).
const HEADING =
  /(?:^|[.!?:;]\s+|\n\s*)((?:\p{Lu}[\p{L}'’–-]*)(?: \p{L}[\p{L}'’–-]*){0,2} (?:theorem|criterion|principle))(?!\p{L})/gu;
// Title Case (PR #19 verifier r6, r7). A run of capitalised words ending in a capitalised title
// word ("Central Limit Theorem", "By the Poisson Slice Theorem", "De Morgan's Laws") is judged as
// a whole: each tail of the run that starts at a capitalised word is put in sentence case, and the
// run passes if any tail is registered. Otherwise the longest tail that does not start with an
// ordinary word is reported, never a fragment of it. A two-word run ("Strong Law", "Wald's
// Equation") only has its title word lowercased, so the scans above read it.
const TITLE_WORD =
  'Theorem|Inequality|Identity|Expansion|Approximation|Lemma|Bound|Laws?|Formula|Rule|Equation|Principle|Paradox|Fallacy|Criterion';
const RUN = new RegExp(
  `(?<![\\p{L}'’])\\p{Lu}[\\p{L}'’–-]*(?: (?:[Oo]f|[Tt]he|\\p{Lu}[\\p{L}'’–-]*))* (?:${TITLE_WORD})(?!\\p{L})`,
  'gu',
);
const CONNECTOR = /^(?:[Oo]f|[Tt]he)$/;
// Words that only lead into a title ("By the …", "Then …").
const LEAD = new Set(
  'By From Using Use Apply See Then Next With In On For And Or If So Thus Hence Now Here Recall Since By'.split(
    ' ',
  ),
);
const keepCase = (word, prev) =>
  /['’]s?$/.test(word) || prev === 'De' || /\p{Ll}\p{Lu}/u.test(word);
function toSentence(words) {
  return words
    .map((w, i) => (i === 0 || keepCase(w, words[i - 1]) ? w : w.toLowerCase()))
    .join(' ');
}
// Returns the text with long runs blanked out (so the other scans see no fragment of them) and
// the runs as lists of sentence-case tails, longest first.
export function titleCaseRuns(text) {
  const runs = [];
  const rest = text.replace(RUN, (run) => {
    const words = run.split(' ');
    if (words.length === 2) return `${words[0]} ${words[1].toLowerCase()}`;
    const tails = [];
    for (let i = 0; i < words.length - 1; i++)
      if (!CONNECTOR.test(words[i])) tails.push(toSentence(words.slice(i)));
    runs.push(tails);
    return ' '.repeat(run.length);
  });
  return { rest, runs };
}
export const sentenceCase = (text) => titleCaseRuns(text).rest;

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
    for (const { path, text: raw } of entries) {
      const { rest: text, runs } = titleCaseRuns(raw);
      const names = [];
      for (const tails of runs) {
        if (
          tails.some((t) =>
            registry.some((r) => r.res.some((re) => re.test(t))),
          )
        )
          continue;
        const name = tails.find((t) => {
          const first = t.split(/[\s'’]/)[0];
          return !LEAD.has(first) && !NOT_A_NAME.has(first);
        });
        if (name) names.push(name);
      }
      for (const m of text.matchAll(NAMED)) {
        const first = m[0].split(/[\s'’]/)[0];
        if (!NOT_A_NAME.has(first) && !ORDINARY.test(m[0])) names.push(m[0]);
      }
      for (const m of text.matchAll(TITLED))
        if (!NOT_A_TITLE.test(m[1] ?? '')) names.push(m[0]);
      for (const m of text.matchAll(HEADING)) {
        const first = m[1].split(/[\s'’]/)[0];
        if (!NOT_A_NAME.has(first) && !NOT_A_TITLE.test(`${m[1]} `))
          names.push(m[1]);
      }
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
