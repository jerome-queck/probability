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

test("main's E05 named Wald's equation, unproved, with no marker (PR #19 verifier r2)", () => {
  const old = JSON.parse(
    readFileSync('scripts/fixtures/e05-wald-unmarked.json', 'utf8'),
  );
  const all = structuredClone(lessons());
  all.find((l) => l.id === old.id)[old.field] = old.text;
  assert.match(
    checkResults(all, results).join('\n'),
    /E05 caution: wald is quoted, not proved/,
  );
});

test('a proved result whose home lesson never uses its names fails', () => {
  const bad = results.map((r) => (r.id === 'markov' ? { ...r, in: 'F01' } : r));
  assert.match(
    checkResults(lessons(), bad).join('\n'),
    /markov: lesson F01 never uses any of its names/,
  );
});

// The check is an exact name match (CoS scope cut after PR #19 verifier r8): curly apostrophes
// and en dashes count as the same name, case does not matter, and only whole words match.
const inject = (text) => {
  const all = structuredClone(lessons());
  all[0].caution += text;
  return checkResults(all, results).join('\n');
};

test('a quoted name matches exactly: curly apostrophe, en dash and case', () => {
  for (const t of [' Wald’s equation.', ' Berry–Esseen.', ' The Strong Law.'])
    assert.match(inject(t), /F01 caution: .* is quoted, not proved/, t);
  assert.equal(inject(' Wald’s equation, quoted without proof.'), '');
});

test('only whole words match', () => {
  assert.equal(inject(' Edgeworthian and strong lawn.'), '');
});

test('a row needs names, a known status and a home lesson', () => {
  const bad = [
    { id: 'x', names: [], status: 'proved', in: 'F01' },
    { id: 'y', names: ['y'], status: 'shown', in: 'F01' },
    { id: 'z', names: ['z'], status: 'quoted', in: 'Q99' },
  ];
  const errors = checkResults(lessons(), bad).join('\n');
  assert.match(errors, /x: list at least one name/);
  assert.match(errors, /y: status must be proved, quoted or background/);
  assert.match(errors, /z: "in" must name the lesson/);
});
