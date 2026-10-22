#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  capturePage,
  openDetails,
  renderingProblems,
  viewports,
  watchErrors,
} from './browser-probability.mjs';
import { workspaceIdentity } from './probability.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const argv = process.argv.slice(2);
const options = {};
const journeys = { study, navigation, labs, accounts };
for (let i = 0; i < argv.length; i += 2) {
  const name = argv[i]?.slice(2);
  const value = argv[i + 1];
  if (
    !['artifacts', 'only', 'viewport'].includes(name) ||
    !argv[i].startsWith('--') ||
    Object.hasOwn(options, name) ||
    !value ||
    value.startsWith('--')
  )
    throw new Error(
      'Use verify-journeys.mjs [--only study|navigation|labs|accounts] [--viewport desktop|mobile] [--artifacts NEW_DIR].',
    );
  options[name] = value;
}
if (options.only && !Object.hasOwn(journeys, options.only))
  throw new Error(`Unknown journey ${options.only}.`);
if (options.viewport && !Object.hasOwn(viewports, options.viewport))
  throw new Error(`Unknown viewport ${options.viewport}.`);
const selectedJourneys = Object.entries(journeys).filter(
  ([id]) => !options.only || options.only === id,
);
const selectedViewports = Object.entries(viewports).filter(
  ([id]) => !options.viewport || options.viewport === id,
);
const expectedGroups = selectedJourneys.length * selectedViewports.length;
const complete = !options.only && !options.viewport;
const out = resolve(
  options.artifacts ??
    join(
      root,
      'artifacts/journeys',
      `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`,
    ),
);
if (existsSync(out) && readdirSync(out).length)
  throw new Error(`evidence directory is not empty: ${out}`);
mkdirSync(out, { recursive: true });
const source = workspaceIdentity();
const results = [];
const failures = [];
let reflow320 = false;
const lesson = (id) => `/lessons/${id.toLowerCase()}`;
const button = (page, name) => page.getByRole('button', { name, exact: true });
const pressed = async (locator, value) =>
  assert.equal(await locator.getAttribute('aria-pressed'), String(value));
const account = (page) => page.locator('.account-panel');
const saved = (page) =>
  page.waitForFunction(
    () =>
      document
        .querySelector('.account-panel')
        ?.getAttribute('data-account-state') === 'saved',
  );
const guest = (page) =>
  page.waitForFunction(
    () =>
      document
        .querySelector('.account-panel')
        ?.getAttribute('data-account-state') === 'guest',
  );
const panel = async (page) => {
  if (!(await page.locator('.account-menu').evaluate((node) => node.open)))
    await page.locator('.account-menu > summary').click();
};
const goto = (page, url, path) =>
  page.goto(url + path, { waitUntil: 'networkidle' });
const reveal = (page) => button(page, 'Show answer').click();
const rate = (page, name) => button(page, name).click();

