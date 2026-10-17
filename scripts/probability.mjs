#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, matchesGlob, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const mapPath = join(root, 'verification/features.json');
const statePath = join(
  root,
  '.cursor/skills/verify-probability/features/smoke.json',
);
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const digest = (data) => createHash('sha256').update(data).digest('hex');

export function workspaceIdentity(directory = root) {
  const repo = (...args) =>
    execFileSync('git', args, { cwd: directory, encoding: 'utf8' });
  const paths = [
    ...new Set(
      repo('ls-files', '--cached', '--others', '--exclude-standard', '-z')
        .split('\0')
        .filter(Boolean),
    ),
  ].sort();
  const files = paths.map((path) => {
    const full = join(directory, path);
    const entry = lstatSync(full, { throwIfNoEntry: false });
    return {
      path,
      digest: entry
        ? digest(
            entry.isSymbolicLink() ? readlinkSync(full) : readFileSync(full),
          )
        : null,
      executable: Boolean(entry && entry.mode & 0o111),
    };
  });
  const built = [];
  const walk = (directory, prefix = '') => {
    if (!existsSync(directory)) return;
    for (const item of readdirSync(directory, { withFileTypes: true }).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      const path = join(prefix, item.name);
      if (item.isDirectory()) walk(join(directory, item.name), path);
      else
        built.push({
          path,
          digest: digest(readFileSync(join(directory, item.name))),
        });
    }
  };
  walk(join(directory, 'dist'));
  return {
    head: repo('rev-parse', 'HEAD').trim(),
    dirty: Boolean(repo('status', '--porcelain').trim()),
    sourceDigest: digest(JSON.stringify(files)),
    files,
    featureMapDigest: existsSync(join(directory, 'verification/features.json'))
      ? digest(readFileSync(join(directory, 'verification/features.json')))
      : null,
    buildDigest: built.length ? digest(JSON.stringify(built)) : null,
  };
}

export function planFiles(files, map) {
  const all = map.features.map((feature) => feature.id);
  const selected = new Set();
  const reasons = [];
  for (const file of files) {
    const shared = map.shared.some((pattern) => matchesGlob(file, pattern));
    const owners = map.features.filter((feature) =>
      feature.owners.some((pattern) => matchesGlob(file, pattern)),
    );
    const affected =
      shared || !owners.length ? all : owners.map((feature) => feature.id);
    for (const id of affected) selected.add(id);
    reasons.push({
      file,
      reason: shared
        ? 'shared'
        : !owners.length
          ? 'unmapped, full coverage'
          : 'owned',
      features: shared || !owners.length ? 'all' : affected,
    });
  }
  return { features: [...selected], reasons };
}

export function checkMap(map, states, sourceFiles) {
  const errors = [];
  if (map.version !== 1 || !Array.isArray(map.features) || !map.features.length)
    return ['A nonempty version 1 feature map is required.'];
  if (!Array.isArray(map.shared))
    errors.push('Shared ownership must be a pattern list.');
  const ids = new Set();
  for (const feature of map.features) {
    if (!/^[a-z][a-z-]*$/.test(feature.id) || ids.has(feature.id))
      errors.push(`Invalid or duplicate feature ${feature.id}.`);
    ids.add(feature.id);
    if (
      !feature.purpose ||
      !Array.isArray(feature.owners) ||
      !feature.owners.length
    )
      errors.push(`Feature ${feature.id} needs its purpose and owners.`);
    else if (sourceFiles)
      for (const pattern of feature.owners)
        if (!sourceFiles.some((file) => matchesGlob(file, pattern)))
          errors.push(
            `Feature ${feature.id} owner ${pattern} matches no source.`,
          );
    if (!states.some((state) => state.feature === feature.id))
      errors.push(`Feature ${feature.id} has no driven state.`);
  }
  const stateIds = new Set();
  for (const state of states) {
    const id = `${state.feature}/${state.id}`;
    if (!ids.has(state.feature) || stateIds.has(id))
      errors.push(`Unmapped or duplicate state ${id}.`);
    stateIds.add(id);
    if (typeof state.url !== 'string' || !state.url.startsWith('/'))
      errors.push(`State ${id} needs a local route.`);
    if (
      state.captureSelector !== undefined &&
      (typeof state.captureSelector !== 'string' ||
        !state.captureSelector.trim())
    )
      errors.push(`State ${id} needs a nonempty capture selector.`);
  }
  return errors;
}

