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
const checkpoints = JSON.parse(readFileSync(`${dir}/checkpoints.json`, 'utf8'));
const distributions = JSON.parse(
  readFileSync(`${dir}/distributions.json`, 'utf8'),
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
if (position.size !== order.length)
  errors.push('order.json lists a lesson more than once');
for (const l of lessons)
  if (!Array.isArray(l.prerequisites))
    fail(l, 'prerequisites must be an array (use [] for none)');
for (const l of lessons) {
  if (!position.has(l.id)) fail(l, 'not listed in order.json');
  for (const p of Array.isArray(l.prerequisites) ? l.prerequisites : []) {
    if (!seen.has(p)) fail(l, `prerequisite ${p} does not exist`);
    else if ((position.get(p) ?? 1e9) >= (position.get(l.id) ?? -1))
      fail(l, `prerequisite ${p} must come earlier in order.json`);
  }
}
for (const id of order)
  if (!seen.has(id))
    errors.push(`order.json lists ${id}, which no part file defines`);

const nonemptyText = (value) =>
  typeof value === 'string' && value.trim().length > 0;
const chapters = new Set(lessons.map((lesson) => lesson.cluster));
const checkpointChapters = new Set();
const checkpointIds = new Set();
const problemIds = new Set();
if (!Array.isArray(checkpoints))
  errors.push('checkpoints.json must be an array of chapter checkpoints');
for (const checkpoint of Array.isArray(checkpoints) ? checkpoints : []) {
  const label = `checkpoints.json ${checkpoint.id ?? '?'}`;
  for (const key of ['id', 'cluster', 'title'])
    if (!nonemptyText(checkpoint[key])) errors.push(`${label}: missing ${key}`);
  if (checkpointIds.has(checkpoint.id))
    errors.push(`${label}: duplicate checkpoint id`);
  checkpointIds.add(checkpoint.id);
  if (!chapters.has(checkpoint.cluster))
    errors.push(`${label}: cluster must name an existing chapter`);
  if (checkpointChapters.has(checkpoint.cluster))
    errors.push(`${label}: chapter has more than one checkpoint set`);
  checkpointChapters.add(checkpoint.cluster);
  if (!Array.isArray(checkpoint.problems) || checkpoint.problems.length !== 3)
    errors.push(`${label}: needs exactly three problems`);
  for (const problem of Array.isArray(checkpoint.problems)
    ? checkpoint.problems
    : []) {
    const problemLabel = `${label} ${problem.id ?? '?'}`;
    for (const key of ['id', 'prompt', 'answer'])
      if (!nonemptyText(problem[key]))
        errors.push(`${problemLabel}: missing ${key}`);
    if (problemIds.has(problem.id))
      errors.push(`${problemLabel}: duplicate problem id`);
    problemIds.add(problem.id);
    if (
      !Array.isArray(problem.hints) ||
      !problem.hints.length ||
      !problem.hints.every(nonemptyText)
    )
      errors.push(`${problemLabel}: needs nonempty hints`);
    if (!Array.isArray(problem.lessonIds) || !problem.lessonIds.length)
      errors.push(`${problemLabel}: needs relevant lessonIds`);
    for (const id of Array.isArray(problem.lessonIds) ? problem.lessonIds : [])
      if (!seen.has(id))
        errors.push(`${problemLabel}: unknown lesson reference ${id}`);
  }
}
for (const chapter of chapters)
  if (!checkpointChapters.has(chapter))
    errors.push(`checkpoints.json: missing chapter ${chapter}`);

const distributionNames = new Set();
if (!Array.isArray(distributions) || !distributions.length)
  errors.push('distributions.json needs an array of distribution references');
for (const distribution of Array.isArray(distributions) ? distributions : []) {
  const label = `distributions.json ${distribution.name ?? '?'}`;
  for (const key of [
    'name',
    'lessonId',
    'support',
    'parameters',
    'formula',
    'mean',
    'variance',
    'caution',
  ])
    if (!nonemptyText(distribution[key]))
      errors.push(`${label}: missing ${key}`);
  if (distributionNames.has(distribution.name))
    errors.push(`${label}: duplicate distribution name`);
  distributionNames.add(distribution.name);
  if (!seen.has(distribution.lessonId))
    errors.push(`${label}: unknown lesson reference ${distribution.lessonId}`);
}

const strings = (value) =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(strings)
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(strings)
        : [];
const math = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;
for (const l of [
  ...lessons,
  ...(Array.isArray(checkpoints) ? checkpoints : []).map((checkpoint) => ({
    ...checkpoint,
    file: 'checkpoints.json',
  })),
  ...(Array.isArray(distributions) ? distributions : []).map(
    (distribution) => ({
      ...distribution,
      id: distribution.name,
      file: 'distributions.json',
    }),
  ),
])
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
  `check:content ok — ${lessons.length} lessons, ${chapters.size} chapters, ${problemIds.size} checkpoint problems, ${distributionNames.size} distribution references`,
);