async function driver(command, dataDir, extra = []) {
  const output = await new Promise((resolveOutput, reject) => {
    const child = spawn(
      process.execPath,
      [
        join(root, 'scripts/control-probability.mjs'),
        command,
        '--data-dir',
        dataDir,
        ...extra,
      ],
      { cwd: root, env: process.env },
    );
    let text = '';
    child.stdout.on('data', (chunk) => {
      text += chunk;
    });
    child.stderr.on('data', (chunk) => {
      text += chunk;
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0
        ? resolveOutput(text)
        : reject(new Error(`${command} failed: ${text}`)),
    );
  });
  return output;
}

async function study(page, url, record, capture) {
  await goto(page, url, lesson('F01'));
  await guest(page);
  await button(page, 'Mark this lesson as studied').click();
  await reveal(page);
  await page
    .getByRole('textbox', { name: 'Your reasoning' })
    .fill('Name the sample space, then check the event.');
  await rate(page, '↺ Review again');
  await page.reload({ waitUntil: 'networkidle' });
  await pressed(button(page, '✓ Studied'), true);
  await reveal(page);
  await pressed(button(page, '↺ Review again'), true);
  assert.equal(
    await page.getByRole('textbox', { name: 'Your reasoning' }).inputValue(),
    '',
  );
  await capture(page, 'guest-reloaded', '.practice');
  await button(page, 'Learn').click();
  assert.match(await page.locator('.study-dashboard').innerText(), /1 of 48/);
  assert.equal(await button(page, 'Continue with F02').count(), 1);
  await button(page, 'Practice').click();
  await page
    .getByRole('checkbox', { name: 'Only problems I marked for review' })
    .check();
  assert.equal(await page.locator('.practice').count(), 1);
  assert.match(await page.locator('.practice h2').innerText(), /^F01/);
  await page
    .getByRole('combobox', { name: 'Chapter', exact: true })
    .selectOption('Foundations');
  await button(page, 'Show a hint').click();
  await reveal(page);
  await pressed(button(page, '↺ Review again'), true);
  await capture(page, 'practice-filter-answer', '.practice-list');
  await page.locator('.checkpoint-set > summary').first().click();
  const checkpoint = page.locator('.checkpoint-problem').first();
  await checkpoint.getByText('Hints', { exact: true }).click();
  await checkpoint.getByText('Solution', { exact: true }).click();
  assert.ok((await checkpoint.innerText()).includes('Revisit'));
  assert.ok((await checkpoint.locator('details[open]').count()) === 2);
  await capture(page, 'checkpoint-solution', '.checkpoint-set:first-of-type');
  await button(page, 'Reference').click();
  const referenceSearch = page.getByRole('searchbox', {
    name: 'Find in reference',
  });
  await referenceSearch.fill('Boole');
  assert.equal(await page.locator('.reference-list > div').count(), 2);
  assert.equal(
    await button(page, 'F02 · The axioms of probability').count(),
    1,
  );
  await referenceSearch.fill('axioms Boole');
  assert.equal(await page.locator('.reference-list > div').count(), 1);
  assert.equal(
    await button(page, 'F02 · The axioms of probability').count(),
    1,
  );
  await referenceSearch.fill('F02');
  assert.equal(await page.locator('.reference-list > div').count(), 1);
  await page.locator('.reference-list summary').click();
  assert.ok(
    await page.locator('.reference-list details').evaluate((node) => node.open),
  );
  await capture(page, 'reference-conditions', '.reference-list');
  await button(page, 'F02 · The axioms of probability').click();
  assert.match(new URL(page.url()).pathname, /^\/lessons\/f02/);
  await button(page, 'Reference').click();
  await button(page, 'Distribution guide').click();
  await referenceSearch.fill('D05 Poisson');
  assert.equal(await page.locator('.distribution-card').count(), 0);
  await referenceSearch.fill('Poisson');
  const card = page.locator('.distribution-card').filter({
    has: page.getByRole('heading', { name: 'Poisson', exact: true }),
  });
  assert.equal(await card.count(), 1);
  for (const label of ['Support', 'Mass or density', 'Mean', 'Variance'])
    assert.ok((await card.innerText()).includes(label));
  await capture(
    page,
    'distribution-lookup',
    '.distribution-card:has(h2:text-is("Poisson"))',
  );
  await card.getByRole('button').click();
  assert.match(new URL(page.url()).pathname, /^\/lessons\/d05/);
  record.proved = [
    'guest studied and rating survive reload',
    'scratch work clears on reload',
    'home resume',
    'chapter and review filters',
    'checkpoint hints and solution',
    'result conditions and distribution lookup',
  ];
}

async function navigation(page, url, record, capture) {
  await goto(page, url, '/');
  const mobile = page.viewportSize().width <= 860;
  if (mobile) {
    await button(page, 'Open lessons').focus();
    await page.keyboard.press('Enter');
    assert.equal(
      await page
        .locator('#lesson-search')
        .evaluate((node) => node === document.activeElement),
      true,
    );
    assert.notEqual(await page.locator('main').getAttribute('inert'), null);
    await page.keyboard.press('Escape');
    assert.equal(
      await button(page, 'Open lessons').evaluate(
        (node) => node === document.activeElement,
      ),
      true,
    );
    await button(page, 'Open lessons').click();
  }
  const search = page.getByRole('searchbox', { name: 'Find a concept' });
  const foundations = page
    .locator('.chapter-heading button')
    .filter({ hasText: 'Foundations' });
  if ((await foundations.getAttribute('aria-expanded')) === 'true')
    await foundations.click();
  await search.fill('Boole');
  assert.equal(await page.locator('.nav-link').count(), 2);
  assert.equal(
    await page
      .locator('.nav-link[href^="/lessons/f02"] .nav-match')
      .innerText(),
    'Words in Practice',
  );
  assert.equal(
    await page
      .locator('.nav-link[href^="/lessons/j02"] .nav-match')
      .innerText(),
    'Words in Definition',
  );
  await capture(page, 'search-content-witnesses', '#lesson-sidebar');
  await foundations.click();
  assert.equal(await foundations.getAttribute('aria-expanded'), 'false');
  await search.fill('axioms Boole');
  assert.equal(await page.locator('.nav-link').count(), 1);
  await page
    .locator('.nav-link[href^="/lessons/f02"]')
    .waitFor({ state: 'visible' });
  assert.equal(await foundations.getAttribute('aria-expanded'), 'true');
  assert.equal(
    await page.locator('.nav-match').innerText(),
    'Words in Practice',
  );
  await search.fill('The axioms of probability');
  assert.equal(
    await page.locator('.nav-link[href^="/lessons/f02"]').count(),
    1,
  );
  assert.equal(
    await page.locator('.nav-link[href^="/lessons/f02"] .nav-match').count(),
    0,
  );
  await search.fill('no-such-concept');
  assert.equal(await page.locator('.nav-link').count(), 0);
  await button(page, 'Clear search').click();
  assert.equal(await page.locator('.nav-match').count(), 0);
  assert.equal(await foundations.getAttribute('aria-expanded'), 'false');
  await search.fill('F02');
  assert.equal(await page.locator('.nav-link').count(), 1);
  assert.equal(await page.locator('.nav-match').count(), 0);
  const link = page.getByRole('link', { name: /F02/ });
  assert.match(await link.getAttribute('href'), /^\/lessons\/f02/);
  await link.focus();
  await page.keyboard.press('Enter');
  assert.match(new URL(page.url()).pathname, /^\/lessons\/f02/);
  assert.equal(
    await page
      .locator('h1')
      .evaluate((node) => node === document.activeElement),
    true,
  );
  await button(page, 'Mark this lesson as studied').click();
  if (mobile) await button(page, 'Open lessons').click();
  await search.fill('Boole 60%');
  assert.equal(await page.locator('.nav-link').count(), 1);
  assert.equal(
    await page.locator('.nav-match').innerText(),
    'Words in Worked example · Practice',
  );
  assert.equal(await link.getAttribute('aria-current'), 'page');
  assert.ok((await link.getAttribute('class')).includes('active'));
  assert.equal(await link.locator('.studied-mark').count(), 1);
  await capture(page, 'search-studied-multiple-witnesses', '#lesson-sidebar');
  const originalUrl = page.url();
  const [newTab] = await Promise.all([
    page.context().waitForEvent('page'),
    link.click({ modifiers: ['ControlOrMeta'] }),
  ]);
  const newTabErrors = watchErrors(newTab);
  await newTab.waitForLoadState('networkidle');
  assert.match(new URL(newTab.url()).pathname, /^\/lessons\/f02/);
  assert.equal(
    await newTab.locator('h1').innerText(),
    'The axioms of probability',
  );
  assert.deepEqual(newTabErrors, []);
  await newTab.close();
  assert.equal(page.url(), originalUrl);
  if (mobile) await button(page, 'Close lessons').click();
  if (mobile) {
    const pathname = new URL(page.url()).pathname;
    const historyLength = await page.evaluate(() => window.history.length);
    for (const activation of ['pointer', 'Enter']) {
      await button(page, 'Open lessons').click();
      assert.equal(await link.getAttribute('href'), pathname);
      assert.equal(await link.getAttribute('aria-current'), 'page');
      if (activation === 'pointer') await link.click();
      else {
        await link.focus();
        await page.keyboard.press(activation);
      }
      await capture(page, `current-lesson-${activation}`, '.lesson-head');
      assert.deepEqual(
        await page.evaluate(() => ({
          drawerOpen: document
            .querySelector('#lesson-sidebar')
            ?.classList.contains('open'),
          scrimPresent: !!document.querySelector('.scrim'),
          mainInert: document.querySelector('main')?.hasAttribute('inert'),
          menuExpanded: document
            .querySelector('.menu-button')
            ?.getAttribute('aria-expanded'),
          sidebarInert: document
            .querySelector('#lesson-sidebar')
            ?.hasAttribute('inert'),
          headingFocused:
            document.querySelector('main h1') === document.activeElement,
          pathname: window.location.pathname,
          historyLength: window.history.length,
        })),
        {
          drawerOpen: false,
          scrimPresent: false,
          mainInert: false,
          menuExpanded: 'false',
          sidebarInert: true,
          headingFocused: true,
          pathname,
          historyLength,
        },
        `${activation} current-lesson selection closes the drawer and focuses the heading`,
      );
    }
    for (const dismiss of ['Close lessons', 'Close lesson navigation']) {
      await button(page, 'Open lessons').click();
      if (dismiss === 'Close lesson navigation')
        await button(page, dismiss).click({
          position: { x: page.viewportSize().width - 4, y: 20 },
        });
      else await button(page, dismiss).click();
      assert.equal(await page.locator('.scrim').count(), 0);
      assert.equal(await page.locator('main').getAttribute('inert'), null);
      assert.notEqual(
        await page.locator('#lesson-sidebar').getAttribute('inert'),
        null,
      );
      assert.equal(
        await button(page, 'Open lessons').evaluate(
          (node) => node === document.activeElement,
        ),
        true,
      );
    }
  }
  await button(page, 'Practice').click();
  await page.goBack({ waitUntil: 'networkidle' });
  assert.match(new URL(page.url()).pathname, /^\/lessons\/f02/);
  await page.goForward({ waitUntil: 'networkidle' });
  assert.equal(new URL(page.url()).pathname, '/practice');
  await capture(page, 'keyboard-history', '.overview-heading');
  await goto(page, url, '/lessons/c04#lab');
  await page.locator('#lab').waitFor({ state: 'visible' });
  const position = await page.locator('#lab').boundingBox();
  assert.ok(
    position && position.y >= -1 && position.y < page.viewportSize().height,
    'direct #lab link must put the experiment in view',
  );
  record.proved = [
    'content-only and mixed search with ordered section witnesses',
    'ID, title, empty and no-result search without section captions',
    'search chapter collapse and restored browse preference',
    'native and modified lesson links, current styling and studied mark',
    'keyboard activation and heading focus',
    'browser back and forward',
    'direct experiment anchor',
    ...(mobile
      ? [
          'drawer autofocus, main inert and Escape focus restoration',
          'current-lesson pointer and Enter close the drawer without changing history',
          'drawer close button and scrim restore menu focus',
        ]
      : []),
  ];
}

async function labs(page, url, record, capture) {
  const cases = [
    ['birthday', 'C04', 'people', 40, '0.8912'],
    ['bayes', 'K03', 'prior', 0.2, '0.8261'],
    ['binomial-poisson', 'D05', 'trials', 200, 'p = λ/n = 0.0150'],
    [
      'normal-approximation',
      'R05',
      'trials',
      100,
      'P(X = 50): exact 0.0796, normal with continuity correction 0.0797',
    ],
    ['law-of-large-numbers', 'L02', 'tosses', 5000, 'after 5000 tosses'],
    ['central-limit', 'L04', 'n', 12, null],
  ];
  record.values = [];
  for (const [id, lessonId, control, value, expected] of cases) {
    await goto(page, url, `${lesson(lessonId)}#lab`);
    const result = page.getByTestId('lab-result');
    const before = await result.innerText();
    await page.locator(`input[name="${control}"]`).fill(String(value));
    await page.locator(`input[name="${control}"]`).dispatchEvent('input');
    const after = await result.innerText();
    assert.notEqual(after, before);
    if (expected)
      assert.ok(
        after.includes(expected),
        `${id}: expected ${expected}, got ${after}`,
      );
    assert.equal(
      await page.getByTestId(`${control}-value`).innerText(),
      String(value),
    );
    const lastNumber = (text) => Number(text.match(/[\d.]+$/)[0]);
    if (id === 'law-of-large-numbers')
      assert.ok(Math.abs(lastNumber(after) - 0.5) < 0.03);
    if (id === 'central-limit')
      assert.ok(
        lastNumber(after) < 0.1 && lastNumber(after) < lastNumber(before),
      );
    if (id === 'bayes') {
      assert.match(
        await page.locator('#lab').innerText(),
        /1900\.0 true positive results and 400\.0 false positive/,
      );
    } else {
      const image = page.locator('#lab').getByRole('img');
      assert.ok((await image.getAttribute('aria-label')).length > 10);
      await page.getByText('Read the chart values', { exact: true }).click();
      const table = page.locator('#lab table');
      assert.equal(await table.count(), 1);
      assert.ok((await table.locator('thead th[scope="col"]').count()) >= 2);
      assert.ok((await table.locator('tbody th[scope="row"]').count()) >= 16);
      if (id === 'birthday')
        assert.equal(
          await table.locator('tbody tr').nth(39).locator('td').innerText(),
          '0.8912',
        );
      if (id === 'binomial-poisson')
        assert.deepEqual(
          await table
            .locator('tbody tr')
            .first()
            .locator('td')
            .allTextContents(),
          ['0.0487', '0.0498'],
        );
      if (id === 'law-of-large-numbers')
        assert.equal(
          await table.locator('tbody tr').last().locator('td').innerText(),
          after.match(/[\d.]+$/)[0],
        );
      if (id === 'central-limit') {
        const densities = (
          await table.locator('tbody td:first-of-type').allTextContents()
        ).map(Number);
        const mass = densities.reduce(
          (sum, density) => sum + density * 0.25,
          0,
        );
        assert.ok(mass > 0.98 && mass <= 1.001);
      }
    }
    await capture(page, `lab-${id}`, '#lab');
    record.values.push({ lab: id, control, value, before, after });
    if (id === 'law-of-large-numbers') {
      await button(page, 'New run').click();
      assert.notEqual(await result.innerText(), after);
    }
  }
}

async function accounts(page, url, record, capture, context, expectedHttp) {
  expectedHttp.push(503);
  await page.route('**/api/account', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'account-unavailable' }),
    }),
  );
  await goto(page, url, lesson('F01'));
  await page
    .locator('.studied-toggle')
    .getByText(
      'Account progress is unavailable. Open Progress to retry before making changes.',
      { exact: true },
    )
    .waitFor();
  assert.equal(
    await button(page, 'Mark this lesson as studied').isDisabled(),
    true,
  );
  await reveal(page);
  assert.equal(await button(page, '✓ I got it').isDisabled(), true);
  assert.equal(await button(page, '↺ Review again').isDisabled(), true);
  await capture(page, 'account-unavailable', '.practice');
  await page.unroute('**/api/account');
  await panel(page);
  await button(page, 'Retry account').click();
  await guest(page);
  await goto(page, url, lesson('F01'));
  await guest(page);
  await button(page, 'Mark this lesson as studied').click();
  await reveal(page);
  await rate(page, '↺ Review again');
  await panel(page);
  const signIn = page.getByRole('link', {
    name: 'Sign in with ChatGPT',
    exact: true,
  });
  assert.equal(await signIn.getAttribute('target'), '_top');
  let releaseAccount;
  const discovery = new Promise((resolve) => {
    releaseAccount = resolve;
  });
  await page.route('**/api/account', async (route) => {
    await discovery;
    await route.continue();
  });
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      signIn.click(),
    ]);
    await page.locator('.account-panel[data-account-state="loading"]').waitFor({
      state: 'attached',
    });
    const studied = button(page, 'Mark this lesson as studied');
    assert.equal(await studied.isDisabled(), true);
    await pressed(studied, false);
    await reveal(page);
    for (const name of ['✓ I got it', '↺ Review again']) {
      const rating = button(page, name);
      assert.equal(await rating.isDisabled(), true);
      await pressed(rating, false);
    }
    await capture(page, 'account-discovery-pending', '.practice');
  } finally {
    releaseAccount();
  }
  await saved(page);
  await page.unroute('**/api/account');
  await pressed(button(page, 'Mark this lesson as studied'), false);
  await pressed(button(page, '↺ Review again'), false);
  await panel(page);
  await button(page, 'Preview guest import').click();
  assert.match(
    await account(page).innerText(),
    /Import adds 1 studied marks and 1 self-ratings/,
  );
  await button(page, 'Cancel import').click();
  await pressed(button(page, 'Mark this lesson as studied'), false);
  await button(page, 'Preview guest import').click();
  await button(page, 'Import guest progress').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.account-panel')
        ?.getAttribute('data-account-state') === 'saved' &&
      document
        .querySelector('.studied-toggle button')
        ?.getAttribute('aria-pressed') === 'true' &&
      [...document.querySelectorAll('.self-check button')].some(
        (node) =>
          node.textContent.includes('Review again') &&
          node.getAttribute('aria-pressed') === 'true',
      ),
  );
  await page.reload({ waitUntil: 'networkidle' });
  await saved(page);
  await pressed(button(page, '✓ Studied'), true);
  await reveal(page);
  await pressed(button(page, '↺ Review again'), true);
  await capture(page, 'account-import-reloaded', '.practice');
  await goto(page, url, lesson('F02'));
  await saved(page);
  await button(page, 'Mark this lesson as studied').click();
  await saved(page);
  await reveal(page);
  await rate(page, '✓ I got it');
  await saved(page);
  await page.reload({ waitUntil: 'networkidle' });
  await saved(page);
  await pressed(button(page, '✓ Studied'), true);
  await reveal(page);
  await pressed(button(page, '✓ I got it'), true);
  await capture(page, 'account-save-reloaded', '.practice');
  const anonymous = await page
    .context()
    .browser()
    .newContext({ viewport: page.viewportSize() });
  try {
    const other = await anonymous.newPage();
    const errors = watchErrors(other);
    await goto(other, url, lesson('F02'));
    await guest(other);
    await pressed(button(other, 'Mark this lesson as studied'), false);
    await reveal(other);
    await pressed(button(other, '✓ I got it'), false);
    assert.deepEqual(errors, []);
  } finally {
    await anonymous.close();
  }
  await goto(page, url, lesson('F03'));
  await saved(page);
  expectedHttp.push(503);
  await page.route('**/api/progress', (route) =>
    route.request().method() === 'PATCH'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'storage-unavailable' }),
        })
      : route.continue(),
  );
  await button(page, 'Mark this lesson as studied').click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.account-panel')
        ?.getAttribute('data-account-state') === 'error',
  );
  assert.match(await page.locator('.studied-toggle').innerText(), /Not saved/);
  await panel(page);
  await capture(page, 'account-save-failed', '.account-panel');
  await page.unroute('**/api/progress');
  await button(page, 'Retry unsaved changes').click();
  await saved(page);
  await page.reload({ waitUntil: 'networkidle' });
  await saved(page);
  await pressed(button(page, '✓ Studied'), true);
  const stale = await context.newPage();
  const staleErrors = watchErrors(stale, (message) =>
    expectedHttpConsole(message, url, expectedHttp),
  );
  try {
    await goto(stale, url, lesson('F03'));
    await saved(stale);
    await button(page, '✓ Studied').click();
    await saved(page);
    expectedHttp.push(409);
    await button(stale, '✓ Studied').click();
    await stale.waitForFunction(
      () =>
        document
          .querySelector('.account-panel')
          ?.getAttribute('data-account-state') === 'conflict',
    );
    await panel(stale);
    await capture(stale, 'account-stale-conflict', '.account-panel');
    await button(stale, 'Use account version').click();
    await saved(stale);
    await pressed(button(stale, 'Mark this lesson as studied'), false);
    assert.deepEqual(staleErrors, []);
  } finally {
    await stale.close();
  }
  const response = await page.request.get(`${url}/api/progress`);
  assert.equal(response.status(), 200);
  const stored = await response.json();
  assert.ok(
    stored.records.some(
      (row) =>
        row.lessonId === 'F02' && row.studied && row.verdict === 'got-it',
    ),
  );
  record.persisted = stored.records;
  await panel(page);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.getByRole('link', { name: 'Sign out', exact: true }).click(),
  ]);
  await guest(page);
  await goto(page, url, lesson('F01'));
  await guest(page);
  await pressed(button(page, '✓ Studied'), true);
  await reveal(page);
  await pressed(button(page, '↺ Review again'), true);
  await goto(page, url, lesson('F02'));
  await guest(page);
  await pressed(button(page, 'Mark this lesson as studied'), false);
  await reveal(page);
  await pressed(button(page, '✓ I got it'), false);
  await panel(page);
  await capture(page, 'signed-out-guest-preserved', '.account-panel');
  record.proved = [
    'pending account discovery hides guest marks and disables progress controls',
    'unavailable account controls disabled with visible recovery',
    'top-level local sign-in fixture',
    'guest progress does not import automatically',
    'cancel and explicit import',
    'account studied and rating survive reload',
    'separate anonymous context isolation',
    'honest failed save and retry',
    'real two-tab stale-revision conflict and account-version resolution',
    'account API readback',
    'sign-out restores unchanged guest copy',
  ];
  record.boundary =
    'Loopback fixture and local D1 only. Hosted ChatGPT authentication and a real second account remain unverified.';
}

