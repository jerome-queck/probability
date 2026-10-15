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
  // Before this round the scanner never looked at “equation”, “law”, “rule” or “formula”.
  const unregistered = results.filter((r) => r.id !== 'wald');
  assert.match(
    checkResults(all, unregistered).join('\n'),
    /"Wald's equation" is not in src\/content\/results\.json/,
  );
});

test('accented names and law/rule/formula titles are scanned', () => {
  const all = structuredClone(lessons());
  all[0].caution +=
    ' Hölder’s inequality, Little’s law, Bayes rule aside, Kac’s formula and Bienaymé’s identity.';
  const errors = checkResults(all, results).join('\n');
  for (const name of [
    'Hölder’s inequality',
    'Little’s law',
    'Kac’s formula',
    'Bienaymé’s identity',
  ])
    assert.match(errors, new RegExp(`"${name}" is not in`), name);
  assert.doesNotMatch(errors, /Bayes rule/);
});

test('a titled criterion must be registered (PR #19 math r1: factorisation criterion in J02)', () => {
  const unregistered = results.filter(
    (r) => r.id !== 'factorisation-criterion',
  );
  assert.match(
    checkResults(lessons(), unregistered).join('\n'),
    /J02 .*"Factorisation criterion" is not in src\/content\/results\.json/,
  );
});

// PR #19 reviewer 1 (c03c05ff): the skip list dropped titles starting with Binomial, Poisson,
// Weak, Continuity, ..., and lowercase titles ("central limit theorem", "law of total
// probability") were never scanned, so those registry rows could be deleted silently.
// Only rows for results the lessons state without a title are registered by hand.
const HAND_ONLY = ['mgf-uniqueness', 'joint-mgf-uniqueness'];

test('deleting any titled registry row fails the check', () => {
  const all = lessons();
  for (const r of results) {
    const errors = checkResults(
      all,
      results.filter((x) => x !== r),
    );
    if (HAND_ONLY.includes(r.id)) continue;
    assert.ok(errors.length > 0, `deleting ${r.id} passed silently`);
  }
});

test('titles starting with Binomial, Continuity, Weak or Poisson are scanned; ordinary phrases are not', () => {
  const all = structuredClone(lessons());
  all[0].caution +=
    ' The Binomial theorem, the Continuity theorem, the Weak law and the Poisson approximation.';
  const errors = checkResults(
    all,
    results.filter(
      (r) =>
        ![
          'binomial-theorem',
          'continuity-theorem',
          'weak-law',
          'poisson-limit',
        ].includes(r.id),
    ),
  ).join('\n');
  for (const name of [
    'Binomial theorem',
    'Continuity theorem',
    'Weak law',
    'Poisson approximation',
  ])
    assert.match(errors, new RegExp(`"${name}" is not in`), name);
  const plain = structuredClone(lessons());
  plain[0].caution +=
    ' The bound holds. This formula and the same theorem; the variance formula; the Poisson formula.';
  assert.deepEqual(checkResults(plain, results), []);
});

test('lowercase titles are scanned: theorem, criterion, principle, strong/weak law, law of total …', () => {
  const all = structuredClone(lessons());
  all[0].caution +=
    ' By the Kolmogorov extension theorem, the cdf criterion, the pigeonhole principle and the law of total covariance.';
  const errors = checkResults(
    all,
    results.filter((r) => r.id !== 'cdf-criterion'),
  ).join('\n');
  for (const name of [
    'the Kolmogorov extension theorem',
    'the cdf criterion',
    'the pigeonhole principle',
    'law of total covariance',
  ])
    assert.match(errors, new RegExp(`"${name}" is not in`), name);
});