function catalog() {
  const directory = join(root, 'src/content');
  const byId = new Map(
    readdirSync(directory)
      .filter((file) => /^part\d+\.json$/.test(file))
      .flatMap((file) => read(join(directory, file)))
      .map((lesson) => [lesson.id, lesson]),
  );
  return read(join(directory, 'order.json')).map((id) => {
    const lesson = byId.get(id);
    if (!lesson) throw new Error(`Missing lesson ${id}.`);
    return lesson;
  });
}

function parse(args) {
  const command = args.shift() ?? 'help';
  const options = {};
  const booleans = new Set(['json', 'check', 'migrate']);
  const allowed = new Set([
    'json',
    'check',
    'migrate',
    'id',
    'feature',
    'base',
    'head',
    'layer',
    'evidence',
    'url',
    'data-dir',
    'mode',
  ]);
  while (args.length) {
    const raw = args.shift();
    if (!raw.startsWith('--') || !allowed.has(raw.slice(2)))
      throw new Error(`Unknown option ${raw}. Run agent help.`);
    const name = raw.slice(2);
    if (Object.hasOwn(options, name))
      throw new Error(`Repeated option --${name}.`);
    if (booleans.has(name)) options[name] = true;
    else {
      const value = args.shift();
      if (!value || value.startsWith('--'))
        throw new Error(`Missing value for --${name}.`);
      options[name] = value;
    }
  }
  return { command, options };
}

