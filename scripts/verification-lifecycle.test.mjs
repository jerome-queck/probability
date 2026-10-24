import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

const fixture = resolve('scripts/fixtures/verification-lifecycle.mjs');
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const groupMembers = (pid) =>
  execFileSync('ps', ['-axo', 'pid=,pgid=,stat='], { encoding: 'utf8' })
    .split('\n')
    .flatMap((row) => {
      const match = /^\s*(\d+)\s+(\d+)\s+(\S+)/.exec(row);
      return Number(match?.[2]) === pid && !match[3].startsWith('Z')
        ? [Number(match[1])]
        : [];
    });
async function waitFor(check, label) {
  const deadline = Date.now() + 20_000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timeout waiting for ${label}`);
    await delay(25);
  }
}
function start(args, directory, scenario) {
  const child = spawn(process.execPath, args, {
    env: {
      ...process.env,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${JSON.stringify(fixture)}`,
      LIFECYCLE_FIXTURE_DIR: directory,
      LIFECYCLE_FIXTURE: scenario,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });
  const closed = once(child, 'close');
  const exited = once(child, 'exit');
  return { child, closed, exited, output: () => output };
}

for (const scenario of ['stop-esrch-term', 'stop-esrch-kill', 'stop-eperm']) {
  test(`actual stop ${scenario} preserves the owned-state boundary`, {
    timeout: 30_000,
  }, async (t) => {
    const directory = mkdtempSync(join(tmpdir(), 'probability-stop-race-'));
    const dataDir = join(directory, 'instance');
    const control = spawn(
      process.execPath,
      ['-e', 'setInterval(()=>{},1000)'],
      {
        stdio: 'ignore',
      },
    );
    const launched = start(
      ['scripts/control-probability.mjs', 'launch', '--data-dir', dataDir],
      directory,
      scenario,
    );
    let state;
    let stopped;
    try {
      const [launchStatus] = await launched.closed;
      assert.equal(launchStatus, 0, launched.output());
      await waitFor(() => existsSync(join(directory, 'server.json')), 'server');
      state = JSON.parse(readFileSync(join(dataDir, 'state.json'), 'utf8'));
      stopped = start(
        ['scripts/control-probability.mjs', 'stop', '--data-dir', dataDir],
        directory,
        scenario,
      );
      const [status, rawSignal] = await stopped.closed;
      const injected = JSON.parse(
        readFileSync(join(directory, 'signal-error.json'), 'utf8'),
      );
      const members = groupMembers(state.pid);
      t.diagnostic(
        JSON.stringify({
          scenario,
          status,
          rawSignal,
          injected,
          members,
          stateRetained: existsSync(join(dataDir, 'state.json')),
          controlAlive: alive(control.pid),
          output: stopped.output(),
        }),
      );
      assert.equal(alive(control.pid), true, 'unrelated control stopped');
      assert.equal(rawSignal, null, stopped.output());
      if (scenario === 'stop-eperm') {
        assert.equal(status, 1, stopped.output());
        assert.match(stopped.output(), /EPERM/);
        assert.equal(existsSync(join(dataDir, 'state.json')), true);
        assert.equal(alive(state.pid), true, 'EPERM owner was signalled');
      } else {
        assert.equal(injected.kernelGroupAbsent, true);
        assert.deepEqual(members, [], 'race fixture left a live group');
        assert.equal(
          status,
          0,
          `vanished owned group must stop successfully\n${stopped.output()}`,
        );
        assert.equal(existsSync(join(dataDir, 'state.json')), false);
      }
    } finally {
      launched.child.kill('SIGKILL');
      stopped?.child.kill('SIGKILL');
      if (state && groupMembers(state.pid).length)
        process.kill(-state.pid, 'SIGKILL');
      if (state)
        await waitFor(() => !groupMembers(state.pid).length, 'group cleanup');
      control.kill('SIGTERM');
      await once(control, 'close');
      t.diagnostic(
        JSON.stringify({
          scenario,
          cleanupMembers: state ? groupMembers(state.pid) : [],
          controlAlive: alive(control.pid),
        }),
      );
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('actual launch refuses a dead leader with a surviving recorded group', {
  timeout: 30_000,
}, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'probability-launch-orphan-'));
  const dataDir = join(directory, 'instance');
  const marker = join(directory, 'member.json');
  const release = join(directory, 'release-member');
  const memberCode = `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(marker)},JSON.stringify({pid:process.pid}));setInterval(()=>{if(fs.existsSync(${JSON.stringify(release)}))process.exit(0)},10)`;
  const leader = spawn(
    process.execPath,
    [
      '-e',
      `const cp=require('node:child_process');const child=cp.spawn(process.execPath,['-e',${JSON.stringify(memberCode)}],{stdio:'ignore'});child.unref();`,
    ],
    { detached: true, stdio: 'ignore' },
  );
  const control = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {
    stdio: 'ignore',
  });
  let launched;
  try {
    await once(leader, 'exit');
    await waitFor(() => existsSync(marker), 'surviving member');
    mkdirSync(dataDir);
    const state = JSON.stringify({
      pid: leader.pid,
      token: 'c1111111-1111-4111-8111-111111111111',
      port: 8999,
      url: 'http://127.0.0.1:8999',
      mode: 'preview',
    });
    writeFileSync(join(dataDir, 'state.json'), state);
    writeFileSync(join(dataDir, 'server.log'), 'retained dead leader evidence');
    assert.equal(alive(leader.pid), false);
    assert.ok(groupMembers(leader.pid).length, 'orphan fixture group absent');
    launched = start(
      ['scripts/control-probability.mjs', 'launch', '--data-dir', dataDir],
      directory,
      'launch-orphan',
    );
    const [status, rawSignal] = await launched.closed;
    const unchanged =
      readFileSync(join(dataDir, 'state.json'), 'utf8') === state;
    t.diagnostic(
      JSON.stringify({
        status,
        rawSignal,
        leader: leader.pid,
        members: groupMembers(leader.pid),
        unchanged,
        acquired: existsSync(join(directory, 'server-process.json')),
        controlAlive: alive(control.pid),
        output: launched.output(),
      }),
    );
    assert.equal(alive(control.pid), true, 'unrelated control stopped');
    assert.ok(groupMembers(leader.pid).length, 'retained group was signalled');
    assert.equal(status, 1, 'launch must refuse the recorded surviving group');
    assert.equal(rawSignal, null);
    assert.equal(
      unchanged,
      true,
      'launch replaced the only retained resource record',
    );
    assert.equal(
      existsSync(join(directory, 'server-process.json')),
      false,
      'launch acquired another server',
    );
    assert.equal(
      readFileSync(join(dataDir, 'server.log'), 'utf8'),
      'retained dead leader evidence',
    );
  } finally {
    launched?.child.kill('SIGKILL');
    writeFileSync(release, 'release');
    await waitFor(
      () => !groupMembers(leader.pid).length,
      'orphan fixture cleanup',
    );
    let replacement;
    if (existsSync(join(directory, 'server-process.json'))) {
      replacement = JSON.parse(
        readFileSync(join(directory, 'server-process.json'), 'utf8'),
      ).serverPid;
      if (groupMembers(replacement).length)
        process.kill(-replacement, 'SIGKILL');
      await waitFor(
        () => !groupMembers(replacement).length,
        'replacement cleanup',
      );
    }
    control.kill('SIGTERM');
    await once(control, 'close');
    t.diagnostic(
      JSON.stringify({
        cleanupMembers: groupMembers(leader.pid),
        replacementMembers: replacement ? groupMembers(replacement) : [],
        controlAlive: alive(control.pid),
      }),
    );
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const publicCommand of [false, true]) {
  for (const signal of ['SIGINT', 'SIGTERM']) {
    test(`${publicCommand ? 'public' : 'actual'} stop PID ${signal} finishes resistant owned-group cleanup`, {
      timeout: 30_000,
    }, async (t) => {
      const directory = mkdtempSync(join(tmpdir(), 'probability-public-stop-'));
      const dataDir = join(directory, 'instance');
      const control = spawn(
        process.execPath,
        ['-e', 'setInterval(()=>{},1000)'],
        { stdio: 'ignore' },
      );
      const entrypoint = publicCommand
        ? 'scripts/probability.mjs'
        : 'scripts/control-probability.mjs';
      const launched = start(
        [entrypoint, 'launch', '--data-dir', dataDir],
        directory,
        'public-stop',
      );
      let stopped;
      let state;
      try {
        const [launchStatus] = await launched.closed;
        assert.equal(launchStatus, 0, launched.output());
        await waitFor(
          () => existsSync(join(directory, 'server.json')),
          'resistant server',
        );
        state = JSON.parse(readFileSync(join(dataDir, 'state.json'), 'utf8'));
        stopped = start(
          [entrypoint, 'stop', '--data-dir', dataDir],
          directory,
          'public-stop',
        );
        await waitFor(
          () => existsSync(join(directory, 'server-term.json')),
          'server TERM before public interruption',
        );
        assert.equal(
          alive(state.pid),
          true,
          'resistant server exited before interruption',
        );
        stopped.child.kill(signal);
        const [status, rawSignal] = await stopped.closed;
        const members = groupMembers(state.pid);
        t.diagnostic(
          JSON.stringify({
            signal,
            status,
            rawSignal,
            members,
            stateRetained: existsSync(join(dataDir, 'state.json')),
            controlAlive: alive(control.pid),
            output: stopped.output(),
          }),
        );
        assert.equal(alive(control.pid), true, 'unrelated control stopped');
        assert.equal(status, signal === 'SIGINT' ? 130 : 143, stopped.output());
        assert.equal(rawSignal, null, stopped.output());
        assert.deepEqual(
          members,
          [],
          'public stop abandoned its detached resistant server',
        );
        assert.equal(
          existsSync(join(dataDir, 'state.json')),
          false,
          'public stop left cleaned state',
        );
      } finally {
        launched.child.kill('SIGKILL');
        stopped?.child.kill('SIGKILL');
        if (state && groupMembers(state.pid).length)
          process.kill(-state.pid, 'SIGKILL');
        if (state)
          await waitFor(
            () => !groupMembers(state.pid).length,
            'public-stop cleanup',
          );
        control.kill('SIGTERM');
        await once(control, 'close');
        t.diagnostic(
          JSON.stringify({
            signal,
            cleanupMembers: state ? groupMembers(state.pid) : [],
            controlAlive: alive(control.pid),
          }),
        );
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
}

test('actual journey retains an earlier failure when browser close rejects', {
  timeout: 30_000,
}, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'probability-close-receipt-'));
  const out = join(directory, 'evidence');
  const run = start(
    [
      'scripts/verify-journeys.mjs',
      '--only',
      'study',
      '--viewport',
      'desktop',
      '--artifacts',
      out,
    ],
    directory,
    'close-reject',
  );
  try {
    const [status] = await run.closed;
    assert.equal(status, 1, run.output());
    assert.ok(
      existsSync(join(out, 'result.json')),
      `failed receipt missing\n${run.output()}`,
    );
    const receipt = JSON.parse(readFileSync(join(out, 'result.json'), 'utf8'));
    assert.equal(receipt.success, false);
    assert.match(
      receipt.failures.join('\n'),
      /injected earlier launch failure/,
    );
    assert.match(receipt.failures.join('\n'), /injected browser close failure/);
  } finally {
    run.child.kill('SIGKILL');
    rmSync(directory, { recursive: true, force: true });
  }
});

test('actual journeys retain a refused viewport owner without acquiring the next viewport', {
  timeout: 30_000,
}, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'probability-stop-refusal-'));
  const out = join(directory, 'evidence');
  const control = spawn(
    process.execPath,
    ['-e', 'setInterval(() => {}, 1000)'],
    { stdio: 'ignore' },
  );
  const run = start(
    ['scripts/verify-journeys.mjs', '--only', 'study', '--artifacts', out],
    directory,
    'stop-refuse',
  );
  let owners = [];
  try {
    const [status, rawSignal] = await run.closed;
    const receipt = JSON.parse(readFileSync(join(out, 'result.json'), 'utf8'));
    const refused = JSON.parse(
      readFileSync(join(directory, 'refused.json'), 'utf8'),
    );
    owners = readFileSync(join(directory, 'servers.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    assert.equal(status, 1, run.output());
    assert.equal(rawSignal, null, run.output());
    assert.equal(
      owners.length,
      1,
      `a refused viewport must prevent another server acquisition\n${run.output()}`,
    );
    assert.equal(receipt.success, false);
    assert.equal(receipt.full, false);
    assert.deepEqual(
      receipt.results.map((record) => record.viewport),
      ['desktop'],
    );
    assert.equal(receipt.results[0].completed, false);
    assert.match(
      receipt.failures.join('\n'),
      /injected journey action failure/,
    );
    assert.match(receipt.failures.join('\n'), /refusing to stop unowned/);
    assert.deepEqual(receipt.retainedDataDirs, [refused.dataDir]);
    assert.equal(
      receipt.cleanup.find((entry) => entry.resource === 'server').status,
      'refused',
    );
    assert.equal(existsSync(join(refused.dataDir, 'state.json')), true);
    assert.match(
      readFileSync(join(out, 'desktop.server.log'), 'utf8'),
      /owned fixture server/,
    );
    assert.equal(alive(refused.state.pid), true, 'refused owner was signalled');
    assert.equal(alive(control.pid), true, 'unrelated control process stopped');
  } finally {
    run.child.kill('SIGKILL');
    if (existsSync(join(directory, 'servers.jsonl')))
      owners = readFileSync(join(directory, 'servers.jsonl'), 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
    for (const owner of owners) {
      if (alive(owner.pid)) process.kill(-owner.pid, 'SIGKILL');
      rmSync(resolve(owner.args.at(-1), '..'), {
        recursive: true,
        force: true,
      });
    }
    control.kill('SIGTERM');
    await Promise.all([run.closed, once(control, 'close')]);
    rmSync(directory, { recursive: true, force: true });
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  for (const publicCommand of [false, true]) {
    test(`${publicCommand ? 'public journey PID' : 'actual smoke'} ${signal} retains a failed receipt and stops its owned detached server`, {
      timeout: 40_000,
    }, async () => {
      const directory = mkdtempSync(
        join(tmpdir(), 'probability-signal-receipt-'),
      );
      const out = join(directory, 'evidence');
      const args = publicCommand
        ? ['scripts/probability.mjs', 'journey', '--id', 'home/start']
        : [
            'scripts/control-probability.mjs',
            'smoke',
            '--only',
            'home/start',
            '--capture',
            '--artifacts',
            out,
          ];
      const control = spawn(
        process.execPath,
        ['-e', 'setInterval(() => {}, 1000)'],
        { stdio: 'ignore' },
      );
      const run = start(args, directory, 'interrupt');
      let state;
      try {
        await waitFor(
          () =>
            existsSync(join(directory, 'browser.json')) &&
            existsSync(join(directory, 'server.json')),
          'browser and server acquisition',
        );
        state = JSON.parse(
          readFileSync(join(directory, 'server.json'), 'utf8'),
        );
        const dataDir = resolve(state.args.at(-1), '..');
        run.child.kill(signal);
        const [status, rawSignal] = await run.exited;
        assert.equal(rawSignal, null, run.output());
        assert.equal(status, signal === 'SIGINT' ? 130 : 143, run.output());
        assert.equal(alive(state.pid), false, 'owned detached server survived');
        assert.equal(
          existsSync(join(dataDir, 'state.json')),
          false,
          'cleaned state retained',
        );
        const evidence = publicCommand
          ? /evidence in (.+)/.exec(run.output())?.[1]?.trim()
          : out;
        assert.ok(evidence, run.output());
        const receipt = JSON.parse(
          readFileSync(join(evidence, 'result.json'), 'utf8'),
        );
        assert.equal(receipt.success, false);
        assert.equal(receipt.interruption.signal, signal);
        assert.equal(
          readFileSync(join(directory, 'closes.txt'), 'utf8'),
          'close\n',
        );
        assert.equal(
          alive(control.pid),
          true,
          'unrelated control process stopped',
        );
      } finally {
        if (state && alive(state.pid)) process.kill(-state.pid, 'SIGKILL');
        if (existsSync(join(directory, 'browser.json'))) {
          const leaf = JSON.parse(
            readFileSync(join(directory, 'browser.json'), 'utf8'),
          );
          if (alive(leaf.pid)) process.kill(leaf.pid, 'SIGKILL');
        }
        run.child.kill('SIGKILL');
        control.kill('SIGTERM');
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
}

for (const scenario of [
  'port-gate',
  'readiness-gate',
  'migration-gate',
  'late-browser',
  'repeat-signals',
]) {
  test(`actual ${scenario === 'migration-gate' ? 'journeys' : 'smoke'} cancellation joins ${scenario}`, {
    timeout: 45_000,
  }, async () => {
    const directory = mkdtempSync(join(tmpdir(), 'probability-acquisition-'));
    const out = join(directory, 'evidence');
    const args =
      scenario === 'migration-gate'
        ? [
            'scripts/verify-journeys.mjs',
            '--only',
            'study',
            '--viewport',
            'desktop',
            '--artifacts',
            out,
          ]
        : [
            'scripts/control-probability.mjs',
            'smoke',
            '--only',
            'home/start',
            '--capture',
            '--artifacts',
            out,
          ];
    const run = start(args, directory, scenario);
    let server;
    let migration;
    try {
      const milestone = {
        'port-gate': 'port',
        'readiness-gate': 'readiness',
        'migration-gate': 'migration',
        'late-browser': 'browser',
        'repeat-signals': 'ui',
      }[scenario];
      await waitFor(
        () => existsSync(join(directory, `${milestone}.json`)),
        milestone,
      );
      if (
        ['readiness-gate', 'late-browser', 'repeat-signals'].includes(scenario)
      )
        await waitFor(
          () => existsSync(join(directory, 'server.json')),
          'owned server',
        );
      if (existsSync(join(directory, 'server.json')))
        server = JSON.parse(
          readFileSync(join(directory, 'server.json'), 'utf8'),
        );
      if (existsSync(join(directory, 'migration.json')))
        migration = JSON.parse(
          readFileSync(join(directory, 'migration.json'), 'utf8'),
        );
      run.child.kill('SIGINT');
      if (scenario === 'late-browser') {
        await waitFor(
          () => !alive(server.pid),
          'server cleanup during pending browser',
        );
        assert.equal(
          existsSync(join(out, 'result.json')),
          false,
          'pending browser was abandoned',
        );
        writeFileSync(join(directory, 'release-browser'), 'release');
      }
      if (scenario === 'repeat-signals') {
        await waitFor(
          () => existsSync(join(directory, 'closing.json')),
          'close started',
        );
        for (const [index, signal] of ['SIGTERM', 'SIGINT'].entries()) {
          run.child.kill(signal);
          await waitFor(
            () =>
              readFileSync(
                join(directory, `signals-${run.child.pid}.txt`),
                'utf8',
              )
                .trim()
                .split('\n').length >=
              index + 2,
            signal,
          );
        }
        writeFileSync(join(directory, 'release-close'), 'release');
      }
      const [status, rawSignal] = await run.exited;
      assert.equal(rawSignal, null, run.output());
      assert.equal(status, 130, run.output());
      const receipt = JSON.parse(
        readFileSync(join(out, 'result.json'), 'utf8'),
      );
      assert.equal(receipt.success, false);
      assert.equal(receipt.interruption.signal, 'SIGINT');
      assert.equal(
        readFileSync(join(directory, 'receipts.txt'), 'utf8').trim().split('\n')
          .length,
        1,
        'receipt committed more than once',
      );
      if (server) assert.equal(alive(server.pid), false, 'server survived');
      if (migration)
        assert.equal(alive(migration.pid), false, 'migration survived');
      if (scenario === 'port-gate' || scenario === 'migration-gate')
        assert.equal(
          existsSync(join(directory, 'server.json')),
          false,
          'server acquired after abort',
        );
      if (scenario === 'late-browser')
        assert.equal(
          existsSync(join(directory, 'ui.json')),
          false,
          'UI began after abort',
        );
      if (scenario === 'repeat-signals')
        assert.equal(receipt.interruption.received.length, 3);
      if (
        ['late-browser', 'repeat-signals', 'migration-gate'].includes(scenario)
      )
        assert.equal(
          readFileSync(join(directory, 'closes.txt'), 'utf8'),
          'close\n',
        );
    } finally {
      run.child.kill('SIGKILL');
      for (const owned of [server, migration])
        if (owned && alive(owned.pid)) process.kill(owned.pid, 'SIGKILL');
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

for (const layer of ['source', 'build', 'browser']) {
  test(`public verify PID forwards SIGTERM during ${layer} and retains its receipt`, {
    timeout: 30_000,
  }, async () => {
    const directory = mkdtempSync(join(tmpdir(), 'probability-public-layer-'));
    const evidence = join(directory, 'evidence', 'result.json');
    const previous = process.env.LIFECYCLE_LAYER;
    process.env.LIFECYCLE_LAYER = layer;
    const run = start(
      [
        'scripts/probability.mjs',
        'verify',
        '--layer',
        'all',
        '--evidence',
        evidence,
      ],
      directory,
      'layer-gate',
    );
    if (previous === undefined) delete process.env.LIFECYCLE_LAYER;
    else process.env.LIFECYCLE_LAYER = previous;
    let owned;
    try {
      await waitFor(
        () => existsSync(join(directory, 'layer.json')),
        'active npm layer',
      );
      owned = JSON.parse(readFileSync(join(directory, 'layer.json'), 'utf8'));
      run.child.kill('SIGTERM');
      const [status, rawSignal] = await run.exited;
      assert.equal(rawSignal, null, run.output());
      assert.equal(status, 143, run.output());
      const receipt = JSON.parse(readFileSync(evidence, 'utf8'));
      assert.equal(receipt.success, false);
      assert.equal(receipt.interruption.signal, 'SIGTERM');
      assert.equal(receipt.checks.at(-1).id, layer);
      assert.equal(receipt.checks.at(-1).signal, 'SIGTERM');
      assert.equal(receipt.checks.at(-1).status, 143);
      assert.equal(receipt.checks.at(-1).groupStopped, true);
      assert.match(
        readFileSync(receipt.checks.at(-1).log, 'utf8'),
        /layer .* started/,
      );
      assert.equal(alive(owned.pid), false);
    } finally {
      run.child.kill('SIGKILL');
      if (owned && alive(owned.pid)) process.kill(owned.pid, 'SIGKILL');
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

test('public verify waits for a leaf after its command leader exits', {
  timeout: 30_000,
}, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'probability-early-leader-'));
  const evidence = join(directory, 'evidence', 'result.json');
  const run = start(
    [
      'scripts/probability.mjs',
      'verify',
      '--layer',
      'source',
      '--evidence',
      evidence,
    ],
    directory,
    'early-leader',
  );
  let owned;
  try {
    await waitFor(
      () => existsSync(join(directory, 'leaf.json')),
      'descendant acquisition',
    );
    owned = JSON.parse(readFileSync(join(directory, 'leaf.json'), 'utf8'));
    assert.equal(
      existsSync(evidence),
      false,
      'leader exit abandoned its descendant',
    );
    writeFileSync(join(directory, 'release-leaf'), 'release');
    const [status] = await run.exited;
    assert.equal(status, 0, run.output());
    assert.equal(alive(owned.pid), false);
    assert.equal(
      JSON.parse(readFileSync(evidence, 'utf8')).checks[0].groupStopped,
      true,
    );
  } finally {
    run.child.kill('SIGKILL');
    if (owned && alive(owned.pid)) process.kill(owned.pid, 'SIGKILL');
    rmSync(directory, { recursive: true, force: true });
  }
});

test('command supervisor drains its group when the public owner disappears', {
  timeout: 30_000,
}, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'probability-owner-loss-'));
  const evidence = join(directory, 'evidence', 'result.json');
  const run = start(
    [
      'scripts/probability.mjs',
      'verify',
      '--layer',
      'source',
      '--evidence',
      evidence,
    ],
    directory,
    'parent-loss',
  );
  let owned;
  try {
    await waitFor(
      () => existsSync(join(directory, 'layer.json')),
      'owned command',
    );
    owned = JSON.parse(readFileSync(join(directory, 'layer.json'), 'utf8'));
    run.child.kill('SIGKILL');
    await run.exited;
    await waitFor(() => !alive(owned.pid), 'parent-loss child teardown');
    await run.closed;
    assert.equal(
      existsSync(evidence),
      false,
      'SIGKILL cannot promise an owner receipt',
    );
  } finally {
    run.child.kill('SIGKILL');
    if (owned && alive(owned.pid)) process.kill(owned.pid, 'SIGKILL');
    rmSync(directory, { recursive: true, force: true });
  }
});

test('actual smoke rolls back a spawned server when state publication fails', {
  timeout: 30_000,
}, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'probability-state-failure-'));
  const out = join(directory, 'evidence');
  const run = start(
    [
      'scripts/control-probability.mjs',
      'smoke',
      '--only',
      'home/start',
      '--capture',
      '--artifacts',
      out,
    ],
    directory,
    'state-fail',
  );
  let owned;
  try {
    const [status] = await run.exited;
    assert.equal(status, 1, run.output());
    owned = JSON.parse(
      readFileSync(join(directory, 'server-process.json'), 'utf8'),
    );
    const receipt = JSON.parse(readFileSync(join(out, 'result.json'), 'utf8'));
    assert.equal(receipt.success, false);
    assert.match(
      receipt.failures.join('\n'),
      /injected state publication failure/,
    );
    assert.equal(
      alive(owned.serverPid),
      false,
      'state-write failure leaked the spawned server',
    );
    assert.equal(
      existsSync(join(directory, 'browser.json')),
      false,
      'browser launched after server failure',
    );
  } finally {
    if (owned && alive(owned.serverPid))
      process.kill(-owned.serverPid, 'SIGKILL');
    run.child.kill('SIGKILL');
    rmSync(directory, { recursive: true, force: true });
  }
});
