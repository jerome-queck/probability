import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkMap, planFiles, workspaceIdentity } from './probability.mjs';

const map = {
  version: 1,
  shared: ['src/theme.css'],
  features: [
    { id: 'lessons', purpose: 'Read', owners: ['src/LessonPage.tsx'] },
    { id: 'progress', purpose: 'Save', owners: ['src/progress.ts'] },
  ],
};

test('new files and shared styles require every feature, not an empty success', () => {
  for (const path of ['src/new-learning-tool.ts', 'src/theme.css'])
    assert.deepEqual(planFiles([path], map).features, ['lessons', 'progress']);
  assert.deepEqual(planFiles(['src/progress.ts'], map).features, ['progress']);
});

test('every declared feature needs a driven state and every state needs an owner', () => {
  const states = [{ feature: 'lessons', id: 'read', url: '/' }];
  assert.match(checkMap(map, states).join(' '), /progress has no driven state/);
  assert.match(
    checkMap(map, [
      ...states,
      { feature: 'unknown', id: 'read', url: '/' },
    ]).join(' '),
    /Unmapped/,
  );
  assert.match(
    checkMap(map, [...states, ...states]).join(' '),
    /duplicate state/,
  );
});

test('CLI rejects misspelled commands, options, lessons and features before driving', () => {
  for (const args of [
    ['verfy'],
    ['help', '--froce'],
    ['show', '--id', 'missing'],
    ['journey', '--feature', 'missing'],
  ]) {
    const result = spawnSync(
      process.execPath,
      ['scripts/probability.mjs', ...args],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown/);
    assert.doesNotMatch(result.stderr, /READY/);
  }
});

test('source ownership must name existing surfaces, without requiring one test per module', () => {
  const states = map.features.map(({ id }) => ({
    feature: id,
    id: 'load',
    url: '/',
  }));
  assert.deepEqual(
    checkMap(map, states, ['src/LessonPage.tsx', 'src/progress.ts']),
    [],
  );
  assert.match(
    checkMap(map, states, ['src/progress.ts']).join(' '),
    /owner src\/LessonPage.tsx matches no source/,
  );
});

test('evidence fingerprints distinguish edits, untracked sources and deletion at the same head', () => {
  const directory = mkdtempSync(join(tmpdir(), 'probability-fingerprint-'));
  const git = (...args) =>
    execFileSync('git', args, { cwd: directory, stdio: 'pipe' });
  try {
    git('init', '-q');
    writeFileSync(join(directory, 'lesson.json'), '{"answer":1}');
    git('add', 'lesson.json');
    git(
      '-c',
      'user.name=Verification',
      '-c',
      'user.email=verification@example.invalid',
      'commit',
      '-qm',
      'fixture',
    );
    const initial = workspaceIdentity(directory);
    assert.equal(initial.dirty, false);
    writeFileSync(join(directory, 'lesson.json'), '{"answer":2}');
    const edited = workspaceIdentity(directory);
    assert.equal(edited.head, initial.head);
    assert.notEqual(edited.sourceDigest, initial.sourceDigest);
    writeFileSync(join(directory, 'new-lesson.json'), '{}');
    const untracked = workspaceIdentity(directory);
    assert.notEqual(untracked.sourceDigest, edited.sourceDigest);
    rmSync(join(directory, 'lesson.json'));
    const deleted = workspaceIdentity(directory);
    assert.equal(
      deleted.files.find(({ path }) => path === 'lesson.json').digest,
      null,
    );
    assert.notEqual(deleted.sourceDigest, untracked.sourceDigest);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
