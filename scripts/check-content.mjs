#!/usr/bin/env node
// Validates every lesson: required fields, unique IDs, prerequisites that exist and
// come earlier, order.json matching the part files, known lab IDs, and mathematics
// that KaTeX can render. Each error names the lesson and field to fix.
import { readdirSync, readFileSync } from 'node:fs';
import katex from 'katex';

const dir = 'src/content';
const labIds = [
  ...readFileSync(`${dir}/types.ts`, 'utf8').matchAll(/\|\s*'([a-z-]+)'/g),
].map((m) => m[1]);
const order = JSON.parse(readFileSync(`${dir}/order.json`, 'utf8'));
const lessons = readdirSync(dir)
  .filter((f) => /^part\d+\.json$/.test(f))
  .flatMap((f) =>
    JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).map((l) => ({
      ...l,
      file: f,
    })),
  );
const errors = [];
const fail = (lesson, msg) =>
  errors.push(`${lesson.id ?? '?'} (${lesson.file}): ${msg}`);

const text = [
  'title',
  'cluster',
  'question',
  'summary',
  'intuition',
  'theorem',
  'caution',
  'reference',
];
const seen = new Set();
for (const l of lessons) {
  if (!/^[A-Z][0-9]{2}$/.test(l.id ?? ''))
    fail(l, 'id must be one capital letter and two digits');
  if (seen.has(l.id)) fail(l, 'duplicate id');
  seen.add(l.id);
  for (const key of text)
    if (typeof l[key] !== 'string' || !l[key].trim()) fail(l, `missing ${key}`);
  for (const key of ['definition', 'hypotheses', 'proof'])
    if (!Array.isArray(l[key]) || l[key].length === 0)
      fail(l, `${key} needs at least one entry`);
  if (!l.example?.prompt || !l.example?.steps?.length || !l.example?.conclusion)
    fail(l, 'example needs prompt, steps, conclusion');
  if (!l.practice?.prompt || !l.practice?.hints?.length || !l.practice?.answer)
    fail(l, 'practice needs prompt, hints, answer');
  if (l.lab && !labIds.includes(l.lab))
    fail(l, `unknown lab ${l.lab}; add it to LabId in types.ts and Labs.tsx`);
}
const position = new Map(order.map((id, i) => [id, i]));
for (const l of lessons) {
  if (!position.has(l.id)) fail(l, 'not listed in order.json');
  for (const p of l.prerequisites ?? []) {
    if (!seen.has(p)) fail(l, `prerequisite ${p} does not exist`);
    else if ((position.get(p) ?? 1e9) >= (position.get(l.id) ?? -1))
      fail(l, `prerequisite ${p} must come earlier in order.json`);
  }
}
for (const id of order)
  if (!seen.has(id))
    errors.push(`order.json lists ${id}, which no part file defines`);

const strings = (value) =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(strings)
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(strings)
        : [];
const math = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;
for (const l of lessons)
  for (const s of strings({ ...l, file: undefined })) {
    for (const m of s.matchAll(math)) {
      try {
        katex.renderToString(m[1] ?? m[2], {
          displayMode: m[1] !== undefined,
          throwOnError: true,
        });
      } catch (e) {
        fail(
          l,
          `KaTeX cannot render “${(m[1] ?? m[2]).slice(0, 60)}”: ${e.message}`,
        );
      }
    }
    const stripped = s.replace(math, '');
    if (/\\\(|\\\)|\\\[|\\\]/.test(stripped))
      fail(l, `unbalanced math delimiters in “${s.slice(0, 60)}”`);
  }

if (errors.length) {
  console.error(errors.join('\n'));
  console.error(`\n${errors.length} content error(s).`);
  process.exit(1);
}
console.log(
  `check:content ok — ${lessons.length} lessons, ${new Set(lessons.map((l) => l.cluster)).size} chapters`,
);
