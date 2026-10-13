#!/usr/bin/env node
// Driver CLI for the probability site. Launches the app from its own data dir, checks
// it, drives it in headless Chrome and saves evidence. See
// .cursor/skills/verify-probability/SKILL.md for the workflow.
import { spawn } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

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
const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const cmd = args[0] ?? 'help';
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
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

function freePort() {
  return new Promise((ok) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => ok(port));
    });
  });
}

async function launch() {
  mkdirSync(dataDir, { recursive: true });
  const existing = readState();
  if (existing && alive(existing.pid))
    throw new Error(
      `already running (pid ${existing.pid}) for ${dataDir}; stop it first`,
    );
  const port = Number(opt('port', 0)) || (await freePort());
  const mode = opt('mode', 'preview');
  if (mode === 'preview' && !existsSync(join(root, 'dist/index.html')))
    throw new Error(
      'dist/ is missing; run npm run build first, or use --mode dev',
    );
  const vite = join(root, 'node_modules/vite/bin/vite.js');
  const viteArgs =
    mode === 'dev'
      ? [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort']
      : [
          vite,
          'preview',
          '--host',
          '127.0.0.1',
          '--port',
          String(port),
          '--strictPort',
        ];
  const log = join(dataDir, 'server.log');
  const child = spawn(process.execPath, viteArgs, {
    cwd: root,
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  child.unref();
  const url = `http://127.0.0.1:${port}`;
  writeFileSync(
    statePathOf(),
    JSON.stringify(
      {
        pid: child.pid,
        port,
        url,
        mode,
        log,
        startedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        console.log(
          `READY ${url} pid=${child.pid} mode=${mode} data-dir=${dataDir}`,
        );
        return;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server did not answer on ${url}`);
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function doctor() {
  const s = readState();
  const problems = [];
  if (!s) problems.push(`no launch recorded in ${dataDir}`);
  else {
    if (!alive(s.pid)) problems.push(`recorded pid ${s.pid} is not running`);
    try {
      const html = await (await fetch(s.url)).text();
      if (!html.includes('<div id="root">'))
        problems.push('page has no app root');
      if (!/Probability/.test(html))
        problems.push('page title is not the probability site');
      const deep = await fetch(`${s.url}/lessons/f01-sample-spaces-and-events`);
      if (!deep.ok) problems.push(`deep lesson link returned ${deep.status}`);
    } catch (e) {
      problems.push(`cannot reach ${s.url}: ${e.message}`);
    }
  }
  if (problems.length) {
    console.error(`doctor: FAIL\n- ${problems.join('\n- ')}`);
    process.exitCode = 1;
  } else console.log(`doctor: OK ${s.url} pid=${s.pid} mode=${s.mode}`);
}

async function browser(fn) {
  const s = readState();
  if (!s) throw new Error('launch first');
  const { chromium } = await import('playwright-core');
  const executablePath =
    process.env.CHROME_PATH ??
    [
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

async function stop() {
  const s = readState();
  if (!s) return console.log('nothing to stop');
  if (alive(s.pid)) process.kill(-s.pid, 'SIGTERM');
  rmSync(statePathOf());
  console.log(`stopped pid ${s.pid} (artifacts kept)`);
}

// Drives every feature in the map once and saves evidence. Used by `npm run check`.
async function smoke() {
  const base = mkdtempSync(join(tmpdir(), 'probability-smoke-'));
  dataDir = base;
  const out = resolve(opt('artifacts', join(root, 'artifacts/smoke')));
  const fx = JSON.parse(
    readFileSync(
      join(root, '.cursor/skills/verify-probability/features/smoke.json'),
      'utf8',
    ),
  );
  await launch();
  try {
    await doctor();
    if (process.exitCode) throw new Error('doctor failed');
    for (const step of fx) {
      args.splice(0, args.length, 'smoke', '--url', step.url);
      const result = await browser(async (page) => {
        if (step.click)
          await page
            .getByRole(step.click.role, { name: step.click.name, exact: true })
            .first()
            .click();
        if (step.range) {
          const input = page.locator(`input[name="${step.range.name}"]`);
          await input.fill(String(step.range.value));
          await input.dispatchEvent('input');
        }
        await page.waitForTimeout(150);
        const h1 = await heading(page);
        const text = await page.locator('main').innerText();
        const aria = await page.locator('main').ariaSnapshot();
        save(join(out, step.feature, `${step.id}.aria.txt`), aria);
        await page.screenshot({
          path: join(out, step.feature, `${step.id}.png`),
        });
        return { h1, text, path: new URL(page.url()).pathname };
      });
      if (result.text.includes('Invalid mathematics'))
        throw new Error(
          `${step.feature}/${step.id}: KaTeX failed to render on ${result.path}`,
        );
      for (const want of step.expect ?? [])
        if (!result.text.includes(want) && !result.h1.includes(want))
          throw new Error(
            `${step.feature}/${step.id}: expected “${want}” on page ${result.path}`,
          );
      if (step.expectPath && result.path !== step.expectPath)
        throw new Error(
          `${step.feature}/${step.id}: expected path ${step.expectPath}, got ${result.path}`,
        );
      console.log(
        `PASS ${step.feature}/${step.id} → ${result.path} “${result.h1}”`,
      );
    }
  } finally {
    await stop();
    rmSync(base, { recursive: true, force: true });
  }
  console.log(`smoke ok — ${fx.length} drives, evidence in ${out}`);
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
  launch [--mode preview|dev]          start the site; prints READY <url>
  doctor                               read-only health check of the instance this data dir started
  open --url PATH                      load a route, print path and heading
  click --url PATH --role R --name N   click an accessible element, print the resulting route
  set-range --url PATH --name N --value V   move a lab slider, print the lab result
  snapshot --url PATH --path FILE      save the ARIA snapshot of <main>
  screenshot --url PATH --path FILE    save a PNG
  stop                                 stop only the instance this data dir started; artifacts stay
  smoke                                launch → doctor → drive every feature in features/smoke.json → stop`),
};

if (!run[cmd]) {
  console.error(`unknown command ${cmd}`);
  process.exit(2);
}
await run[cmd]().catch((e) => {
  console.error(`${cmd}: ${e.message}`);
  process.exitCode = 1;
});
