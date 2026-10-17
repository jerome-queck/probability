import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

test('stop refuses a live foreign process even when its argv contains the wrapper path and nonce', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'probability-ownership-'));
  const token = randomUUID();
  const child = spawn(
    process.execPath,
    [
      '-e',
      'setInterval(() => {}, 1000)',
      resolve('scripts/serve-probability.mjs'),
      token,
    ],
    { detached: true, stdio: 'ignore' },
  );
  await once(child, 'spawn');
  try {
    writeFileSync(
      join(directory, 'state.json'),
      JSON.stringify({
        pid: child.pid,
        token,
        port: 8999,
        url: 'http://127.0.0.1:8999',
        mode: 'preview',
      }),
    );
    writeFileSync(join(directory, 'evidence.txt'), 'keep original evidence');
    const result = spawnSync(
      process.execPath,
      ['scripts/control-probability.mjs', 'stop', '--data-dir', directory],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /refusing to stop unowned/);
    assert.doesNotThrow(() => process.kill(child.pid, 0));
    assert.equal(existsSync(join(directory, 'state.json')), true);
    assert.equal(
      readFileSync(join(directory, 'evidence.txt'), 'utf8'),
      'keep original evidence',
    );
  } finally {
    child.kill('SIGTERM');
    await once(child, 'exit');
    rmSync(directory, { recursive: true, force: true });
  }
});

test('stop removes an exited launch record while preserving evidence', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'probability-stale-'));
  const child = spawn(process.execPath, ['-e', ''], { stdio: 'ignore' });
  await once(child, 'exit');
  try {
    writeFileSync(
      join(directory, 'state.json'),
      JSON.stringify({
        pid: child.pid,
        token: randomUUID(),
        port: 8999,
        url: 'http://127.0.0.1:8999',
        mode: 'preview',
      }),
    );
    writeFileSync(join(directory, 'evidence.txt'), 'keep original evidence');
    const result = spawnSync(
      process.execPath,
      ['scripts/control-probability.mjs', 'stop', '--data-dir', directory],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 0);
    assert.equal(existsSync(join(directory, 'state.json')), false);
    assert.equal(
      readFileSync(join(directory, 'evidence.txt'), 'utf8'),
      'keep original evidence',
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('misapplied options and malformed ports fail before launch, and visual tolerance cannot weaken the release gate', () => {
  for (const args of [
    ['launch', '--port', 'no'],
    ['help', '--capture'],
    ['smoke', '--data-dir', '/tmp/unused'],
  ]) {
    const result = spawnSync(
      process.execPath,
      ['scripts/control-probability.mjs', ...args],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /READY/);
  }
  for (const value of ['no', '0.5', '-1']) {
    const result = spawnSync(
      process.execPath,
      ['scripts/control-probability.mjs', 'smoke'],
      { encoding: 'utf8', env: { ...process.env, VISUAL_MAX_DIFF: value } },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /VISUAL_MAX_DIFF/);
    assert.doesNotMatch(result.stdout, /READY/);
  }
});
