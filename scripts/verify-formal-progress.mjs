import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const coverage = JSON.parse(
  await readFile(new URL('../formal/progress/coverage.json', import.meta.url)),
);
const hash = (data) => createHash('sha256').update(data).digest('hex');
const source = Object.fromEntries(
  await Promise.all(
    Object.keys(coverage.sources).map(async (file) => [
      file,
      await readFile(path.join(root, file), 'utf8'),
    ]),
  ),
);
const arguments_ = process.argv.slice(2);
assert.ok(
  arguments_.every((argument) => argument === '--mutations'),
  'Usage: npm run verify:formal -- [--mutations]',
);
const directory = path.join(
  root,
  'artifacts/formal-progress',
  new Date().toISOString().replaceAll(':', '-'),
);
await mkdir(directory, { recursive: true });
const evidence = {
  outcome: 'running',
  head: spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).stdout.trim(),
  syncCommit: coverage.syncCommit,
  sources: Object.fromEntries(
    Object.entries(source).map(([file, text]) => [file, hash(text)]),
  ),
  verificationSources: Object.fromEntries(
    await Promise.all(
      [
        'formal/progress/ProgressServer.tla',
        'formal/progress/ProgressServer.cfg',
        'formal/progress/ProgressClient.tla',
        'formal/progress/ProgressClient.cfg',
        'formal/progress/coverage.json',
        'formal/progress/README.md',
        '.agents/skills/progress-integrity/SKILL.md',
        'scripts/formal-progress-bridge.mjs',
        'scripts/verify-formal-progress.mjs',
      ].map(async (file) => [
        file,
        hash(await readFile(path.join(root, file))),
      ]),
    ),
  ),
  node: process.version,
  tool: coverage.tool,
  modelRuns: [],
  bridgeRuns: [],
};
const run = (executable, args, name, env = process.env) => {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    env,
    timeout: 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  return writeFile(path.join(directory, `${name}.log`), output).then(() => ({
    output,
    status: result.status,
    error: result.error?.message,
  }));
};

