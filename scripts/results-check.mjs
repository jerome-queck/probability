// Named results in lessons. src/content/results.json lists each named result the lessons use,
// with the exact names it goes by, its status, and its home lesson:
//   proved      derived in the lesson named by "in", which must name it;
//   quoted      used without proof; in each lesson that names it, an entry that names it
//               must carry a marker such as "quoted without proof" (the gap PR #14's math
//               review found);
//   background  calculus and analysis tools the whole site assumes (Taylor, Fubini).
// Matching is an exact name match only: case-insensitive, whole words, with a curly apostrophe
// equal to a straight one and an en dash equal to a hyphen. The check does not look for names
// that are missing from the registry; a new result is added to the registry by hand when a
// lesson proves or quotes it (see AGENTS.md). Pure functions; scripts/check-results.mjs runs them.

// A marker that tells the reader the result is used without a proof on this site.
export const MARKER =
  /\b(quoted|stated)( here)? without proof|\bnot proved here|\bdo not reprove|\btaken as known|\bassumed through\b/i;

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

// Exact-name matcher: escape the name, then let ' match ’ and - match –.
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const nameRegExp = (name) =>
  new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(name).replace(/'/g, "['’]").replace(/-/g, '[-–]')}(?![\\p{L}\\p{N}])`,
    'iu',
  );

// Returns error strings, each naming the lesson or row and the fix.
export function checkResults(lessons, results) {
  const errors = [];
  const ids = new Set(lessons.map((l) => l.id));
  const registry = results.map((r) => ({
    ...r,
    res: (r.names ?? []).map(nameRegExp),
  }));
  for (const r of registry) {
    if (!r.res.length || (r.names ?? []).some((n) => !String(n).trim()))
      errors.push(
        `results.json ${r.id}: list at least one name in "names", none of them blank`,
      );
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
        `results.json ${r.id}: lesson ${r.in} never uses any of its names; fix "in" or "names"`,
      );
  }
  for (const l of lessons) {
    const entries = strings(l);
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
