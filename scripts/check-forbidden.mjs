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
  // Binary files (screenshots, fonts) hold random byte runs, not text.
  if (text.includes('\0')) continue;
  hits.push(...findForbidden(text, path));
}

// Every commit reachable from HEAD: messages and added lines.
let history = '';
try {
  history = git('log', '--format=%H%n%an%n%ae%n%B', '-p', '--no-color', 'HEAD');
} catch (error) {
  // Only a repository without commits may skip the history scan; any other failure
  // (including an exceeded buffer) must fail the check rather than pass it silently.
  if (
    !/does not have any commits|unknown revision/.test(
      String(error.stderr ?? ''),
    )
  )
    throw error;
}
const historyLines = history.split('\n');
// The file a history line belongs to, from the nearest preceding diff header.
function historyFileOf(line) {
  for (let i = line - 1; i >= 0; i -= 1) {
    const m = /^diff --git a\/(\S+) /.exec(historyLines[i]);
    if (m) return m[1];
    if (/^[0-9a-f]{40}$/.test(historyLines[i])) return '';
  }
  return '';
}
for (const hit of findForbidden(history, 'git-history')) {
  const file = historyFileOf(hit.line);
  // Lockfile hashes are random letters and digits; the tree scan exempts them too.
  if (hit.name === 'course code' && file.endsWith('package-lock.json'))
    continue;
  hits.push(file ? { ...hit, path: `git-history:${file}` } : hit);
}

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

const filtered = hits;

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
