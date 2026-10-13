import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { lessonMatches } from './search.ts';
import type { Lesson } from './types.ts';

const first: Lesson = JSON.parse(
  readFileSync(new URL('./part01.json', import.meta.url), 'utf8'),
)[0];

test('search matches IDs, titles and words in any order', () => {
  assert.ok(lessonMatches('', first));
  assert.ok(lessonMatches(first.id.toLowerCase(), first));
  assert.ok(lessonMatches('events sample', first));
  assert.ok(!lessonMatches('zebra', first));
});
