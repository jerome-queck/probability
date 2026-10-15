import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { checkResults } from './results-check.mjs';

const dir = 'src/content';
const lessons = () =>
  readdirSync(dir)
    .filter((f) => /^part\d+\.json$/.test(f))
    .flatMap((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
const results = JSON.parse(readFileSync(`${dir}/results.json`, 'utf8'));
const run = (ls, rs = results) => checkResults(ls, rs).join('\n');

test('the current lessons pass', () => {
  assert.deepEqual(checkResults(lessons(), results), []);
});

// PR #19 reviewer 1 (c03c05ff): deleting these rows passed the prose scanner silently.
test('deleting any registry row fails, because a lesson still tags it', () => {
  for (const id of [
    'binomial-theorem',
    'multinomial-theorem',
    'poisson-limit',
    'weak-law',
    'continuity-theorem',
    'central-limit',
    'strong-law',
    'total-probability',
    'lotus',
    'inclusion-exclusion',
  ])
    assert.match(
      run(
        lessons(),
        results.filter((r) => r.id !== id),
      ),
      new RegExp(`results: "${id}" is not in src/content/results\\.json`),
      id,
    );
});

test('a registered result that no lesson tags fails', () => {
  const all = lessons().map((l) => ({
    ...l,
    results: l.results.filter((id) => id !== 'strong-law'),
  }));
  assert.match(
    run(all),
    /results\.json strong-law: no lesson lists it in "results"; tag the lessons that name it, or delete the row/,
  );
});

test("a proved or quoted result's home lesson must tag it", () => {
  const all = lessons();
  const e05 = all.find((l) => l.id === 'E05');
  e05.results = e05.results.filter((id) => id !== 'wald');
  assert.match(
    run(all),
    /E05 results: must list "wald", which results\.json says this lesson quotes/,
  );
});

test('a lesson without a results array, or a row with a bad field, fails', () => {
  const all = lessons();
  delete all[0].results;
  assert.match(run(all), /F01 results: must be an array/);
  const errors = run(lessons(), [
    ...results,
    { id: 'x', name: ' ', status: 'proved', in: 'F01' },
    { id: 'y', name: 'y', status: 'shown', in: 'F01' },
    { id: 'z', name: 'z', status: 'quoted', in: 'Q99' },
    results[0],
  ]);
  assert.match(errors, /x: give it a "name"/);
  assert.match(errors, /y: status must be proved, quoted or background/);
  assert.match(errors, /z: "in" must name the lesson/);
  assert.match(errors, /binomial-theorem: listed twice/);
});
