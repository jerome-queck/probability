#!/usr/bin/env node
// Driver CLI for the probability site. Launches the app from its own data dir, checks
// it, drives it in headless Chrome and saves evidence. See
// .cursor/skills/verify-probability/SKILL.md for the workflow.
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  capturePage,
  openDetails,
  renderingProblems,
  viewports,
  watchErrors,
} from './browser-probability.mjs';

export {
  capturePage,
  renderingProblems,
  viewports,
  watchErrors,
} from './browser-probability.mjs';

import { workspaceIdentity } from './probability.mjs';
import { selectSmokeStates } from './smoke-selection.mjs';
import { runCommand, watchTermination } from './verification-process.mjs';

export const commands = [
  'launch',
  'doctor',
  'open',
  'click',
  'set-range',
  'snapshot',
  'screenshot',
  'stop',
  'smoke',
  'help',
];
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const cmd = args[0] ?? 'help';
const executable =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
const termination =
  executable && ['launch', 'stop', 'smoke'].includes(cmd)
    ? watchTermination()
    : null;
const valueOptions = new Set([
  'data-dir',
  'port',
  'mode',
  'url',
  'role',
  'name',
  'value',
  'path',
  'only',
  'feature',
  'artifacts',
]);
const flagOptions = new Set(['capture', 'update-baselines', 'migrate']);
function validateArgs() {
  const accepted = {
    launch: ['data-dir', 'port', 'mode', 'migrate'],
    doctor: ['data-dir'],
    stop: ['data-dir'],
    open: ['data-dir', 'url'],
    click: ['data-dir', 'url', 'role', 'name'],
    'set-range': ['data-dir', 'url', 'name', 'value'],
    snapshot: ['data-dir', 'url', 'path'],
    screenshot: ['data-dir', 'url', 'path'],
    smoke: ['only', 'feature', 'artifacts', 'capture', 'update-baselines'],
    help: [],
  };
  const seen = new Set();
  for (let i = 1; i < args.length; i++) {
    const name = args[i].slice(2);
    if (
      !args[i].startsWith('--') ||
      !(valueOptions.has(name) || flagOptions.has(name)) ||
      (accepted[cmd] && !accepted[cmd].includes(name))
    )
      throw new Error(`unknown option ${args[i]}`);
    if (seen.has(name)) throw new Error(`Repeated option --${name}`);
    seen.add(name);
    if (valueOptions.has(name)) {
      const value = args[++i];
      if (!value || value.startsWith('--'))
        throw new Error(`Missing value for --${name}`);
    }
  }
  if (seen.has('capture') && seen.has('update-baselines'))
    throw new Error('Choose --capture or --update-baselines.');
  if (
    cmd === 'launch' &&
    seen.has('port') &&
    (!/^\d+$/.test(opt('port')) || Number(opt('port')) > 65535)
  )
    throw new Error('Invalid --port; expected 0 to 65535.');
  if (['click', 'set-range'].includes(cmd) && !seen.has('name'))
    throw new Error(`${cmd} requires --name.`);
  if (cmd === 'set-range' && !seen.has('value'))
    throw new Error('set-range requires --value.');
  if (
    cmd === 'smoke' &&
    (!Number.isFinite(maxDiffRatio) || maxDiffRatio < 0 || maxDiffRatio > 0.002)
  )
    throw new Error('VISUAL_MAX_DIFF must be between 0 and 0.002.');
}
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
let keptLog = null; // where smoke keeps the server log after its temp dir goes
let dataDir = resolve(
  opt(
    'data-dir',
    process.env.PROBABILITY_DATA_DIR ?? join(root, '.verify-run'),
  ),
);
const statePathOf = () => join(dataDir, 'state.json');
const readState = () =>
  existsSync(statePathOf())
    ? JSON.parse(readFileSync(statePathOf(), 'utf8'))
    : null;

function freePort(signal) {
  signal?.throwIfAborted();
  return new Promise((ok, reject) => {
    const server = createServer();
    const finish = (error, port) => {
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else ok(port);
    };
    const abort = () => server.close(() => finish(signal.reason));
    server.once('error', (error) => server.close(() => finish(error)));
    signal?.addEventListener('abort', abort, { once: true });
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => finish(signal?.aborted ? signal.reason : null, port));
    });
  });
}

