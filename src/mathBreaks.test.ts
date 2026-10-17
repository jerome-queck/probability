import assert from 'node:assert/strict';
import test from 'node:test';
import { isShortFormula, keepShortTail } from './mathBreaks.ts';

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

test('short formulas are measured in visible characters, not source length', () => {
  // E03 at daf7a37 split this one in half at 390px; its source is 19 characters long.
  assert.ok(isShortFormula('\\sigma_Y=-b\\sigma_X'));
  assert.ok(isShortFormula('Y\\sim\\operatorname{Poisson}(\\lambda_2)'));
  assert.ok(!isShortFormula('E[XY]=E[X^3]=(-27-1+1+27)/4=0'));
});
