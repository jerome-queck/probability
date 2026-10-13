#!/usr/bin/env node
// Driver CLI for the probability site. Launches the app from its own data dir, checks
// it, drives it in headless Chrome and saves evidence. See
// .cursor/skills/verify-probability/SKILL.md for the workflow.
import { spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
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
  const logFd = openSync(log, 'a');
  const child = spawn(process.execPath, viteArgs, {
    cwd: root,
    detached: true,
    stdio: ['ignore', logFd, logFd],
  });
  closeSync(logFd);
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
  // Do not leave an orphan holding the port, or a state file that blocks the next launch.
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {}
  rmSync(statePathOf(), { force: true });
  throw new Error(`server did not answer on ${url}; see ${log}`);
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
  try {
    if (alive(s.pid)) process.kill(-s.pid, 'SIGTERM');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
  rmSync(statePathOf());
  console.log(`stopped pid ${s.pid} (artifacts kept)`);
}

// Drives every state in the feature map at every viewport, checks rendering (overflow,
// KaTeX, fonts, contrast), saves screenshots and compares them with the committed
// baselines. Used by `npm run check`. `--update-baselines` rewrites the baselines.
export const viewports = {
  desktop: { width: 1280, height: 800 },
  mobile: { width: 390, height: 844 },
};
const baselineDir = join(root, '.cursor/skills/verify-probability/baselines');
const maxDiffRatio = Number(process.env.VISUAL_MAX_DIFF ?? 0.002);

async function renderingProblems(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const problems = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1)
      problems.push(
        `horizontal overflow: page is ${document.documentElement.scrollWidth}px wide in a ${window.innerWidth}px viewport`,
      );
    // A display formula wider than its box is clipped on screen even when the page
    // itself does not scroll sideways, so check each one.
    for (const el of document.querySelectorAll('.katex-display, .math-block')) {
      if (el.getClientRects().length && el.scrollWidth > el.clientWidth + 1)
        problems.push(
          `clipped display math: ${el.scrollWidth}px formula in a ${el.clientWidth}px box (“${el.textContent.slice(0, 40)}”)`,
        );
    }
    if (document.querySelector('.math-error'))
      problems.push('KaTeX reported invalid mathematics');
    const families = new Set();
    for (const el of document.querySelectorAll('body *')) {
      if (!el.childNodes.length || el.closest('.katex')) continue;
      const own = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim(),
      );
      if (!own || !el.getClientRects().length) continue;
      const cs = getComputedStyle(el);
      families.add(
        `${cs.fontStyle}|${cs.fontWeight}|${cs.fontFamily.split(',')[0].trim().replace(/"/g, '')}`,
      );
    }
    for (const key of families) {
      const [style, weight, family] = key.split('|');
      if (
        ['Inter', 'Source Serif 4'].includes(family) &&
        !document.fonts.check(`${style} ${weight} 16px "${family}"`)
      )
        problems.push(`font not loaded: ${family} ${weight} ${style}`);
      else if (
        !['Inter', 'Source Serif 4'].includes(family) &&
        family !== 'inherit'
      )
        problems.push(`text uses an unbundled font: ${family}`);
    }
    const used = [...document.fonts]
      .filter((f) => f.status === 'loaded')
      .map((f) => f.family.replace(/"/g, ''));
    if (
      document.querySelector('.katex') &&
      !used.some((f) => f.startsWith('KaTeX'))
    )
      problems.push('KaTeX fonts did not load');
    const rgb = (c) => (c.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r, g, b]) => {
      const f = (raw) => {
        const v = raw / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const background = (el) => {
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.backgroundImage !== 'none') return null;
        const c = rgb(cs.backgroundColor);
        if (c.length === 3 || (c.length === 4 && c[3] > 0.9))
          return c.slice(0, 3);
      }
      return [255, 255, 255];
    };
    const seen = new Set();
    for (const el of document.querySelectorAll('main *, aside *')) {
      if (el.closest('.katex-mathml, svg, [aria-hidden="true"]')) continue;
      const own = [...el.childNodes].some(
        (n) => n.nodeType === 3 && n.textContent.trim(),
      );
      if (!own) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (
        r.width === 0 ||
        cs.visibility === 'hidden' ||
        Number(cs.opacity) < 0.5
      )
        continue;
      const bg = background(el);
      if (!bg) continue;
      const fg = rgb(cs.color);
      if (fg.length === 4 && fg[3] < 0.9) continue;
      const [a, b] = [lum(fg.slice(0, 3)), lum(bg)].sort((x, y) => y - x);
      const ratio = (a + 0.05) / (b + 0.05);
      const size = parseFloat(cs.fontSize);
      const large =
        size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
      if (ratio < (large ? 3 : 4.5)) {
        const key = `${cs.color}/${bg}/${el.textContent.trim().slice(0, 30)}`;
        if (!seen.has(key)) {
          seen.add(key);
          problems.push(
            `low contrast ${ratio.toFixed(2)}:1 for “${el.textContent.trim().slice(0, 40)}”`,
          );
        }
      }
    }
    return problems;
  });
}

