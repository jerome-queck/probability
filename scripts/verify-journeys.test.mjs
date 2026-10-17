import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('unknown, empty and duplicate journey selections fail before creating evidence or launching a server', () => {
  const directory = mkdtempSync(
    join(tmpdir(), 'probability-journey-selection-'),
  );
  const output = join(directory, 'must-not-be-created');
  try {
    for (const selection of [
      ['--only', 'unknown'],
      ['--only', ''],
      ['--viewport', 'tablet'],
      ['--only', 'study', '--only', 'accounts'],
    ]) {
      const result = spawnSync(
        process.execPath,
        ['scripts/verify-journeys.mjs', '--artifacts', output, ...selection],
        { encoding: 'utf8' },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Unknown|Use verify-journeys/);
      assert.doesNotMatch(result.stdout, /READY/);
      assert.equal(existsSync(output), false);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
