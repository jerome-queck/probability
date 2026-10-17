import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const head = '0747d3d290bf08c57b35fb458c8d410994137dad';
const previousHead = '1b4a785399e55446fb71214551587e77c95bab6f';
const body = [
  `- Verifier verdict: VERIFIED codex gpt-6.1-sol effort max (session /root/verifier) on ${head}`,
  `- Verified head: ${head}`,
  '- Review: clean, all findings resolved',
  `- Reviewer verdicts: R1 codex gpt-6.1-sol effort max CLEAN (session /root/reviewer_one) on ${head}; R2 codex gpt-6.1-sol effort max CLEAN (session /root/reviewer_two) on ${head}`,
  `- Math review: clean - codex gpt-6.1-sol effort max (session /root/math_check) on ${head}; original sources checked`,
  '- Verify evidence: https://github.com/example/probability/actions/runs/123, inspected home/start.desktop.png and home/start.mobile.png',
  '- Skills used: poteto-mode, verify-probability; runner codex, model gpt-6.1-sol, effort max',
  '- Evidence: exact-head CI run and screenshots above',
].join('\n');
const directory = mkdtempSync(join(tmpdir(), 'probability-evidence-test-'));
const preload = join(directory, 'fetch.mjs');
writeFileSync(
  join(directory, 'gh'),
  `#!/usr/bin/env node
const fixture = JSON.parse(process.env.PROBABILITY_GATE_FIXTURE);
const fields = process.argv[process.argv.indexOf('--json') + 1]?.split(',') ?? [];
const result = process.argv[2] === 'api'
  ? fixture.compare
  : Object.fromEntries(fields.map((field) => [field, fixture.pr[field]]));
process.stdout.write(JSON.stringify(result));
`,
  { mode: 0o755 },
);
writeFileSync(
  preload,
  `const fixture = JSON.parse(process.env.PROBABILITY_GATE_FIXTURE);
globalThis.fetch = async (url) => {
  const api = 'https://api.github.com/repos/example/probability/actions/runs/123';
  if (url !== api && url !== api + '/artifacts')
    throw new Error('unexpected API request');
  return new Response(JSON.stringify(url.endsWith('/artifacts') ? { artifacts: fixture.artifacts } : fixture.run));
};
`,
);
after(() => rmSync(directory, { recursive: true, force: true }));

function gate(overrides = {}) {
  const fixture = {
    pr: {
      title: 'Require complete verification evidence',
      body,
      headRefOid: head,
      files: [{ path: 'src/content/part01.json' }],
      ...overrides.pr,
    },
    compare: { status: 'identical', files: [], ...overrides.compare },
    run: {
      name: 'check',
      path: '.github/workflows/check.yml',
      head_sha: head,
      conclusion: 'success',
      ...overrides.run,
    },
    artifacts: overrides.artifacts ?? [
      { name: 'verify-evidence', expired: false, size_in_bytes: 123 },
    ],
  };
  return spawnSync(
    process.execPath,
    [
      '--import',
      preload,
      fileURLToPath(new URL('./check-evidence.mjs', import.meta.url)),
    ],
    {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      encoding: 'utf8',
      timeout: 5000,
      env: {
        ...process.env,
        PATH: `${directory}${delimiter}${process.env.PATH}`,
        PR: '1',
        HEAD_SHA: head,
        GITHUB_REPOSITORY: 'example/probability',
        PROBABILITY_GATE_FIXTURE: JSON.stringify(fixture),
      },
    },
  );
}

test('the complete evidence command accepts full current independent records', () => {
  const result = gate();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`evidence ok for ${head}`));
});

test('empty fields cannot consume the next line as evidence', () => {
  const result = gate({
    pr: {
      body: body.replace(
        /- Evidence:.+/,
        '- Evidence:\n- Notes: no proof supplied',
      ),
    },
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Evidence.*must point at the proof/);
});

test('duplicate verdict fields fail even when the first one is clean', () => {
  const result = gate({
    pr: { body: `${body}\n- Reviewer verdicts: CHANGES NEEDED` },
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Reviewer verdicts.*more than once/);
});

test('the evidence event must still match the live PR head', () => {
  const result = gate({ pr: { headRefOid: previousHead } });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /PR head changed or is invalid/);
});

for (const path of [
  'src/content/part01.json',
  'app/page.tsx',
  'server/progress.ts',
  'db/migrations/0001_progress.sql',
  'build/entry.mjs',
  'vite.config.ts',
  'future/new-surface.ts',
  'docs/verification.md',
]) {
  test(`${path} requires complete current CI evidence`, () => {
    const pr = { files: [{ path }] };
    const valid = gate({ pr });
    assert.equal(valid.status, 0, valid.stderr);
    for (const invalid of [
      {
        pr: { body: body.replace(/^- Verify evidence:.*$/m, '') },
        error: /Verify evidence.*must link/,
      },
      {
        pr: {
          body: body.replace(
            'https://github.com/example/probability/actions/runs/123',
            'no CI run',
          ),
        },
        error: /Verify evidence.*must link/,
      },
      {
        pr: { body: body.replaceAll('.png', '.txt') },
        error: /Verify evidence.*screenshots inspected/,
      },
      {
        run: { head_sha: previousHead },
        error: /run 123 is for .*not the PR head/,
      },
      { run: { name: 'unrelated' }, error: /not the check workflow/ },
      {
        run: { path: '.github/workflows/unrelated.yml' },
        error: /not the check workflow/,
      },
      { run: { conclusion: 'failure' }, error: /not success/ },
      { artifacts: [], error: /no verify-evidence artifact/ },
      ...[
        { name: 'verify-evidence', expired: true, size_in_bytes: 123 },
        { name: 'verify-evidence', expired: false, size_in_bytes: 0 },
        { name: 'unrelated', expired: false, size_in_bytes: 123 },
      ].map((artifact) => ({
        artifacts: [artifact],
        error: /no verify-evidence artifact/,
      })),
    ]) {
      const result = gate({ ...invalid, pr: { ...pr, ...invalid.pr } });
      assert.equal(result.status, 1, result.stderr || result.stdout);
      assert.match(result.stderr, invalid.error);
    }
  });
}

test('live PR title and raw body must satisfy the public-content rule', () => {
  const forbidden = ['QQ', '1234'].join('');
  for (const pr of [
    { title: `Explain ${forbidden}` },
    { body: `${body}\nPrivate reference ${forbidden}` },
    { body: `${body}\n<!-- Private reference ${forbidden} -->` },
  ]) {
    const result = gate({ pr });
    assert.equal(result.status, 1, result.stderr || result.stdout);
    assert.match(result.stderr, /forbidden course code.*pull-request-text/);
  }
});

test('commented verdict records still cannot supply evidence', () => {
  const result = gate({
    pr: {
      body: body.replace(
        /- Verifier verdict: (.*)/,
        '<!-- - Verifier verdict: $1 -->',
      ),
    },
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /Verifier verdict/);
});

test('a clean summary cannot override a failed reviewer in the complete gate', () => {
  const result = gate({
    pr: {
      body: body.replace(
        'R2 codex gpt-6.1-sol effort max CLEAN',
        'R2 codex gpt-6.1-sol effort max CHANGES NEEDED',
      ),
    },
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /R2 reported CHANGES NEEDED/);
});

test('a changed lesson after its math check fails the complete gate', () => {
  const result = gate({
    compare: { status: 'ahead', files: ['src/content/part01.json'] },
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /content changed after the math check/);
});