async function act(page, action) {
  const target = (a) =>
    a.role
      ? page.getByRole(a.role, { name: a.name, exact: true }).first()
      : page.locator(a.selector).first();
  if (action.click) await target(action.click).click();
  if (action.hover) await target(action.hover).hover();
  if (action.focus) {
    await target(action.focus).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
  }
  if (action.press) await page.keyboard.press(action.press);
  if (action.type) await target(action.type).fill(action.type.text);
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

async function smoke() {
  const base = mkdtempSync(join(tmpdir(), 'probability-smoke-'));
  dataDir = base;
  const update = args.includes('--update-baselines');
  const only = opt('only');
  const out = resolve(opt('artifacts', join(root, 'artifacts/smoke')));
  const fx = JSON.parse(
    readFileSync(
      join(root, '.cursor/skills/verify-probability/features/smoke.json'),
      'utf8',
    ),
  );
  const failures = [];
  let shots = 0;
  let browserApp;
  try {
    await launch();
    const { chromium } = await import('playwright-core');
    const executablePath =
      process.env.CHROME_PATH ??
      [
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
      ].find(existsSync);
    browserApp = await chromium.launch({
      executablePath,
      headless: true,
      args: [
        '--font-render-hinting=none',
        '--disable-lcd-text',
        '--force-color-profile=srgb',
      ],
    });
    await doctor();
    if (process.exitCode) throw new Error('doctor failed');
    const { url } = readState();
    for (const step of fx) {
      if (only && !`${step.feature}/${step.id}`.includes(only)) continue;
      for (const vp of step.viewports ?? Object.keys(viewports)) {
        const page = await browserApp.newPage({
          viewport: viewports[vp],
          deviceScaleFactor: 1,
          reducedMotion: 'reduce',
        });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on(
          'console',
          (m) => m.type() === 'error' && errors.push(m.text()),
        );
        const label = `${step.feature}/${step.id}@${vp}`;
        try {
          await page.goto(url + step.url, { waitUntil: 'networkidle' });
          await page.addStyleTag({
            content:
              '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}html{scroll-behavior:auto!important}',
          });
          for (const action of step.actions ?? []) await act(page, action);
          const h1 = await page.locator('h1').first().innerText();
          const text = await page.locator('body').innerText();
          const path = new URL(page.url()).pathname;
          for (const want of step.expect ?? [])
            if (!text.includes(want))
              failures.push(`${label}: expected “${want}” on ${path}`);
          for (const sel of step.expectHidden ?? [])
            if (
              (await page.locator(sel).count()) === 0 ||
              (await page.locator(sel).isVisible())
            )
              failures.push(`${label}: expected ${sel} to exist and be hidden`);
          if (step.expectPath && path !== step.expectPath)
            failures.push(
              `${label}: expected path ${step.expectPath}, got ${path}`,
            );
          for (const p of await renderingProblems(page))
            failures.push(`${label}: ${p}`);
          if (errors.length)
            failures.push(`${label}: browser errors: ${errors.join(' | ')}`);
          const shot = join(out, step.feature, `${step.id}.${vp}.png`);
          mkdirSync(dirname(shot), { recursive: true });
          await page.evaluate(() =>
            window.scrollTo({ top: 0, behavior: 'instant' }),
          );
          await page.waitForTimeout(50);
          await page.screenshot({ path: shot, fullPage: true });
          writeFileSync(
            shot.replace(/\.png$/, '.aria.txt'),
            await page.locator('body').ariaSnapshot(),
          );
          shots += 1;
          const baseline = join(
            baselineDir,
            step.feature,
            `${step.id}.${vp}.png`,
          );
          if (update) {
            mkdirSync(dirname(baseline), { recursive: true });
            writeFileSync(baseline, readFileSync(shot));
          } else {
            const problem = await compare(
              shot,
              baseline,
              shot.replace(/\.png$/, '.diff.png'),
            );
            if (problem) failures.push(`${label}: visual change — ${problem}`);
          }
          console.log(
            `${failures.some((f) => f.startsWith(label)) ? 'FAIL' : 'PASS'} ${label} → ${path} “${h1.replace(/\n/g, ' ')}”`,
          );
        } catch (e) {
          failures.push(`${label}: ${e.message.split('\n')[0]}`);
          console.log(`FAIL ${label}`);
        } finally {
          await page.close();
        }
      }
    }
  } finally {
    try {
      await browserApp?.close();
    } catch {}
    try {
      await stop();
    } catch {}
    // Keep the preview server log with the screenshots before the temp dir goes.
    const log = join(base, 'server.log');
    if (existsSync(log)) {
      mkdirSync(out, { recursive: true });
      writeFileSync(join(out, 'server.log'), readFileSync(log));
    }
    rmSync(base, { recursive: true, force: true });
  }
  if (failures.length) {
    console.error(failures.map((f) => `smoke: ${f}`).join('\n'));
    throw new Error(
      `${failures.length} failure(s); screenshots and diffs in ${out}`,
    );
  }
  console.log(
    `smoke ok — ${shots} screenshots ${update ? 'written as baselines' : 'match their baselines'}, evidence in ${out}`,
  );
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
  smoke [--only F/ID] [--update-baselines]   every visual state at desktop and mobile: drive, check rendering, screenshot, compare with baselines`),
};

if (!run[cmd]) {
  console.error(`unknown command ${cmd}`);
  process.exit(2);
}
await Promise.resolve()
  .then(() => run[cmd]())
  .catch((e) => {
    console.error(`${cmd}: ${e.message}`);
    process.exitCode = 1;
  });