function expectedHttpConsole(message, url, expectedHttp) {
  if (
    !['/api/progress', '/api/account'].some(
      (path) => message.location().url === `${url}${path}`,
    )
  )
    return false;
  const status = Number(
    /server responded with a status of (\d+)/.exec(message.text())?.[1],
  );
  const index = expectedHttp.indexOf(status);
  if (index < 0) return false;
  expectedHttp.splice(index, 1);
  return true;
}

let browser;
try {
  const { chromium } = await import('playwright-core');
  const executablePath =
    process.env.CHROME_PATH ??
    [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
    ].find(existsSync);
  browser = await chromium.launch({ executablePath, headless: true });
  for (const [width, viewport] of selectedViewports) {
    const dataDir = mkdtempSync(join(tmpdir(), 'probability-journeys-'));
    try {
      writeFileSync(
        join(out, `${width}.launch.log`),
        await driver('launch', dataDir, ['--mode', 'dev', '--migrate']),
      );
      await driver('doctor', dataDir);
      const { url } = JSON.parse(
        readFileSync(join(dataDir, 'state.json'), 'utf8'),
      );
      for (const [id, journey] of selectedJourneys) {
        const context = await browser.newContext({
          viewport,
          reducedMotion: 'reduce',
        });
        const page = await context.newPage();
        const expectedHttp = [];
        const errors = watchErrors(page, (message) =>
          expectedHttpConsole(message, url, expectedHttp),
        );
        const record = {
          id,
          viewport: width,
          captures: [],
          failures: [],
          completed: false,
        };
        const capture = async (target, name, selector) => {
          const path = join(out, id, `${name}.${width}.png`);
          await capturePage(target, path, selector);
          record.captures.push(path);
          record.failures.push(...(await renderingProblems(target)));
        };
        try {
          await journey(page, url, record, capture, context, expectedHttp);
          record.completed = true;
        } catch (error) {
          record.failures.push(error.message);
          try {
            await capturePage(page, join(out, id, `failure.${width}.png`));
          } catch {}
          await driver('doctor', dataDir);
        } finally {
          record.failures.push(
            ...errors.map((error) => `browser error: ${error}`),
          );
          failures.push(
            ...record.failures.map((error) => `${id}@${width}: ${error}`),
          );
          results.push(record);
          await context.close();
        }
        console.log(
          `${record.failures.length ? 'FAIL' : 'PASS'} ${id}@${width}`,
        );
      }
      if (width === 'mobile') {
        const page = await browser.newPage({
          viewport: { width: 320, height: 844 },
        });
        const errors = watchErrors(page);
        try {
          await goto(page, url, '/reference');
          await openDetails(page);
          assert.equal(
            await page.locator('.reference-list details[open]').count(),
            JSON.parse(
              readFileSync(join(root, 'src/content/order.json'), 'utf8'),
            ).length,
          );
          for (const id of ['D05', 'J05'])
            await capturePage(
              page,
              join(out, `reflow-320-${id}.png`),
              `.reference-list > div:has(button:text-matches("^${id} "))`,
            );
          assert.deepEqual(await renderingProblems(page), []);
          await page.locator('h1').scrollIntoViewIfNeeded();
          await capturePage(page, join(out, 'reflow-320.png'));
          await goto(page, url, lesson('F02'));
          await guest(page);
          await button(page, 'Mark this lesson as studied').click();
          await button(page, 'Open lessons').click();
          const search = page.getByRole('searchbox', {
            name: 'Find a concept',
          });
          await search.fill('Boole');
          assert.equal(await page.locator('.nav-link').count(), 2);
          await capturePage(
            page,
            join(out, 'reflow-320-search-content-witnesses.png'),
            '#lesson-sidebar',
          );
          await search.fill('Boole 60%');
          const link = page.getByRole('link', { name: /F02/ });
          assert.equal(await page.locator('.nav-link').count(), 1);
          assert.equal(
            await link.locator('.nav-match').innerText(),
            'Words in Worked example · Practice',
          );
          assert.equal(await link.getAttribute('aria-current'), 'page');
          assert.equal(await link.locator('.studied-mark').count(), 1);
          await capturePage(
            page,
            join(out, 'reflow-320-search-studied-multiple-witnesses.png'),
            '#lesson-sidebar',
          );
          assert.deepEqual(await renderingProblems(page), []);
          assert.deepEqual(errors, []);
          reflow320 = true;
        } catch (error) {
          failures.push(`reflow@320: ${error.message}`);
          try {
            await capturePage(page, join(out, 'reflow-320-failure.png'));
          } catch {}
        } finally {
          await page.close();
        }
      }
    } finally {
      try {
        await driver('stop', dataDir);
      } catch (error) {
        failures.push(`cleanup: ${error.message}`);
      }
      if (existsSync(join(dataDir, 'server.log')))
        writeFileSync(
          join(out, `${width}.server.log`),
          readFileSync(join(dataDir, 'server.log')),
        );
      if (!existsSync(join(dataDir, 'state.json')))
        rmSync(dataDir, { recursive: true, force: true });
    }
  }
} catch (error) {
  failures.push(error.message);
} finally {
  await browser?.close();
}
const after = workspaceIdentity();
if (
  source.sourceDigest !== after.sourceDigest ||
  source.buildDigest !== after.buildDigest
)
  failures.push('source or build changed during journeys');
const result = {
  at: new Date().toISOString(),
  kind: complete ? 'local-ui-journeys' : 'selected-ui-journeys',
  selection: {
    journey: options.only ?? null,
    viewport: options.viewport ?? null,
  },
  full:
    complete &&
    results.length === expectedGroups &&
    results.every((record) => record.completed) &&
    reflow320,
  reflow320,
  source,
  after,
  results,
  failures,
  success:
    results.length === expectedGroups &&
    results.every((record) => record.completed) &&
    failures.length === 0,
  hostedAuthentication: 'unverified; local development fixture only',
};
writeFileSync(join(out, 'result.json'), JSON.stringify(result, null, 2));
if (!result.success) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `journeys ok — ${results.length} completed groups; ${complete ? 'full local UI run' : 'selected development run'}; reflow320=${reflow320}; evidence in ${out}`,
  );
