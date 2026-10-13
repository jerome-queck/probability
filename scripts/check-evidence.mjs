#!/usr/bin/env node
// Merge gate: the PR body must carry an independent verifier verdict and a clean review for
// the current head SHA, plus evidence. Content PRs also need a clean math review.
// Run in CI by .github/workflows/evidence.yml; locally: PR=<n> node scripts/check-evidence.mjs
import { execFileSync } from 'node:child_process';

const pr = process.env.PR;
const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8' });
// gh reads the live PR so an edit made after the event is seen.
const live = JSON.parse(
  gh('pr', 'view', pr, '--json', 'body,headRefOid,files'),
);
const body = live.body ?? '';
const head = process.env.HEAD_SHA || live.headRefOid;
const files = live.files.map((f) => f.path);
const errors = [];
const field = (name) =>
  new RegExp(`^\\s*[-*]?\\s*\\**${name}\\**\\s*:\\s*(.+)$`, 'im')
    .exec(body)?.[1]
    ?.trim() ?? '';

if (!/^VERIFIED\b/.test(field('Verifier verdict')))
  errors.push(
    '“Verifier verdict:” must start with VERIFIED (INCONCLUSIVE is not a pass)',
  );
const verifiedHead = field('Verified head');
if (
  !verifiedHead ||
  !head.startsWith(verifiedHead.replace(/`/g, '').slice(0, 7)) ||
  verifiedHead.replace(/`/g, '').length < 7
)
  errors.push(
    `“Verified head:” must name the current head ${head.slice(0, 7)} (a new push resets verification)`,
  );
if (!/^clean\b/i.test(field('Review')))
  errors.push('“Review:” must start with “clean” (no open Act-on items)');
if (field('Evidence').length < 10)
  errors.push(
    '“Evidence:” must point at the proof (CI run, smoke drives, artifacts)',
  );
if (
  files.some((f) => f.startsWith('src/content/')) &&
  !/^clean\b/i.test(field('Math review'))
)
  errors.push(
    'content changed: “Math review:” must start with “clean” and name the independent reviewer',
  );

if (errors.length) {
  console.error(errors.map((e) => `evidence: ${e}`).join('\n'));
  process.exit(1);
}
console.log(`evidence ok for ${head.slice(0, 7)}`);
