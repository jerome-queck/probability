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
// Template placeholders are HTML comments; they never count as evidence.
const body = (live.body ?? '').replace(/<!--[\s\S]*?-->/g, '');
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
  !head.startsWith(verifiedHead.replace(/`/g, '')) ||
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
  !(
    /^clean\b/i.test(field('Math review')) &&
    /grok-4\.7/i.test(field('Math review'))
  )
)
  errors.push(
    'content changed: “Math review:” must start with “clean” and name the independent reviewer',
  );

// Feature changes need the verify-skill run (driver + screenshots looked at) and a named
// independent reviewer, and every PR lists the skills used with model and effort.
const touchesFeatures = files.some((f) =>
  /^(src\/|index\.html$|\.cursor\/skills\/verify-probability\/)/.test(f),
);
if (touchesFeatures) {
  const verify = field('Verify evidence');
  const runId = /actions\/runs\/(\d+)/.exec(verify)?.[1];
  let hasArtifact = false;
  if (runId) {
    try {
      const repo =
        process.env.GITHUB_REPOSITORY ||
        gh(
          'repo',
          'view',
          '--json',
          'nameWithOwner',
          '-q',
          '.nameWithOwner',
        ).trim();
      const listed = JSON.parse(
        gh('api', `repos/${repo}/actions/runs/${runId}/artifacts`),
      );
      hasArtifact = listed.artifacts.some(
        (a) => a.name === 'smoke-evidence' && !a.expired && a.size_in_bytes > 0,
      );
    } catch {}
  }
  if (runId && !hasArtifact)
    errors.push(
      `feature change: run ${runId} has no smoke-evidence artifact (screenshots); link a run that uploaded one`,
    );
  if (!runId || !/\.png\b/.test(verify))
    errors.push(
      'feature change: “Verify evidence:” must link the CI run (…/actions/runs/<id>, artifact smoke-evidence with the driver run) and name the screenshots inspected (*.png)',
    );
  if (!/grok-4\.7/i.test(field('Review')))
    errors.push(
      'feature change: “Review:” must name the independent reviewer and its model (grok-4.7)',
    );
}
if (
  !/verify-probability/.test(field('Skills used')) ||
  !/grok-4\.7/.test(field('Skills used')) ||
  !/effort/i.test(field('Skills used'))
)
  errors.push(
    '“Skills used:” must list the skills used (at least verify-probability) with model and effort',
  );

if (errors.length) {
  console.error(errors.map((e) => `evidence: ${e}`).join('\n'));
  process.exit(1);
}
console.log(`evidence ok for ${head.slice(0, 7)}`);
