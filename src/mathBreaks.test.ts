import assert from 'node:assert/strict';
import test from 'node:test';
import { keepShortTail } from './mathBreaks.ts';

test('a tiny last piece is joined to the piece before it', () => {
  assert.equal(
    keepShortTail('\\binom{12}{2}=3\\cdot 22=66'),
    '\\binom{12}{2}=3\\cdot{ 22=66}',
  );
  assert.equal(keepShortTail('x=1'), '{x=1}');
  assert.equal(keepShortTail('a+b+c'), 'a+{b+c}');
});

test('short brackets are not torn', () => {
  assert.equal(keepShortTail('\\frac{n!}{k!(n-k)!}'), '\\frac{n!}{k!({n-k})!}');
  assert.equal(
    keepShortTail('P(A)\\cdot (n-k)+ \\sum_{i} q_i r_i s_i'),
    'P({A})\\cdot ({n-k})+ \\sum_{i} q_i r_i s_i',
  );
});

test('long tails and relations inside groups are left alone', () => {
  assert.equal(keepShortTail('f_{x=1}'), 'f_{x=1}');
  assert.equal(
    keepShortTail('P(E)=\\sum_{i=1}^{n} q_i r_i'),
    'P({E})=\\sum_{i=1}^{n} q_i r_i',
  );
});

test('products in brackets, \\big brackets and a long last factor stay whole', () => {
  assert.equal(
    keepShortTail('(8\\cdot 7\\cdot 6)/(3\\cdot 2\\cdot 1)=336/6=56'),
    '({8\\cdot 7\\cdot 6})/({3\\cdot 2\\cdot 1})={336/6=56}',
  );
  assert.equal(
    keepShortTail('\\big(1-\\tfrac{1}{365}\\big)'),
    '\\big({1-\\tfrac{1}{365}}\\big)',
  );
  assert.equal(keepShortTail('\\left(a+b\\right)'), '\\left(a+b\\right)');
});

test('sized and \\left…\\right delimiters still parse', () => {
  assert.equal(keepShortTail('\\bigl(n-k\\bigr)'), '\\bigl({n-k}\\bigr)');
  assert.equal(
    keepShortTail('\\left\\{a+b+c\\right\\}'),
    '\\left\\{a+b+c\\right\\}',
  );
});

test('every formula in the lessons still renders after grouping', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const katex = (await import('katex')).default;
  const dir = new URL('./content/', import.meta.url);
  const strings: string[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') strings.push(v);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  for (const file of readdirSync(dir).filter((f) => /^part\d+\.json$/.test(f)))
    walk(JSON.parse(readFileSync(new URL(file, dir), 'utf8')));
  let count = 0;
  for (const text of strings)
    for (const m of text.matchAll(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g)) {
      katex.renderToString(keepShortTail(m[1] ?? m[2]), { throwOnError: true });
      count++;
    }
  assert.ok(count > 50, `only ${count} formulas found`);
});
