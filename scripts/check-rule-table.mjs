#!/usr/bin/env node
// Every row of the AGENTS.md “Rule → enforcer” table must name at least one enforcer that
// exists: a file path in backticks, or an npm script. Fix: point the row at a real check,
// or delete the rule.
import { existsSync, readFileSync } from 'node:fs';

const agents = readFileSync('AGENTS.md', 'utf8');
const table = agents.split('## Rule → enforcer')[1]?.split('\n## ')[0] ?? '';
const rows = table
  .split('\n')
  .filter(
    (l) =>
      l.startsWith('|') && !/^\|\s*-/.test(l) && !/^\|\s*Rule\s*\|/.test(l),
  );
const scripts = Object.keys(
  JSON.parse(readFileSync('package.json', 'utf8')).scripts,
);
const errors = [];
if (rows.length === 0) errors.push('AGENTS.md has no Rule → enforcer table');
for (const row of rows) {
  const [, rule, enforcer] = row.split('|').map((c) => c.trim());
  const refs = [...(enforcer ?? '').matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  const real = refs.filter(
    (r) =>
      existsSync(r) ||
      scripts.includes(r.replace(/^npm run /, '')) ||
      /^(strict|check|evidence)$/.test(r),
  );
  const missing = refs.filter((r) => /[/.]/.test(r) && !existsSync(r));
  if (real.length === 0 && !/GitHub ruleset/.test(enforcer))
    errors.push(`rule “${rule}” names no existing enforcer`);
  for (const m of missing)
    errors.push(`rule “${rule}” names ${m}, which does not exist`);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`check:rules ok — ${rows.length} rules, every enforcer exists`);
