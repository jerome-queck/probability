#!/usr/bin/env node
// Merge gate: the PR body must carry an independent verifier verdict and a clean review for
// the current head SHA, plus evidence. Content PRs also need a clean math check of the lesson
// text at the head.
// Run in CI by .github/workflows/evidence.yml; locally: PR=<n> node scripts/check-evidence.mjs
import { execFileSync } from 'node:child_process';
import {
  compareFailedErrors,
  FULL_SHA,
  mathReviewErrors,
  reviewerErrors,
  skillsUsedErrors,
  staleMathErrors,
  verifiedHeadErrors,
  verifierErrors,
} from './evidence-rules.mjs';

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
const field = (name) => {
  const matches = [
    ...body.matchAll(
      new RegExp(
        `^[\\t ]*[-*]?[\\t ]*\\**${name}\\**[\\t ]*:[\\t ]*(.*)$`,
        'gim',
      ),
    ),
  ];
  if (matches.length > 1)
    errors.push(
      `“${name}:” appears more than once; keep one unambiguous field`,
    );
  return matches[0]?.[1].trim() ?? '';
};

if (!FULL_SHA.test(head) || head !== live.headRefOid)
  errors.push(
    'the PR head changed or is invalid; rerun evidence for the current full head SHA',
  );
const verifier = verifierErrors(field('Verifier verdict'), head);
errors.push(...verifier.errors);
errors.push(
  ...verifiedHeadErrors(field('Verified head').replace(/`/g, ''), head),
);
if (!/^clean\b/i.test(field('Review')))
  errors.push('“Review:” must start with “clean” (no open Act-on items)');
// Every review session must have reported (a dropped reviewer is rerun, not skipped).
errors.push(
  ...reviewerErrors(field('Reviewer verdicts'), head, verifier.session),
);
if (field('Evidence').length < 10)
  errors.push(
    '“Evidence:” must point at the proof (CI run, smoke drives, artifacts)',
  );
// Content PRs need a clean math check of the lesson text as it is at the head.
if (files.some((f) => f.startsWith('src/content/'))) {
  const math = mathReviewErrors(field('Math review'));
  errors.push(...math.errors);
  if (math.sha) {
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
      const compare = JSON.parse(
        gh(
          'api',
          `repos/${repo}/compare/${math.sha}...${head}`,
          '--jq',
          '{status, files: [.files[].filename]}',
        ),
      );
      errors.push(...staleMathErrors(math.sha, compare, files));
    } catch (error) {
      errors.push(
        ...compareFailedErrors(
          math.sha,
          `${error.stderr ?? ''}\n${error.message}`,
        ),
      );
    }
  }
}

// Feature changes need the verify-skill run (driver + screenshots looked at) and a named
// independent reviewer, and every PR lists the skills used with model and effort.
const touchesFeatures = files.some((f) =>
  /^(src\/|index\.html$|\.cursor\/skills\/verify-probability\/)/.test(f),
);
if (touchesFeatures) {
  const verify = field('Verify evidence');
  const runId = /actions\/runs\/(\d+)/.exec(verify)?.[1];
  if (runId) {
    // The repository is public, so the run and its artifacts are read without a token.
    // (works with or without Actions permission on the job token).
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
    const api = `https://api.github.com/repos/${repo}/actions/runs/${runId}`;
    try {
      const [run, listed] = await Promise.all(
        [api, `${api}/artifacts`].map(async (url) => {
          const res = await fetch(url, {
            headers: {
              accept: 'application/vnd.github+json',
              ...(process.env.GH_TOKEN
                ? { authorization: `Bearer ${process.env.GH_TOKEN}` }
                : {}),
            },
          });
          if (!res.ok) throw new Error(`${url} answered ${res.status}`);
          return res.json();
        }),
      );
      if (
        run.name !== 'check' ||
        !String(run.path).endsWith('.github/workflows/check.yml')
      )
        errors.push(
          `feature change: run ${runId} is “${run.name}” (${run.path}), not the check workflow`,
        );
      if (run.head_sha !== head)
        errors.push(
          `feature change: run ${runId} is for ${run.head_sha}, not the PR head ${head}`,
        );
      if (run.conclusion !== 'success')
        errors.push(
          `feature change: run ${runId} concluded “${run.conclusion}”, not success`,
        );
      if (
        !listed.artifacts.some(
          (a) =>
            a.name === 'verify-evidence' && !a.expired && a.size_in_bytes > 0,
        )
      )
        errors.push(
          `feature change: run ${runId} has no verify-evidence artifact (screenshots)`,
        );
    } catch (error) {
      errors.push(
        `feature change: could not read run ${runId} from the GitHub API (${error.message})`,
      );
    }
  }
  if (!runId || !/\.png\b/.test(verify))
    errors.push(
      'feature change: “Verify evidence:” must link the CI run (…/actions/runs/<id>, artifact verify-evidence with the driver run) and name the screenshots inspected (*.png)',
    );
}
errors.push(...skillsUsedErrors(field('Skills used')));

if (errors.length) {
  console.error(errors.map((e) => `evidence: ${e}`).join('\n'));
  process.exit(1);
}
console.log(`evidence ok for ${head}`);
