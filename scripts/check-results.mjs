#!/usr/bin/env node
// Runs scripts/results-check.mjs on every lesson. Fix: correct a lesson's "results" tags or the
// row in src/content/results.json, as the error says.
import { readdirSync, readFileSync } from 'node:fs';
import { checkResults } from './results-check.mjs';

const dir = 'src/content';
const lessons = readdirSync(dir)
  .filter((f) => /^part\d+\.json$/.test(f))
  .flatMap((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
const results = JSON.parse(readFileSync(`${dir}/results.json`, 'utf8'));
const errors = checkResults(lessons, results);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(
  `check:results ok — ${results.length} named results, ${lessons.length} lessons`,
);
