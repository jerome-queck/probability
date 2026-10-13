// Patterns that must never appear anywhere in this public repository: files, history,
// commit messages, branch names or pull-request text. They are written as character
// classes so this file does not itself contain the strings it bans.
export const forbiddenPatterns = [
  { name: 'university abbreviation', re: /\bN[T]U\b/i },
  { name: 'university name', re: /N[a]nyang/i },
  { name: 'school abbreviation', re: /\bS[P]MS\b/ },
  { name: 'academic-year tag', re: /\bA[Y]\s?\d{2}\s?\/\s?\d{2}\b/ },
  { name: 'handout numbering', re: /\bH[a]nd(?:out)?\s?0?\d{1,2}\b/i },
  { name: 'lecturer name', re: /G[u]ohua/i },
  { name: 'course code', re: /\b[A-Z]{2,3}\s?\d{4}[A-Z]?\b/ },
];

// Lockfiles carry base64 integrity hashes that can contain code-like runs by chance;
// they are scanned for every pattern except the generic course-code shape.
// Technical identifiers with the same shape as a course code.
const allowedCodes = /^(ES|ISO|RFC|CVE|UTF)\s?\d{4}/;

const hashHeavy = /(^|\/)package-lock\.json$/;

export function findForbidden(text, path = '') {
  const hits = [];
  const lines = text.split('\n');
  for (const { name, re } of forbiddenPatterns) {
    if (name === 'course code' && hashHeavy.test(path)) continue;
    const global = new RegExp(re.source, `${re.flags}g`);
    lines.forEach((line, i) => {
      for (const m of line.matchAll(global)) {
        if (name === 'course code' && allowedCodes.test(m[0])) continue;
        hits.push({ path, line: i + 1, name, match: m[0] });
        break;
      }
    });
  }
  return hits;
}
