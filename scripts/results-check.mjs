// Named results. Each lesson lists, in "results", the id of every named result it names or
// states; src/content/results.json registers each id with its name, its status and its home
// lesson:
//   proved      derived in the lesson named by "in";
//   quoted      used without proof, introduced in the lesson named by "in";
//   background  calculus and analysis tools the whole site assumes (Taylor, Fubini).
// The check reads only these tags, never the prose: every tag must be registered, every
// registered result must be tagged by at least one lesson (so deleting a result's last tag or
// lesson cannot go unnoticed), and a proved or quoted result's home lesson must tag it.
// Whether the tags are complete is the math review's job (see docs/root-cause/19.md).
// Pure function; scripts/check-results.mjs runs it on the content.

const STATUSES = ['proved', 'quoted', 'background'];

// Returns error strings, each naming the lesson or row and the fix.
export function checkResults(lessons, results) {
  const errors = [];
  const ids = new Set(lessons.map((l) => l.id));
  const rows = new Map();
  for (const r of results) {
    if (rows.has(r.id))
      errors.push(`results.json ${r.id}: listed twice; keep one row`);
    rows.set(r.id, r);
    if (typeof r.name !== 'string' || !r.name.trim())
      errors.push(`results.json ${r.id}: give it a "name"`);
    if (!STATUSES.includes(r.status))
      errors.push(
        `results.json ${r.id}: status must be proved, quoted or background`,
      );
    if (r.status !== 'background' && !ids.has(r.in))
      errors.push(
        `results.json ${r.id}: "in" must name the lesson that proves or quotes it`,
      );
  }
  const tagged = new Set();
  for (const l of lessons) {
    if (!Array.isArray(l.results)) {
      errors.push(
        `${l.id} results: must be an array of results.json ids (use [] for none)`,
      );
      continue;
    }
    for (const id of l.results) {
      tagged.add(id);
      if (!rows.has(id))
        errors.push(
          `${l.id} results: "${id}" is not in src/content/results.json; register it there, or fix the id`,
        );
    }
  }
  for (const r of rows.values()) {
    if (!tagged.has(r.id))
      errors.push(
        `results.json ${r.id}: no lesson lists it in "results"; tag the lessons that name it, or delete the row`,
      );
    const home = lessons.find((l) => l.id === r.in);
    if (home && Array.isArray(home.results) && !home.results.includes(r.id))
      errors.push(
        `${r.in} results: must list "${r.id}", which results.json says this lesson ${r.status === 'quoted' ? 'quotes' : 'proves'}`,
      );
  }
  return errors;
}