async function launch() {
  const signal = termination?.signal;
  signal?.throwIfAborted();
  mkdirSync(dataDir, { recursive: true });
  const existing = readState();
  if (existing && (alive(existing.pid) || groupAlive(existing.pid)))
    throw new Error(
      `already running (pid ${existing.pid}) for ${dataDir}; stop it first`,
    );
  const mode = opt('mode', 'preview');
  if (!['preview', 'dev'].includes(mode))
    throw new Error(`unknown server mode ${mode}`);
  if (
    mode === 'preview' &&
    !existsSync(join(root, 'dist/server/wrangler.json'))
  )
    throw new Error(
      'dist/ is missing; run npm run build first, or use --mode dev',
    );
  const port = Number(opt('port', 0)) || (await freePort(signal));
  signal?.throwIfAborted();
  if (args.includes('--migrate')) await migrateLocalD1();
  signal?.throwIfAborted();
  const token = randomUUID();
  const log = join(dataDir, 'server.log');
  let state;
  try {
    const logFd = openSync(log, 'a');
    let child;
    try {
      child = spawn(
        process.execPath,
        [
          join(root, 'scripts/serve-probability.mjs'),
          token,
          mode,
          String(port),
          join(dataDir, 'storage'),
        ],
        {
          cwd: root,
          detached: true,
          stdio: ['ignore', logFd, logFd],
        },
      );
    } finally {
      closeSync(logFd);
    }
    state = {
      pid: child.pid,
      token,
      port,
      url: `http://127.0.0.1:${port}`,
      mode,
      log,
      startedAt: new Date().toISOString(),
    };
    const spawned = new Promise((ok, reject) => {
      child.once('spawn', ok);
      child.once('error', reject);
    });
    child.unref();
    writeFileSync(statePathOf(), JSON.stringify(state, null, 2));
    await spawned;
    signal?.throwIfAborted();
    for (let i = 0; i < 300; i += 1) {
      signal?.throwIfAborted();
      if (!alive(state.pid)) break;
      try {
        const request = AbortSignal.timeout(2000);
        const response = await fetch(state.url, {
          signal: signal ? AbortSignal.any([signal, request]) : request,
        });
        signal?.throwIfAborted();
        if (response.ok) {
          console.log(
            `READY ${state.url} pid=${state.pid} mode=${mode} data-dir=${dataDir}`,
          );
          return;
        }
      } catch (error) {
        if (signal?.aborted) throw error;
      }
      await new Promise((ok) => setTimeout(ok, 200));
    }
    throw new Error(
      `server did not answer on ${state.url}; see ${keptLog ?? log}`,
    );
  } catch (error) {
    if (state?.pid) {
      try {
        await stop({ state });
      } catch (cleanup) {
        throw new AggregateError(
          [error, cleanup],
          `${error.message}; rollback: ${cleanup.message}; state retained in ${dataDir}`,
        );
      }
    }
    throw error;
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function owns(state) {
  if (
    !state ||
    !Number.isInteger(state.pid) ||
    state.pid < 1 ||
    !/^[0-9a-f-]{36}$/.test(state.token ?? '') ||
    !['dev', 'preview'].includes(state.mode) ||
    !Number.isInteger(state.port) ||
    state.port < 1 ||
    state.port > 65535 ||
    state.url !== `http://127.0.0.1:${state.port}`
  )
    return false;
  try {
    const row = execFileSync(
      'ps',
      ['-p', String(state.pid), '-o', 'pgid=,command='],
      { encoding: 'utf8', timeout: 500, detached: true },
    ).trim();
    const match = /^(\d+)\s+(.+)$/.exec(row);
    const expected = [
      process.execPath,
      join(root, 'scripts/serve-probability.mjs'),
      state.token,
      state.mode,
      String(state.port),
      join(dataDir, 'storage'),
    ].join(' ');
    return Number(match?.[1]) === state.pid && match?.[2] === expected;
  } catch {
    return false;
  }
}

async function migrateLocalD1() {
  const built = join(root, 'dist/server/wrangler.json');
  if (!existsSync(built))
    throw new Error('Local migrations require npm run build first.');
  const config = JSON.parse(readFileSync(built, 'utf8'));
  const path = join(dataDir, 'migrations.wrangler.json');
  writeFileSync(
    path,
    JSON.stringify({
      name: config.name,
      compatibility_date: config.compatibility_date,
      d1_databases: config.d1_databases.map((db) => ({
        ...db,
        migrations_dir: join(root, 'drizzle'),
      })),
    }),
  );
  for (const db of config.d1_databases) {
    termination?.signal.throwIfAborted();
    const result = await runCommand({
      file: process.execPath,
      args: [
        join(root, 'node_modules/wrangler/bin/wrangler.js'),
        'd1',
        'migrations',
        'apply',
        db.binding,
        '--local',
        '--config',
        path,
        '--persist-to',
        join(dataDir, 'storage'),
      ],
      cwd: root,
      signal: termination?.signal,
      deadline: termination?.deadline,
      budgetMs: termination?.budgetMs,
    });
    if (result.status || result.cleanupFailure)
      throw new Error(
        `migration failed: ${result.cleanupFailure ?? result.output}`,
      );
  }
}

async function doctor() {
  const s = readState();
  const problems = [];
  if (!s) problems.push(`no launch recorded in ${dataDir}`);
  else {
    if (!owns(s))
      problems.push(`recorded pid ${s.pid} is not the owned server`);
    else
      try {
        const html = await (await fetch(s.url)).text();
        if (!html.includes('Probability'))
          problems.push('page has no Probability shell');
        if (!/Probability/.test(html))
          problems.push('page title is not the probability site');
        const deep = await fetch(
          `${s.url}/lessons/f01-sample-spaces-and-events`,
        );
        if (!deep.ok) problems.push(`deep lesson link returned ${deep.status}`);
      } catch (e) {
        problems.push(`cannot reach ${s.url}: ${e.message}`);
      }
  }
  if (problems.length)
    throw new Error(`doctor: FAIL\n- ${problems.join('\n- ')}`);
  console.log(`doctor: OK ${s.url} pid=${s.pid} mode=${s.mode}`);
  return s;
}

async function browser(fn) {
  const s = await doctor();
  const { chromium } = await import('playwright-core');
  const executablePath =
    process.env.CHROME_PATH ??
    [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
    ].find(existsSync);
  const b = await chromium.launch({ executablePath, headless: true });
  const page = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  try {
    await page.goto(s.url + (opt('url', '/') ?? '/'), {
      waitUntil: 'networkidle',
    });
    const out = await fn(page);
    if (errors.length) throw new Error(`browser errors: ${errors.join(' | ')}`);
    return out;
  } finally {
    await b.close();
  }
}

const save = (path, data) => {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, data);
  console.log(`saved ${path}`);
};
const heading = (page) => page.locator('h1').first().innerText();

function groupAlive(pid) {
  const rows = execFileSync('ps', ['-axo', 'pgid=,stat='], {
    encoding: 'utf8',
    timeout: 500,
    detached: true,
  });
  return rows.split('\n').some((row) => {
    const match = /^\s*(\d+)\s+(\S+)/.exec(row);
    return Number(match?.[1]) === pid && !match?.[2].startsWith('Z');
  });
}

async function stop({ state = readState() } = {}) {
  const s = state;
  if (!s) return console.log('nothing to stop');
  if (alive(s.pid)) {
    if (!owns(s)) throw new Error(`refusing to stop unowned pid ${s.pid}`);
    try {
      process.kill(-s.pid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH' || groupAlive(s.pid)) throw error;
    }
  }
  const end = Math.min(
    termination?.cleanupDeadline() ?? Infinity,
    Date.now() + 7000,
  );
  while (groupAlive(s.pid) && Date.now() < end) {
    if (Date.now() > end - 2000 && owns(s)) {
      try {
        process.kill(-s.pid, 'SIGKILL');
      } catch (error) {
        if (error.code !== 'ESRCH' || groupAlive(s.pid)) throw error;
      }
    }
    await new Promise((ok) => setTimeout(ok, 50));
  }
  if (groupAlive(s.pid))
    throw new Error(
      `owned server group ${s.pid} has not stopped or lost its owner; state retained`,
    );
  rmSync(statePathOf(), { force: true });
  console.log(`stopped pid ${s.pid} (artifacts kept)`);
}

// Drives every state in the feature map at every viewport, checks rendering (overflow,
// KaTeX, fonts, contrast), saves screenshots and compares them with the committed
// baselines. Used by `npm run check`. `--update-baselines` rewrites the baselines.

const baselineDir = join(root, '.cursor/skills/verify-probability/baselines');
const maxDiffRatio = Number(process.env.VISUAL_MAX_DIFF ?? 0.002);

function actionTarget(page, action) {
  const target = action.role
    ? page.getByRole(action.role, { name: action.name, exact: true })
    : page.locator(action.selector);
  return action.unique ? target : target.first();
}

async function act(page, action) {
  const target = (a) => actionTarget(page, a);
  if (action.click) await target(action.click).click();
  if (action.hover) await target(action.hover).hover();
  if (action.focus) {
    await target(action.focus).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
  }
  if (action.press) await page.keyboard.press(action.press);
  if (action.type) await target(action.type).fill(action.type.text);
  if (action.select)
    await target({ ...action.select, unique: true }).selectOption(
      action.select.value,
    );
  if (action.range) {
    const input = page.locator(`input[name="${action.range.name}"]`);
    await input.fill(String(action.range.value));
    await input.dispatchEvent('input');
  }
  await page.waitForTimeout(120);
}

async function compare(actualPath, baselinePath, diffPath) {
  const { PNG } = await import('pngjs');
  const pixelmatch = (await import('pixelmatch')).default;
  if (!existsSync(baselinePath))
    return `no baseline at ${baselinePath.replace(`${root}/`, '')} (run smoke --update-baselines and commit it)`;
  const a = PNG.sync.read(readFileSync(actualPath));
  const b = PNG.sync.read(readFileSync(baselinePath));
  if (a.width !== b.width || a.height !== b.height)
    return `size changed from ${b.width}x${b.height} to ${a.width}x${a.height}`;
  const diff = new PNG({ width: a.width, height: a.height });
  const n = pixelmatch(a.data, b.data, diff.data, a.width, a.height, {
    threshold: 0.03, // 0.1 let a whole-bar colour shift (#fff → #f4e2e2) pass
  });
  const ratio = n / (a.width * a.height);
  if (ratio > maxDiffRatio) {
    writeFileSync(diffPath, PNG.sync.write(diff));
    return `${(ratio * 100).toFixed(3)}% of pixels differ (limit ${(maxDiffRatio * 100).toFixed(3)}%); diff image ${diffPath.replace(`${root}/`, '')}`;
  }
  return null;
}

export async function revealPractice(page, lessons) {
  if ((await page.locator('.practice').count()) !== lessons.length)
    throw new Error(
      `expected ${lessons.length} practice problems before revealing answers`,
    );
  const hints = lessons.reduce(
    (sum, lesson) => sum + lesson.practice.hints.length,
    0,
  );
  const show = page.getByRole('button', {
    name: /^Show (answer|a hint|another hint)/,
  });
  for (
    let remaining = hints + lessons.length;
    await show.count();
    remaining--
  ) {
    if (remaining <= 0)
      throw new Error(
        'practice reveals did not converge to the curriculum inventory',
      );
    await show.first().click();
  }
  if (
    (await page.locator('.hint').count()) !== hints ||
    (await page.locator('.answer').count()) !== lessons.length
  )
    throw new Error(
      `practice reveal coverage differs from ${hints} hints and ${lessons.length} answers`,
    );
}

async function sweep(browserApp, url, failures, results, checkpoint) {
  const contentDir = join(root, 'src/content');
  const slug = (text) =>
    text
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const all = readdirSync(contentDir)
    .filter((file) => /^part\d+\.json$/.test(file))
    .flatMap((file) =>
      JSON.parse(readFileSync(join(contentDir, file), 'utf8')),
    );
  const order = JSON.parse(
    readFileSync(join(contentDir, 'order.json'), 'utf8'),
  );
  const ordered = order.map((id) => all.find((lesson) => lesson.id === id));
  const chapters = [...new Set(ordered.map((lesson) => lesson.cluster))];
  const checkpoints = JSON.parse(
    readFileSync(join(contentDir, 'checkpoints.json'), 'utf8'),
  );
  const distributions = JSON.parse(
    readFileSync(join(contentDir, 'distributions.json'), 'utf8'),
  );
  const routes = [
    ...all.map((lesson) => ({
      route: `/lessons/${lesson.id.toLowerCase()}-${slug(lesson.title)}`,
      lessons: [lesson],
    })),
    { route: '/practice', lessons: all },
    { route: '/reference', lessons: [] },
    { route: '/studio', lessons: [] },
    { route: '/', lessons: [] },
  ];
  const widths = {
    mobile: viewports.mobile,
    w600: { width: 600, height: 900 },
    w860: { width: 860, height: 900 },
    desktop: viewports.desktop,
  };
  for (const [vp, viewport] of Object.entries(widths)) {
    checkpoint();
    const page = await browserApp.newPage({
      viewport,
      deviceScaleFactor: 1,
      reducedMotion: 'reduce',
    });
    checkpoint();
    const errors = watchErrors(page);
    try {
      for (const { route, lessons } of routes) {
        checkpoint();
        const label = `sweep ${route}@${vp}`;
        const record = { route, viewport: vp, failures: [], completed: false };
        results.push(record);
        errors.length = 0;
        try {
          await page.goto(url + route, { waitUntil: 'networkidle' });
          if (
            (await page.locator('h1').first().innerText()) === 'Page not found'
          )
            throw new Error('page not found');
          if (route === '/') {
            await page.waitForFunction(
              () =>
                document
                  .querySelector('.account-panel')
                  ?.getAttribute('data-account-state') === 'guest',
            );
            const cards = page.locator('.chapter-grid > .atlas-card');
            if ((await cards.count()) !== chapters.length)
              throw new Error(`expected all ${chapters.length} chapter cards`);
            const catalogue = [];
            for (const [index, chapter] of chapters.entries()) {
              const card = cards.nth(index);
              const heading = await card.locator('h3').evaluate((node) => {
                const text = node.cloneNode(true);
                text.querySelector('.chapter-number').remove();
                return text.textContent.trim();
              });
              const expected = ordered
                .filter((lesson) => lesson.cluster === chapter)
                .map((lesson) => `${lesson.id} · ${lesson.title}`);
              const actual = await card.getByRole('button').allTextContents();
              if (
                heading !== chapter ||
                (await card.locator('.chapter-number').innerText()) !==
                  String(index + 1).padStart(2, '0') ||
                JSON.stringify(actual) !== JSON.stringify(expected)
              )
                throw new Error(`chapter inventory differs for ${chapter}`);
              catalogue.push(...actual.map((text) => text.split(' · ')[0]));
            }
            if (JSON.stringify(catalogue) !== JSON.stringify(order))
              throw new Error('home catalogue differs from the lesson order');
            await page.locator('.course-scope > summary').click();
            if (
              !(await page
                .locator('.course-scope')
                .evaluate((node) => node.open))
            )
              throw new Error('home scope disclosure did not open');
            record.home = { chapters, catalogue, scopeOpen: true };
          }
          if (route === '/practice') {
            if ((await page.locator('.problem-library').count()) !== 1)
              throw new Error('complete problem library is unavailable');
            await page
              .locator('.problem-library')
              .getByRole('button', { name: 'Show all problems', exact: true })
              .click();
            const expected = checkpoints.reduce(
              (sum, set) => sum + set.problems.length,
              0,
            );
            await openDetails(page);
            if (
              (await page.locator('.checkpoint-problem').count()) !== expected
            )
              throw new Error(`expected all ${expected} checkpoint problems`);
            record.checkpoints = expected;
          }
          if (lessons.length) {
            await revealPractice(page, lessons);
            await openDetails(page);
            record.answers = lessons.length;
            record.hints = lessons.reduce(
              (sum, lesson) => sum + lesson.practice.hints.length,
              0,
            );
          }
          if (route === '/reference') {
            if (
              (await page.locator('.reference-list > div').count()) !==
              all.length
            )
              throw new Error('reference is missing lesson results');
            await openDetails(page);
          }
          if (route === '/studio') {
            record.studio = [];
            const inspect = async (state) => {
              record.studio.push(state);
              record.failures.push(
                ...(await renderingProblems(page)).map(
                  (problem) => `${state}: ${problem}`,
                ),
              );
            };
            const button = (name) =>
              page.getByRole('button', { name, exact: true });
            const weight = (index) =>
              page.getByRole('textbox', {
                name: `Weight for outcome ${index}`,
                exact: true,
              });
            await inspect('balanced');
            await page.locator('.studio-descriptions > summary').click();
            await inspect('descriptions');
            await button('Pin this model').click();
            await weight(1).fill('3');
            await button('Condition on B').click();
            await inspect('conditioned-comparison');
            await weight(1).fill('');
            await inspect('invalid-with-pin');
            for (let index = 1; index <= 4; index++)
              await weight(index).fill('0');
            await inspect('zero-total');
            await button('Zero-weight evidence').click();
            await inspect('zero-evidence-with-pin');
            await button('Clear comparison').click();
            await inspect('comparison-cleared');
            await button('Start over').click();
            for (let count = 4; count < 12; count++)
              await button('Add an outcome').click();
            if ((await page.locator('.studio-outcome').count()) !== 12)
              throw new Error('maximum Studio outcomes are unavailable');
            await inspect('twelve-outcomes');
            while ((await page.locator('.studio-outcome').count()) > 1)
              await page
                .getByRole('button', { name: /^Remove outcome / })
                .last()
                .click();
            await inspect('one-outcome');
          }
          record.failures.push(...(await renderingProblems(page)));
          if (route === '/reference') {
            await page
              .getByRole('button', { name: 'Distribution guide', exact: true })
              .click();
            if (
              (await page.locator('.distribution-card').count()) !==
              distributions.length
            )
              throw new Error('distribution guide is incomplete');
            record.distributions = distributions.length;
            record.failures.push(
              ...(await renderingProblems(page)).map(
                (problem) => `distribution guide: ${problem}`,
              ),
            );
          }
          record.completed = true;
        } catch (error) {
          record.failures.push(error.message.split('\n')[0]);
        }
        record.failures.push(
          ...errors.map((error) => `browser error: ${error}`),
        );
        failures.push(
          ...record.failures.map((problem) => `${label}: ${problem}`),
        );
        checkpoint();
      }
    } finally {
      await page.close();
    }
    console.log(
      `sweep: ${routes.length} pages @${viewport.width}px; all hints, answers, checkpoints and reference collections`,
    );
  }
}

async function smoke() {
  const fx = JSON.parse(
    readFileSync(
      join(root, '.cursor/skills/verify-probability/features/smoke.json'),
      'utf8',
    ),
  );
  const selected = selectSmokeStates(
    fx,
    opt('only'),
    Object.keys(viewports),
    opt('feature'),
  );
  const capture = args.includes('--capture');
  const update = args.includes('--update-baselines');
  const selection = {
    state: opt('only') ?? null,
    feature: opt('feature') ?? null,
  };
  const complete = !selection.state && !selection.feature;
  const out = resolve(
    opt(
      'artifacts',
      join(
        root,
        'artifacts/smoke',
        `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`,
      ),
    ),
  );
  if (existsSync(out) && readdirSync(out).length)
    throw new Error(
      `evidence directory is not empty: ${out}; choose a new directory`,
    );
  mkdirSync(out, { recursive: true });
  const failures = [];
  let before = null;
  try {
    before = workspaceIdentity();
  } catch (error) {
    failures.push(`initial identity: ${error.message}`);
  }
  const base = mkdtempSync(join(tmpdir(), 'probability-smoke-'));
  dataDir = base;
  keptLog = join(out, 'server.log');
  const states = [];
  const swept = [];
  let browserApp;
  let pendingLaunch;
  let pendingBrowser;
  let closingBrowser;
  let stoppingServer;
  let terminal;
  let phase = 'running';
  let forceExit = false;
  const cleanup = [];
  const checkpoint = () => {
    termination?.signal.throwIfAborted();
    if (phase !== 'running') throw new Error('verification finalized');
  };
  const closeBrowser = () =>
    (closingBrowser ??= (async () => {
      try {
        await pendingBrowser;
      } catch {
        return;
      }
      await browserApp?.close();
    })());
  const stopServer = () =>
    (stoppingServer ??= (async () => {
      try {
        await pendingLaunch;
      } catch {}
      await stop();
    })());
  const clean = async (resource, operation) => {
    let timer;
    let expire;
    let end = termination.cleanupDeadline();
    const schedule = () => {
      end = Math.min(end, termination.cleanupDeadline());
      clearTimeout(timer);
      timer = setTimeout(
        () => expire(new Error('cleanup timed out')),
        Math.max(1, end - Date.now()),
      );
    };
    try {
      const timeout = new Promise((_, reject) => {
        expire = reject;
        schedule();
      });
      termination.signal.addEventListener('abort', schedule, { once: true });
      await Promise.race([operation, timeout]);
      cleanup.push({
        resource,
        status:
          resource === 'browser' && !browserApp ? 'not-acquired' : 'stopped',
      });
    } catch (error) {
      failures.push(`${resource} cleanup: ${error.message}`);
      cleanup.push({
        resource,
        status: error.message.includes('timed out')
          ? 'timed-out'
          : error.message.includes('refusing')
            ? 'refused'
            : 'failed',
        error: error.message,
      });
      forceExit = true;
    } finally {
      clearTimeout(timer);
      termination.signal.removeEventListener('abort', schedule);
    }
  };
  const finalize = () =>
    (terminal ??= (async () => {
      phase = 'finalizing';
      await Promise.all([
        clean('browser', closeBrowser()),
        clean('server', stopServer()),
      ]);
      try {
        const log = join(base, 'server.log');
        if (existsSync(log)) writeFileSync(keptLog, readFileSync(log));
      } catch (error) {
        failures.push(`log preservation: ${error.message}`);
      }
      try {
        if (!existsSync(statePathOf()))
          rmSync(base, { recursive: true, force: true });
      } catch (error) {
        failures.push(`state cleanup: ${error.message}`);
      }
      try {
        return finishReceipt();
      } catch (error) {
        if (phase === 'settled') throw error;
        failures.push(`receipt construction: ${error.message}`);
        const path = join(out, 'result.json');
        const temporary = `${path}.${randomUUID()}.tmp`;
        try {
          writeFileSync(
            temporary,
            JSON.stringify({
              source: before,
              after: null,
              failures,
              interruption: termination.interruption(),
              cleanup,
              retainedDataDirs: [base],
              success: false,
            }),
            { flag: 'wx' },
          );
          renameSync(temporary, path);
        } catch (failure) {
          console.error(
            `receipt unavailable: ${failure.message}; retained ${base}`,
          );
        }
        phase = 'settled';
        process.exit(termination.interruption()?.exitCode ?? 1);
      }
    })());
  const interrupted = () => {
    void finalize().catch((error) => {
      console.error(`finalization: ${error.message}; retained ${base}`);
      process.exit(termination.interruption().exitCode);
    });
  };
  termination?.signal.addEventListener('abort', interrupted, { once: true });
  try {
    checkpoint();
    if (!before) throw new Error('initial identity unavailable');
    pendingLaunch = launch();
    await pendingLaunch;
    checkpoint();
    const { chromium } = await import('playwright-core');
    const executablePath =
      process.env.CHROME_PATH ??
      [
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
      ].find(existsSync);
    checkpoint();
    pendingBrowser = chromium
      .launch({
        executablePath,
        headless: true,
        timeout: 30_000,
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false,
        args: [
          '--font-render-hinting=none',
          '--disable-lcd-text',
          '--force-color-profile=srgb',
        ],
      })
      .then((acquired) => {
        browserApp = acquired;
        return acquired;
      });
    await pendingBrowser;
    checkpoint();
    const { url } = await doctor();
    for (const step of selected) {
      checkpoint();
      for (const vp of step.viewports ?? Object.keys(viewports)) {
        checkpoint();
        const label = `${step.feature}/${step.id}@${vp}`;
        const shot = join(out, step.feature, `${step.id}.${vp}.png`);
        const record = {
          state: `${step.feature}/${step.id}`,
          viewport: vp,
          screenshot: shot,
          captureSelector: step.captureSelector ?? null,
          failures: [],
          completed: false,
        };
        states.push(record);
        const page = await browserApp.newPage({
          viewport: viewports[vp],
          deviceScaleFactor: 1,
          reducedMotion: 'reduce',
        });
        checkpoint();
        const errors = watchErrors(page);
        try {
          await page.goto(url + step.url, { waitUntil: 'networkidle' });
          for (const action of step.actions ?? []) await act(page, action);
          record.path = new URL(page.url()).pathname;
          record.heading = await page.locator('h1').first().innerText();
          const text = await page.locator('body').innerText();
          for (const want of step.expect ?? [])
            if (!text.includes(want))
              record.failures.push(`expected “${want}” on ${record.path}`);
          for (const selector of step.expectHidden ?? [])
            if (
              (await page.locator(selector).count()) !== 1 ||
              (await page.locator(selector).isVisible())
            )
              record.failures.push(
                `expected ${selector} to exist and be hidden`,
              );
          if (step.expectPath && record.path !== step.expectPath)
            record.failures.push(
              `expected ${step.expectPath}, got ${record.path}`,
            );
          record.failures.push(...(await renderingProblems(page)));
          await capturePage(page, shot, step.captureSelector, async () => {
            const action = step.actions?.at(-1);
            if (action?.hover) {
              const target = actionTarget(page, action.hover);
              await page.mouse.move(0, 0);
              const resting = await target.evaluate(
                (node) => getComputedStyle(node).backgroundColor,
              );
              await target.hover();
              const observed = await target.evaluate((node) => ({
                hovered: node.matches(':hover'),
                backgroundColor: getComputedStyle(node).backgroundColor,
              }));
              if (!observed.hovered || observed.backgroundColor === resting)
                throw new Error('requested hover state is not visibly active');
              record.interaction = { kind: 'hover', resting, ...observed };
            } else if (action?.focus) {
              const observed = await actionTarget(page, action.focus).evaluate(
                (node) => ({
                  focused: document.activeElement === node,
                  visible: node.matches(':focus-visible'),
                  outline: getComputedStyle(node).outlineStyle,
                  width: parseFloat(getComputedStyle(node).outlineWidth),
                }),
              );
              if (
                !observed.focused ||
                !observed.visible ||
                observed.outline === 'none' ||
                observed.width <= 0
              )
                throw new Error(
                  'requested keyboard focus is not visibly active',
                );
              record.interaction = { kind: 'focus', ...observed };
            }
          });
          const baseline = join(
            baselineDir,
            step.feature,
            `${step.id}.${vp}.png`,
          );
          if (update) {
            mkdirSync(dirname(baseline), { recursive: true });
            writeFileSync(baseline, readFileSync(shot));
          } else if (!capture) {
            const problem = await compare(
              shot,
              baseline,
              shot.replace(/\.png$/, '.diff.png'),
            );
            if (problem) record.failures.push(`visual change — ${problem}`);
          }
          checkpoint();
          record.completed = true;
        } catch (error) {
          record.failures.push(error.message.split('\n')[0]);
          if (!termination?.signal.aborted && !existsSync(shot)) {
            try {
              await capturePage(page, shot);
            } catch {}
          }
        } finally {
          record.failures.push(
            ...errors.map((error) => `browser error: ${error}`),
          );
          failures.push(
            ...record.failures.map((problem) => `${label}: ${problem}`),
          );
          console.log(
            `${record.failures.length ? 'FAIL' : 'PASS'} ${label} → ${record.path ?? step.url}`,
          );
          await page.close();
        }
        checkpoint();
      }
    }
    if (complete) await sweep(browserApp, url, failures, swept, checkpoint);
  } catch (error) {
    failures.push(error.message);
  } finally {
    await finalize();
  }
  function finishReceipt() {
    let after = null;
    try {
      after = workspaceIdentity();
    } catch (error) {
      failures.push(`final identity: ${error.message}`);
    }
    const comparable = (identity) =>
      JSON.stringify(
        identity.files.filter(
          (file) =>
            !update ||
            !file.path.startsWith(
              '.cursor/skills/verify-probability/baselines/',
            ),
        ),
      );
    const sourceUnchanged = Boolean(
      before && after && comparable(before) === comparable(after),
    );
    const expectedStates = selected.reduce(
      (sum, step) => sum + (step.viewports ?? Object.keys(viewports)).length,
      0,
    );
    const expectedPages = complete
      ? (JSON.parse(readFileSync(join(root, 'src/content/order.json'), 'utf8'))
          .length +
          4) *
        4
      : 0;
    const coverageComplete =
      states.length === expectedStates &&
      states.every((record) => record.completed) &&
      swept.length === expectedPages &&
      swept.every((record) => record.completed);
    if (!coverageComplete)
      failures.push(
        `incomplete coverage: ${states.length}/${expectedStates} states and ${swept.length}/${expectedPages} page-width checks`,
      );
    if (!sourceUnchanged || before?.buildDigest !== after?.buildDigest)
      failures.push('source or built output changed during verification');
    const result = {
      at: new Date().toISOString(),
      kind: update
        ? 'baseline-generation'
        : capture
          ? 'development-capture'
          : complete
            ? 'release-smoke'
            : 'selected-smoke',
      full: complete && !capture && !update && coverageComplete,
      coverage: {
        expectedStates,
        states: states.length,
        expectedPages,
        pages: swept.length,
        complete: coverageComplete,
      },
      sourceUnchanged,
      comparison: update
        ? 'baselines-written-require-inspection'
        : capture
          ? 'skipped-development-only'
          : 'pixelmatch',
      selection,
      source: before,
      after,
      states,
      sweep: swept,
      failures,
      interruption: termination?.interruption() ?? null,
      cleanup,
      retainedDataDirs: existsSync(statePathOf()) ? [base] : [],
      success: failures.length === 0 && !termination?.signal.aborted,
    };
    if (result.interruption)
      failures.push(`interrupted by ${result.interruption.signal}`);
    const receiptPath = join(out, 'result.json');
    const temporary = `${receiptPath}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, JSON.stringify(result, null, 2), { flag: 'wx' });
      renameSync(temporary, receiptPath);
    } catch (error) {
      failures.push(`receipt: ${error.message}`);
      try {
        writeFileSync(
          temporary,
          JSON.stringify({
            source: before,
            after: null,
            failures,
            success: false,
            interruption: result.interruption,
            cleanup,
          }),
          { flag: 'w' },
        );
        renameSync(temporary, receiptPath);
      } catch (failure) {
        console.error(
          `receipt unavailable: ${failure.message}; retained ${base}`,
        );
      }
      forceExit = true;
    }
    phase = 'settled';
    termination?.signal.removeEventListener('abort', interrupted);
    console.error(`evidence in ${out}`);
    if (result.interruption || forceExit)
      process.exit(result.interruption?.exitCode ?? 1);
    if (failures.length) {
      console.error(failures.map((failure) => `smoke: ${failure}`).join('\n'));
      throw new Error(`${failures.length} failure(s); evidence in ${out}`);
    }
    console.log(
      `smoke ok — ${states.length} states; ${result.kind}; comparison=${result.comparison}; evidence in ${out}`,
    );
    return result;
  }
}

const run = {
  launch,
  doctor,
  stop,
  smoke,
  open: () =>
    browser(async (p) =>
      console.log(`${new URL(p.url()).pathname} “${await heading(p)}”`),
    ),
  click: () =>
    browser(async (p) => {
      await p
        .getByRole(opt('role', 'button'), { name: opt('name'), exact: true })
        .first()
        .click();
      await p.waitForTimeout(150);
      console.log(`${new URL(p.url()).pathname} “${await heading(p)}”`);
    }),
  'set-range': () =>
    browser(async (p) => {
      const input = p.locator(`input[name="${opt('name')}"]`);
      await input.fill(String(opt('value')));
      await input.dispatchEvent('input');
      console.log(await p.getByTestId('lab-result').innerText());
    }),
  snapshot: () =>
    browser(async (p) =>
      save(
        opt('path', 'artifacts/snapshot.aria.txt'),
        await p.locator('main').ariaSnapshot(),
      ),
    ),
  screenshot: () =>
    browser(async (p) =>
      p
        .screenshot({ path: opt('path', 'artifacts/screenshot.png') })
        .then(() =>
          console.log(`saved ${opt('path', 'artifacts/screenshot.png')}`),
        ),
    ),
  help: () =>
    console.log(`control-probability <command> [--data-dir DIR] [--port N]
  launch [--mode preview|dev] [--migrate]   start owned site; optional generated local D1 migrations
  doctor                               read-only health check of the instance this data dir started
  open --url PATH                      load a route, print path and heading
  click --url PATH --role R --name N   click an accessible element, print the resulting route
  set-range --url PATH --name N --value V   move a lab slider, print the lab result
  snapshot --url PATH --path FILE      save the ARIA snapshot of <main>
  screenshot --url PATH --path FILE    save a PNG
  stop                                 exact nonce/argv group only; refuse foreign state; artifacts stay
  smoke [--only F/ID | --feature ID] [--capture] [--artifacts NEW_DIR]
                                       exact selection; capture skips comparison and is development evidence
  smoke [--update-baselines]            full release comparison by default; baseline generation requires inspection
  automated SIGINT/SIGTERM              join owned cleanup, retain failed receipt, exit 130/143; first signal wins`),
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await Promise.resolve()
    .then(() => {
      validateArgs();
      if (!run[cmd]) throw new Error(`unknown command ${cmd}`);
      return run[cmd]();
    })
    .catch((error) => {
      console.error(`${cmd}: ${error.message}`);
      process.exitCode = termination?.interruption()?.exitCode ?? 1;
    })
    .finally(() => {
      const interruption = termination?.interruption();
      if (interruption) process.exitCode = interruption.exitCode;
      termination?.dispose();
    });
}
