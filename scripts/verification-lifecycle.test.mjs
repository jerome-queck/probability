import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

const fixture = resolve('scripts/fixtures/verification-lifecycle.mjs');
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function waitFor(check, label) {
  const deadline = Date.now() + 20_000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timeout waiting for ${label}`);
    await delay(25);
  }
}
function start(args, directory, scenario) {
  const child = spawn(process.execPath, args, {
    env: { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${JSON.stringify(fixture)}`, LIFECYCLE_FIXTURE_DIR: directory, LIFECYCLE_FIXTURE: scenario },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const closed = once(child, 'close');
  const exited = once(child, 'exit');
  return { child, closed, exited, output: () => output };
}

test('actual journey retains an earlier failure when browser close rejects', { timeout: 30_000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'probability-close-receipt-'));
  const out = join(directory, 'evidence');
  const run = start(['scripts/verify-journeys.mjs', '--only', 'study', '--viewport', 'desktop', '--artifacts', out], directory, 'close-reject');
  try {
    const [status] = await run.closed;
    assert.equal(status, 1, run.output());
    assert.ok(existsSync(join(out, 'result.json')), `failed receipt missing\n${run.output()}`);
    const receipt = JSON.parse(readFileSync(join(out, 'result.json'), 'utf8'));
    assert.equal(receipt.success, false);
    assert.match(receipt.failures.join('\n'), /injected earlier launch failure/);
    assert.match(receipt.failures.join('\n'), /injected browser close failure/);
  } finally { run.child.kill('SIGKILL'); rmSync(directory, { recursive: true, force: true }); }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  for (const publicCommand of [false, true]) {
    test(`${publicCommand ? 'public journey PID' : 'actual smoke'} ${signal} retains a failed receipt and stops its owned detached server`, { timeout: 40_000 }, async () => {
      const directory = mkdtempSync(join(tmpdir(), 'probability-signal-receipt-'));
      const out = join(directory, 'evidence');
      const args = publicCommand ? ['scripts/probability.mjs', 'journey', '--id', 'home/start'] : ['scripts/control-probability.mjs', 'smoke', '--only', 'home/start', '--capture', '--artifacts', out];
      const control = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
      const run = start(args, directory, 'interrupt');
      let state;
      try {
        await waitFor(() => existsSync(join(directory, 'browser.json')) && existsSync(join(directory, 'server.json')), 'browser and server acquisition');
        state = JSON.parse(readFileSync(join(directory, 'server.json'), 'utf8'));
        const dataDir = resolve(state.args.at(-1), '..');
        run.child.kill(signal);
        const [status, rawSignal] = await run.exited;
        assert.equal(rawSignal, null, run.output());
        assert.equal(status, signal === 'SIGINT' ? 130 : 143, run.output());
        assert.equal(alive(state.pid), false, 'owned detached server survived');
        assert.equal(existsSync(join(dataDir, 'state.json')), false, 'cleaned state retained');
        const evidence = publicCommand ? /evidence in (.+)/.exec(run.output())?.[1]?.trim() : out;
        assert.ok(evidence, run.output());
        const receipt = JSON.parse(readFileSync(join(evidence, 'result.json'), 'utf8'));
        assert.equal(receipt.success, false);
        assert.equal(receipt.interruption.signal, signal);
        assert.equal(readFileSync(join(directory, 'closes.txt'), 'utf8'), 'close\n');
        assert.equal(alive(control.pid), true, 'unrelated control process stopped');
      } finally {
        if (state && alive(state.pid)) process.kill(-state.pid, 'SIGKILL');
        if (existsSync(join(directory, 'browser.json'))) {
          const leaf = JSON.parse(readFileSync(join(directory, 'browser.json'), 'utf8'));
          if (alive(leaf.pid)) process.kill(leaf.pid, 'SIGKILL');
        }
        run.child.kill('SIGKILL');
        control.kill('SIGTERM');
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
}
