#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { commands, viewports } from './control-probability.mjs';
import { checkMap } from './probability.mjs';
import { selectSmokeStates } from './smoke-selection.mjs';

const skill = '.cursor/skills/verify-probability';
const features = `${skill}/features`;
const read = (path) => readFileSync(path, 'utf8');
const json = (path) => JSON.parse(read(path));
const map = json('verification/features.json');
const smoke = json(`${features}/smoke.json`);
const paths = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' },
)
  .split('\0')
  .filter(Boolean);
const errors = checkMap(map, smoke, paths.filter(existsSync));
try {
  selectSmokeStates(smoke, undefined, Object.keys(viewports));
} catch (error) {
  errors.push(error.message);
}
const indexed = [
  ...read(`${features}/README.md`).matchAll(/\]\(([a-z-]+\.md)\)/g),
].map((match) => match[1]);
const files = readdirSync(features).filter(
  (file) => file.endsWith('.md') && file !== 'README.md',
);
if (new Set(indexed).size !== indexed.length)
  errors.push('Feature README has duplicate entries.');
for (const feature of map.features) {
  const file = `${feature.id}.md`;
  if (!files.includes(file)) {
    errors.push(`Missing feature description ${features}/${file}`);
    continue;
  }
  if (!indexed.includes(file))
    errors.push(`${file} is missing from the feature index.`);
  const text = read(`${features}/${file}`);
  for (const heading of [
    '## Sub-features',
    '## How to get to it (user POV)',
    '## Driving it with control-probability',
    '## Visual states',
    '## Gotchas',
  ])
    if (!text.includes(heading)) errors.push(`${file} needs ${heading}.`);
  const listed = [
    ...(text.split('## Visual states')[1]?.split('\n## ')[0] ?? '').matchAll(
      /^- `([a-z0-9-]+)`/gm,
    ),
  ].map((match) => match[1]);
  const states = smoke.filter((state) => state.feature === feature.id);
  if (new Set(listed).size !== listed.length)
    errors.push(`${file} lists duplicate visual states.`);
  for (const id of listed)
    if (!states.some((state) => state.id === id))
      errors.push(`${feature.id}/${id} is documented but not driven.`);
  for (const state of states) {
    if (!listed.includes(state.id))
      errors.push(`${feature.id}/${state.id} is driven but not documented.`);
    for (const viewport of state.viewports ?? Object.keys(viewports)) {
      const path = `${skill}/baselines/${feature.id}/${state.id}.${viewport}.png`;
      if (!existsSync(path))
        errors.push(
          `Missing visual baseline ${path}; capture, inspect and consciously accept it.`,
        );
    }
  }
}
for (const file of [...new Set([...files, ...indexed])])
  if (!map.features.some(({ id }) => file === `${id}.md`))
    errors.push(`Unmapped feature description ${file}.`);
const baselineRoot = `${skill}/baselines`;
for (const feature of readdirSync(baselineRoot))
  for (const file of readdirSync(`${baselineRoot}/${feature}`)) {
    const [id, viewport] = file.replace(/\.png$/, '').split('.');
    const state = smoke.find(
      (item) => item.feature === feature && item.id === id,
    );
    if (
      !state ||
      !(state.viewports ?? Object.keys(viewports)).includes(viewport)
    )
      errors.push(`Stale baseline ${feature}/${file}.`);
  }
const lessons = readdirSync('src/content')
  .filter((file) => /^part\d+\.json$/.test(file))
  .flatMap((file) => json(`src/content/${file}`));
const labType =
  /export type LabId\s*=([\s\S]*?);/.exec(read('src/content/types.ts'))?.[1] ??
  '';
const labIds = [...labType.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
const labsDoc = read(`${features}/labs.md`);
for (const id of labIds)
  if (!labsDoc.includes(`\`${id}\``))
    errors.push(`Lab ${id} has no feature description.`);
for (const lab of new Set(lessons.map((lesson) => lesson.lab).filter(Boolean)))
  for (const suffix of ['default', 'moved']) {
    const state = smoke.find(
      (item) => item.feature === 'labs' && item.id === `${lab}-${suffix}`,
    );
    const id = /^\/lessons\/([a-z]\d+)/
      .exec(state?.url ?? '')?.[1]
      .toUpperCase();
    if (
      !state ||
      !lessons.some((lesson) => lesson.id === id && lesson.lab === lab)
    )
      errors.push(
        `Lab ${lab} needs a ${suffix} drive on a lesson that contains it.`,
      );
    if (state?.captureSelector !== '#lab')
      errors.push(`Lab ${lab}-${suffix} must capture the experiment.`);
  }
const chapterSection =
  read(`${features}/lessons.md`)
    .split('Chapters currently published')[1]
    ?.split('\n## ')[0] ?? '';
const chapters = [...new Set(lessons.map((lesson) => lesson.cluster))];
const listedChapters = [...chapterSection.matchAll(/^- (.+)$/gm)].map((match) =>
  match[1].trim(),
);
for (const chapter of new Set([...chapters, ...listedChapters]))
  if (!chapters.includes(chapter) || !listedChapters.includes(chapter))
    errors.push(`Lesson chapter list differs at ${chapter}.`);
for (const path of [`${skill}/SKILL.md`, '.agents/skills/verify/SKILL.md']) {
  const text = read(path);
  for (const section of [
    'Launch',
    'Doctor',
    'Drive',
    'Evidence',
    'Cleanup',
    'Helpers',
  ])
    if (!text.includes(`## ${section}`))
      errors.push(`${path} needs ## ${section}.`);
}
const compatibility = read(`${skill}/SKILL.md`);
for (const command of commands.filter((command) => command !== 'help'))
  if (!compatibility.includes(command))
    errors.push(`Cursor compatibility skill does not document ${command}.`);
const pkg = json('package.json');
for (const file of readdirSync('scripts').filter(
  (file) => /^check-.*\.mjs$/.test(file) && !file.endsWith('.test.mjs'),
))
  if (
    !Object.values(pkg.scripts).some((script) =>
      script.includes(`node scripts/${file}`),
    )
  )
    errors.push(`scripts/${file} is not wired into package.json.`);
if (errors.length) {
  console.error(errors.map((error) => `drift: ${error}`).join('\n'));
  process.exitCode = 1;
} else
  console.log(
    `check:drift ok — ${map.features.length} owned features, ${smoke.length} driven visual states, ${labIds.length} labs, ${chapters.length} chapters`,
  );
