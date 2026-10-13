#!/usr/bin/env node
// Fails when a forbidden identifier appears in the tree, the git history, commit
// messages, the branch name, or (in CI) the pull-request title and body.
// Fix: rewrite the text without the identifier. If it reached history on a branch,
// rewrite that branch before it merges (ask Jerome before any force-push).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { findForbidden } from './forbidden-patterns.mjs';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
const hits = [];

for (const path of git('ls-files', '-co', '--exclude-standard')
  .split('\n')
  .filter(Boolean)) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    continue;
  }
  hits.push(...findForbidden(text, path));
}

// Every commit reachable from HEAD: messages and added lines.
let history = '';
try {
  history = git('log', '--format=%H%n%an%n%ae%n%B', '-p', '--no-color', 'HEAD');
} catch {
  // A repository without commits has no history to scan.
}
for (const hit of findForbidden(history, 'git-history'))
  if (!hit.path.endsWith('package-lock.json')) hits.push(hit);

const branch =
  process.env.GITHUB_HEAD_REF ||
  (() => {
    try {
      return git('rev-parse', '--abbrev-ref', 'HEAD').trim();
    } catch {
      return '';
    }
  })();
hits.push(...findForbidden(branch, 'branch-name'));

if (process.env.GITHUB_EVENT_PATH) {
  try {
    const event = JSON.parse(
      readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'),
    );
    const pr = event.pull_request;
    if (pr)
      hits.push(
        ...findForbidden(
          `${pr.title ?? ''}\n${pr.body ?? ''}`,
          'pull-request-text',
        ),
      );
  } catch {
    // No readable event payload outside GitHub Actions.
  }
}

// History hits inside the lockfile diff are hash noise; filter by the diff header.
const filtered = hits.filter(
  (hit) =>
    !(
      hit.path === 'git-history' &&
      hit.name === 'course code' &&
      /^[+-]\s*"(integrity|resolved)"/.test(lineOf(history, hit.line))
    ),
);
function lineOf(text, n) {
  return text.split('\n')[n - 1] ?? '';
}

if (filtered.length) {
  for (const hit of filtered)
    console.error(
      `forbidden ${hit.name} in ${hit.path}:${hit.line} (“${hit.match}”)`,
    );
  console.error(
    `\n${filtered.length} forbidden identifier(s). Teach the mathematics without naming a course, institution, code or handout. See AGENTS.md “Public-content rule”.`,
  );
  process.exit(1);
}
console.log(
  'check:forbidden ok — no forbidden identifiers in tree, history, branch or PR text',
);
