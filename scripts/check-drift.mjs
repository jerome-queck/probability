#!/usr/bin/env node
// Self-maintenance gate: fails when the feature map, the verify skill, the driver CLI,
// the smoke drives, the routes, the labs, the lesson chapters or the tests drift apart.
// Each message says which file to update in the same PR.
import { existsSync, readdirSync, readFileSync } from 'node:fs';

const skill = '.cursor/skills/verify-probability';
const features = `${skill}/features`;
const read = (p) => readFileSync(p, 'utf8');
const errors = [];

// 1. Feature index ⇔ feature files.
const index = read(`${features}/README.md`);
const indexed = [...index.matchAll(/\]\(([a-z-]+\.md)\)/g)].map((m) => m[1]);
const files = readdirSync(features).filter(
  (f) => f.endsWith('.md') && f !== 'README.md',
);
for (const f of files)
  if (!indexed.includes(f))
    errors.push(`${features}/${f} is not listed in features/README.md`);
for (const f of indexed)
  if (!files.includes(f))
    errors.push(`features/README.md links ${f}, which does not exist`);

// 2. Each feature file has the four required sections.
for (const f of files) {
  const text = read(`${features}/${f}`);
  for (const h of [
    '## Sub-features',
    '## How to get to it (user POV)',
    '## Driving it with control-probability',
    '## Gotchas',
  ])
    if (!text.includes(h)) errors.push(`${features}/${f} is missing “${h}”`);
}

// 3. Every top-level view has a feature file.
const routes = read('src/routes.ts');
const views = [
  ...(/views = \[([^\]]*)\]/.exec(routes)?.[1] ?? '').matchAll(/'([a-z-]+)'/g),
].map((m) => m[1]);
const viewFeature = { learn: 'home.md' };
for (const v of views) {
  const f = viewFeature[v] ?? `${v}.md`;
  if (!files.includes(f))
    errors.push(
      `view “${v}” in src/routes.ts has no feature file ${features}/${f}`,
    );
}

// 4. Every lab ID is mapped; every lab used by a lesson is driven by smoke.json.
const labIds = [
  ...read('src/content/types.ts').matchAll(/\|\s*'([a-z-]+)'/g),
].map((m) => m[1]);
const labsDoc = read(`${features}/labs.md`);
const labsCode = read('src/Labs.tsx');
for (const id of labIds) {
  if (!labsDoc.includes(`\`${id}\``))
    errors.push(`lab “${id}” has no row in ${features}/labs.md`);
  if (!labsCode.includes(`'${id}'`) && !labsCode.includes(`${id}:`))
    errors.push(
      `lab “${id}” is declared in types.ts but not registered in src/Labs.tsx`,
    );
}
const lessons = readdirSync('src/content')
  .filter((f) => /^part\d+\.json$/.test(f))
  .flatMap((f) => JSON.parse(read(`src/content/${f}`)));
const smoke = JSON.parse(read(`${features}/smoke.json`));
const usedLabs = new Set(lessons.filter((l) => l.lab).map((l) => l.lab));
for (const lab of usedLabs)
  if (
    !smoke.some(
      (s) =>
        s.feature === 'labs' &&
        s.range &&
        lessons.find(
          (l) =>
            l.lab === lab && s.url.startsWith(`/lessons/${l.id.toLowerCase()}`),
        ),
    )
  )
    errors.push(
      `lab “${lab}” is used by a lesson but no labs step in smoke.json drives it`,
    );

// 5. Every feature with something to drive appears in smoke.json, and smoke only names mapped features.
for (const f of files) {
  const name = f.replace(/\.md$/, '');
  if (name === 'labs' && usedLabs.size === 0) continue;
  if (!smoke.some((s) => s.feature === name))
    errors.push(`feature ${f} has no drive in smoke.json`);
}
for (const s of smoke)
  if (!files.includes(`${s.feature}.md`))
    errors.push(
      `smoke.json step ${s.feature}/${s.id} names an unmapped feature`,
    );

// 6. Every lesson chapter is listed in lessons.md, and nothing stale is listed.
const lessonsDoc = read(`${features}/lessons.md`);
const listed = [
  ...(lessonsDoc.split('Chapters currently published')[1] ?? '')
    .split('##')[0]
    .matchAll(/^- (.+)$/gm),
].map((m) => m[1].trim());
const clusters = [...new Set(lessons.map((l) => l.cluster))];
for (const c of clusters)
  if (!listed.includes(c))
    errors.push(`chapter “${c}” is not listed in ${features}/lessons.md`);
for (const c of listed)
  if (!clusters.includes(c))
    errors.push(
      `${features}/lessons.md lists chapter “${c}”, which has no lessons`,
    );

// 7. The verify skill documents every driver command, and the driver implements them.
const skillText = read(`${skill}/SKILL.md`);
const driver = read('scripts/control-probability.mjs');
const commands = [
  ...(/export const commands = \[([^\]]*)\]/.exec(driver)?.[1] ?? '').matchAll(
    /'([a-z-]+)'/g,
  ),
].map((m) => m[1]);
for (const c of commands) {
  if (c === 'help') continue;
  if (!skillText.includes(c))
    errors.push(`driver command “${c}” is not documented in ${skill}/SKILL.md`);
}
for (const section of [
  '## Launch',
  '## Doctor',
  '## Drive',
  '## Evidence',
  '## Cleanup',
  '## Helpers',
])
  if (!skillText.includes(section))
    errors.push(`${skill}/SKILL.md is missing “${section}”`);

// 8. Every math module has behaviour tests; every script check has its npm entry.
for (const f of readdirSync('src/math').filter(
  (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
))
  if (!existsSync(`src/math/${f.replace(/\.ts$/, '.test.ts')}`))
    errors.push(`src/math/${f} has no ${f.replace(/\.ts$/, '.test.ts')}`);
const pkg = JSON.parse(read('package.json'));
for (const f of readdirSync('scripts').filter(
  (f) => /^check-.*\.mjs$/.test(f) && !f.endsWith('.test.mjs'),
)) {
  const script = `node scripts/${f}`;
  if (!Object.values(pkg.scripts).some((s) => s.includes(script)))
    errors.push(`scripts/${f} is not wired into package.json`);
}

if (errors.length) {
  console.error(errors.map((e) => `drift: ${e}`).join('\n'));
  console.error(
    `\n${errors.length} drift error(s). Update the feature map, verify skill, smoke drives or tests in this PR.`,
  );
  process.exit(1);
}
console.log(
  `check:drift ok — ${files.length} features, ${smoke.length} drives, ${labIds.length} labs, ${clusters.length} chapters in sync`,
);