function run(args, logPath, executable = process.execPath) {
  const result = spawnSync(executable, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: process.env,
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (logPath) {
    mkdirSync(dirname(logPath), { recursive: true });
    writeFileSync(logPath, output);
  } else if (output) process.stderr.write(output);
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export async function main(args) {
  const { command, options } = parse([...args]);
  const accepted = {
    help: [],
    doctor: ['data-dir'],
    map: ['check'],
    lessons: [],
    show: ['id'],
    plan: ['base', 'head'],
    launch: ['data-dir', 'mode', 'migrate'],
    stop: ['data-dir'],
    journey: ['id', 'feature'],
    verify: ['layer', 'evidence'],
    remote: ['url'],
  };
  for (const name of Object.keys(options))
    if (
      name !== 'json' &&
      accepted[command] &&
      !accepted[command].includes(name)
    )
      throw new Error(`Unknown option --${name} for ${command}.`);
  const map = read(mapPath);
  const states = read(statePath);
  const features = map.features.map((feature) => feature.id);
  if (options.feature && !features.includes(options.feature))
    throw new Error(`Unknown feature ${options.feature}.`);
  const data = options['data-dir'] ? ['--data-dir', options['data-dir']] : [];
  if (command === 'help')
    return {
      commands: {
        doctor:
          'Inspect runtime, dependencies, hosting identity and browser availability.',
        map: 'List feature ownership and driven states. Use --check to validate.',
        lessons:
          'List the ordered syllabus. Use show --id F01 for full lesson content.',
        plan: 'Select affected features from --base REV and optional --head REV. Unknown files select all.',
        launch:
          'Launch an owned local instance. Optional --mode dev, --migrate (local D1), --data-dir PATH.',
        stop: 'Stop the instance recorded in --data-dir PATH.',
        journey:
          'Capture development evidence for exactly --id FEATURE/STATE or --feature ID.',
        verify: 'Run --layer source, browser or all and save --evidence PATH.',
        remote:
          'Check HTTPS and the public shell at --url HTTPS_URL. Browser and account journeys are separate.',
      },
      examples: [
        'npm run agent -- doctor',
        'npm run agent -- map --check',
        'npm run agent -- show --id R05',
        'npm run agent -- verify --layer all --evidence artifacts/release/result.json',
      ],
    };
  if (command === 'doctor') {
    if (options['data-dir']) {
      const status = run([
        join(root, 'scripts/control-probability.mjs'),
        'doctor',
        ...data,
      ]);
      if (status) throw new Error('Owned-instance doctor failed.');
    }
    const chrome =
      process.env.CHROME_PATH ??
      [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium',
      ].find(existsSync);
    const result = {
      node: process.version,
      root,
      branch: git('branch', '--show-current'),
      source: git('rev-parse', 'HEAD'),
      dependencies: existsSync(join(root, 'node_modules/vinext')),
      browser: chrome ?? null,
      hosting: read(join(root, '.openai/hosting.json')),
    };
    if (!result.dependencies || !result.browser) process.exitCode = 1;
    return result;
  }
  if (command === 'map') {
    const errors = checkMap(
      map,
      states,
      workspaceIdentity()
        .files.filter((file) => file.digest)
        .map((file) => file.path),
    );
    if (options.check && errors.length) throw new Error(errors.join('\n'));
    return {
      ...map,
      states: states.map((state) => `${state.feature}/${state.id}`),
      errors,
    };
  }
  if (command === 'lessons')
    return catalog().map(({ id, title, cluster, prerequisites, lab }) => ({
      id,
      title,
      cluster,
      prerequisites,
      lab,
    }));
  if (command === 'show') {
    const lesson = catalog().find((item) => item.id === options.id);
    if (!lesson)
      throw new Error(`Unknown lesson ${options.id ?? '(missing --id)'}.`);
    return lesson;
  }
  if (command === 'plan') {
    if (!options.base) throw new Error('plan requires --base REV.');
    const base = git(
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${options.base}^{commit}`,
    );
    const head = git(
      'rev-parse',
      '--verify',
      '--end-of-options',
      `${options.head ?? 'HEAD'}^{commit}`,
    );
    const files = [
      ...new Set(
        [
          ...git('diff', '--name-only', '-z', base, head).split('\0'),
          ...(!options.head
            ? git('diff', '--name-only', '-z', 'HEAD').split('\0')
            : []),
          ...(!options.head
            ? git('ls-files', '--others', '--exclude-standard', '-z').split(
                '\0',
              )
            : []),
        ].filter(Boolean),
      ),
    ];
    const plan = planFiles(files, map);
    return {
      base,
      head,
      workingTree: !options.head,
      ...plan,
      states: states
        .filter((state) => plan.features.includes(state.feature))
        .map((state) => `${state.feature}/${state.id}`),
      unchanged: !files.length,
    };
  }
  if (['launch', 'stop', 'journey'].includes(command)) {
    const driverArgs = [command === 'journey' ? 'smoke' : command, ...data];
    if (options.mode) driverArgs.push('--mode', options.mode);
    if (options.migrate) driverArgs.push('--migrate');
    if (command === 'journey') {
      if (Boolean(options.id) === Boolean(options.feature))
        throw new Error(
          'journey requires exactly --id FEATURE/STATE or --feature ID.',
        );
      driverArgs.push(
        options.id ? '--only' : '--feature',
        options.id ?? options.feature,
        '--capture',
      );
    }
    const code = run([
      join(root, 'scripts/control-probability.mjs'),
      ...driverArgs,
    ]);
    process.exitCode = code;
    return { command, success: code === 0 };
  }
  if (command === 'verify') {
    const layer = options.layer ?? 'all';
    if (!['source', 'browser', 'all'].includes(layer))
      throw new Error(`Unknown verification layer ${layer}.`);
    const evidence = resolve(
      options.evidence ??
        join(root, 'artifacts/release', randomUUID(), 'result.json'),
    );
    if (existsSync(evidence))
      throw new Error(
        `Evidence already exists: ${evidence}; choose a new path.`,
      );
    const source = workspaceIdentity();
    const checks = [];
    const tasks =
      layer === 'source'
        ? [['source', 'verify:source']]
        : layer === 'browser'
          ? [['browser', 'verify:browser']]
          : [
              ['source', 'verify:source'],
              ['build', 'build'],
              ['browser', 'verify:browser'],
            ];
    for (const [id, script] of tasks) {
      const log = join(
        dirname(evidence),
        `${id}-${randomUUID().slice(0, 8)}.log`,
      );
      const status = run(['run', script], log, 'npm');
      checks.push({ id, status, log });
      if (status) break;
    }
    const after = workspaceIdentity();
    const sourceUnchanged = source.sourceDigest === after.sourceDigest;
    const result = {
      source,
      after,
      sourceUnchanged,
      full:
        layer === 'all' &&
        checks.length === tasks.length &&
        checks.every((item) => item.status === 0),
      checks,
      success:
        sourceUnchanged &&
        checks.length === tasks.length &&
        checks.every((item) => item.status === 0),
      at: new Date().toISOString(),
    };
    mkdirSync(dirname(evidence), { recursive: true });
    writeFileSync(evidence, JSON.stringify(result, null, 2));
    if (!result.success) process.exitCode = 1;
    return result;
  }
  if (command === 'remote') {
    if (!options.url) throw new Error('remote requires --url HTTPS_URL.');
    const url = new URL(options.url);
    if (url.protocol !== 'https:')
      throw new Error('Remote verification requires HTTPS.');
    const response = await fetch(
      new URL('/lessons/f01-sample-spaces-and-events', url),
    );
    const body = await response.text();
    if (!response.ok || !body.includes('Probability'))
      throw new Error(`Public lesson failed with ${response.status}.`);
    return {
      url: response.url,
      status: response.status,
      publicShell: true,
      authenticatedProgress: 'requires separate signed-in journey',
    };
  }
  throw new Error(`Unknown command ${command}. Run agent help.`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main(process.argv.slice(2))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