try {
  const toolDirectory = path.join(root, 'artifacts/formal-progress/tools');
  await mkdir(toolDirectory, { recursive: true });
  const jar = path.join(
    toolDirectory,
    `tla2tools-${coverage.tool.release}.jar`,
  );
  let bytes;
  try {
    bytes = await readFile(jar);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const response = await fetch(coverage.tool.url, {
      signal: AbortSignal.timeout(60_000),
    });
    assert.ok(response.ok, `TLC download unavailable: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(hash(bytes), coverage.tool.sha256, 'TLC download checksum');
    await writeFile(jar, bytes, { flag: 'wx' });
  }
  assert.equal(hash(bytes), coverage.tool.sha256, 'Cached TLC checksum');
  const java = await run('java', ['-version'], 'java-version');
  assert.equal(
    java.status,
    0,
    `Java 11+ required. ${java.error ?? java.output}`,
  );
  const checks = [
    ['ProgressServer', 'none', null],
    ['ProgressClient', 'none', null],
    ['ProgressServer', 'owner', 'OwnerAuthorized'],
    ['ProgressServer', 'revision', 'RevisionChecked'],
    ['ProgressServer', 'revision', 'RetryAtMostOnce'],
    ['ProgressServer', 'replay', 'ReplayHonest'],
    ['ProgressClient', 'generation', 'GenerationIsolated'],
    ['ProgressClient', 'response-owner', 'ResponseOwnerChecked'],
    ['ProgressClient', 'merge', 'ConfirmedRevisionMonotone'],
  ];
  for (const [module, fault, property] of checks) {
    const name = `${module}-${property ?? 'baseline'}`;
    const config = path.join(directory, `${name}.cfg`);
    await writeFile(
      config,
      property
        ? `CONSTANT Fault = "${fault}"\nSPECIFICATION Spec\nINVARIANT ${property}\nCHECK_DEADLOCK FALSE\n`
        : await readFile(path.join(root, `formal/progress/${module}.cfg`)),
    );
    const result = await run(
      'java',
      [
        '-Xmx512m',
        '-XX:+UseParallelGC',
        '-cp',
        jar,
        'tlc2.TLC',
        '-workers',
        '1',
        '-seed',
        '0',
        '-fp',
        '0',
        '-cleanup',
        '-metadir',
        path.join(directory, `${name}-states`),
        '-config',
        path.relative(root, config),
        `formal/progress/${module}.tla`,
      ],
      name,
    );
    assert.ok(
      result.output.includes(coverage.tool.version),
      'Pinned TLC version',
    );
    if (property) {
      assert.equal(
        result.status,
        12,
        `${name} must fail semantically. ${result.output}`,
      );
      assert.ok(
        result.output.includes(`Invariant ${property} is violated.`),
        `${name} must fail its named property. ${result.output}`,
      );
      assert.ok(
        result.output.includes('The behavior up to this point is:'),
        `${name} must produce a counterexample`,
      );
    } else {
      assert.equal(
        result.status,
        0,
        `${name} failed. ${result.error ?? result.output}`,
      );
      assert.ok(
        result.output.includes(
          'Model checking completed. No error has been found.',
        ),
        `${name} must complete exhaustive model checking`,
      );
    }
    const counts = result.output.match(
      /(\d+) states generated, (\d+) distinct states found, 0 states left on queue\./,
    );
    if (!property)
      assert.ok(
        counts && Number(counts[1]) > 0 && Number(counts[2]) > 0,
        `${name} must explore a nonempty state space with no queued states`,
      );
    evidence.modelRuns.push({
      name,
      fault,
      property,
      status: result.status,
      counts: counts?.[0],
    });
    console.log(`${name}: ${property ? 'expected counterexample' : 'PASS'}`);
  }

  const bridge = await run(
    process.execPath,
    ['scripts/formal-progress-bridge.mjs'],
    'bridge-baseline',
    { ...process.env, FORMAL_PROGRESS_ROOT: root },
  );
  const summary = JSON.parse(
    bridge.output.split('\n').find((line) => line.startsWith('{')),
  );
  assert.equal(summary.serverSchedules, 20, 'Complete SQL schedule selection');
  assert.equal(
    summary.clientSchedules,
    15,
    'Complete client schedule selection',
  );
  assert.deepEqual(summary.assertions.toSorted(), [
    'ConfirmedRevisionMonotone',
    'GenerationIsolated',
    'LostResponseRecovery',
    'OwnerAuthorized',
    'ReplayHonest',
    'ResponseOwnerChecked',
    'RetryAtMostOnce',
    'RevisionChecked',
  ]);
  assert.equal(
    bridge.status,
    0,
    `Actual-code bridge failed. ${bridge.error ?? bridge.output}`,
  );
  evidence.bridgeRuns.push({
    name: 'baseline',
    status: bridge.status,
    output: bridge.output.trim(),
  });
  console.log(`Actual-code bridge: ${bridge.output.trim().split('\n')[0]}`);

  if (arguments_.includes('--mutations')) {
    const mutations = [
      {
        name: 'sql-owner',
        file: 'server/progress.ts',
        before: 'WHERE owner = ? AND lesson_id = ? AND revision = ?',
        after: 'WHERE ? IS NOT NULL AND lesson_id = ? AND revision = ?',
        property: 'OwnerAuthorized',
      },
      {
        name: 'owner',
        file: 'server/progress.ts',
        before: 'if (mutation && mutation.expectedOwner !== owner)',
        after: 'if (false)',
        property: 'OwnerAuthorized',
      },
      {
        name: 'revision',
        file: 'server/progress.ts',
        before: 'AND revision = ? RETURNING',
        after: 'AND ? >= 0 RETURNING',
        property: 'RevisionChecked',
      },
      {
        name: 'replay',
        file: 'server/progress.ts',
        before: 'current?.last_mutation_id === mutationId &&',
        after: 'current !== null &&',
        property: 'ReplayHonest',
      },
      {
        name: 'generation',
        file: 'src/progress.ts',
        before: 'version === generation &&',
        after: 'true &&',
        property: 'GenerationIsolated',
      },
      {
        name: 'merge',
        file: 'src/progress.ts',
        before:
          'if (row.revision >= (data.records.get(row.lessonId)?.revision ?? 0))',
        after: 'if (true)',
        property: 'ConfirmedRevisionMonotone',
      },
      {
        name: 'response-owner',
        file: 'src/progress.ts',
        before: 'value.owner !== owner ||',
        after: 'false ||',
        property: 'ResponseOwnerChecked',
      },
      {
        name: 'retry-command',
        file: 'src/progress.ts',
        before: 'item.command ??= {',
        after: 'item.command = {',
        property: 'LostResponseRecovery',
      },
    ];
    for (const mutation of mutations) {
      const scratch = path.join(directory, 'mutants', mutation.name);
      for (const [file, text] of Object.entries(source)) {
        const destination = path.join(scratch, file);
        await mkdir(path.dirname(destination), { recursive: true });
        assert.ok(
          file !== mutation.file || text.split(mutation.before).length === 2,
          `Unambiguous mutation ${mutation.name}`,
        );
        await writeFile(
          destination,
          file === mutation.file
            ? text.replace(mutation.before, mutation.after)
            : text,
        );
      }
      await mkdir(path.join(scratch, 'src/content'), { recursive: true });
      await writeFile(
        path.join(scratch, 'src/content/order.json'),
        await readFile(path.join(root, 'src/content/order.json')),
      );
      const result = await run(
        process.execPath,
        ['scripts/formal-progress-bridge.mjs'],
        `bridge-mutant-${mutation.name}`,
        { ...process.env, FORMAL_PROGRESS_ROOT: scratch },
      );
      assert.equal(
        result.status,
        1,
        `Real-code mutation ${mutation.name} must fail an assertion. ${result.error ?? result.output}`,
      );
      assert.ok(
        result.output.includes('AssertionError') &&
          result.output.includes(`${mutation.property}:`),
        `Real-code mutation ${mutation.name} must fail ${mutation.property}, not setup. ${result.output}`,
      );
      evidence.bridgeRuns.push({
        name: mutation.name,
        property: mutation.property,
        status: result.status,
      });
      console.log(
        `Actual-code mutation ${mutation.name}: caught ${mutation.property}`,
      );
    }
  }
  assert.deepEqual(
    evidence.sources,
    coverage.sources,
    'Covered source changed. Follow the progress-integrity skill maintenance steps before moving the sync record.',
  );
  evidence.outcome = 'pass';
  console.log(`PASS. Evidence ${path.relative(root, directory)}`);
} catch (error) {
  evidence.outcome = 'failed';
  evidence.error = error.message;
  throw error;
} finally {
  await writeFile(
    path.join(directory, 'result.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
}
