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
// Real text from PR #14 before its first math review (see the fixture's "source").
const miss = JSON.parse(
  readFileSync('scripts/fixtures/pr14-before-math-r1.json', 'utf8'),
);

// Put the old entries back into today's lessons, replacing the entry at the same position.
function withOldText() {
  const all = structuredClone(lessons());
  for (const { id, field, text } of miss.entries) {
    const l = all.find((x) => x.id === id);
    const head = text.split('.')[0];
    const i = l[field].findIndex((e) => e.split('.')[0] === head);
    assert.ok(i >= 0, `${id} ${field} has no entry starting "${head}"`);
    l[field][i] = text;
  }
  return all;
}

test('the current lessons pass', () => {
  assert.deepEqual(checkResults(lessons(), results), []);
});

test('PR #14 before math round 1: unmarked quoted results fail', () => {
  const errors = checkResults(withOldText(), results).join('\n');
  for (const id of [
    'strong-law',
    'edgeworth',
    'berry-esseen',
    'joint-mgf-uniqueness',
  ])
    assert.match(errors, new RegExp(`\\b${id} is quoted`), id);
});

test('an unregistered eponymous result fails and names the registry', () => {
  const all = structuredClone(lessons());
  all[0].caution += " By Hoeffding's inequality the bound is sharper.";
  assert.match(
    checkResults(all, results).join('\n'),
    /Hoeffding's inequality" is not in src\/content\/results\.json/,
  );
});

test('a proved result whose home lesson never names it fails', () => {
  const bad = results.map((r) => (r.id === 'markov' ? { ...r, in: 'F01' } : r));
  assert.match(
    checkResults(lessons(), bad).join('\n'),
    /markov: lesson F01 never names it/,
  );
});

test('a curly apostrophe does not hide an unregistered name (PR #19 verifier r1)', () => {
  const all = structuredClone(lessons());
  all[0].caution += ' By Hoeffding’s inequality the bound is sharper.';
  assert.match(
    checkResults(all, results).join('\n'),
    /Hoeffding’s inequality" is not in src\/content\/results\.json/,
  );
  const unregistered = results.filter(
    (r) => !['boole', 'vandermonde'].includes(r.id),
  );
  const errors = checkResults(lessons(), unregistered).join('\n');
  assert.match(errors, /Boole’s inequality/);
  assert.match(errors, /Vandermonde’s identity/);
});
