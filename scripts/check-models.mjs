#!/usr/bin/env node
// Fail if a cursor-agent stream-json transcript used any model other than grok-4.7 at or below high.
//   node scripts/check-models.mjs <transcript.jsonl>...
// Every JSON line is parsed and every string under a model key (model, modelName, modelId, modelSlug) is checked.
// The run must record at least one model, and every line must also be free of other model families.
import { readFileSync } from 'node:fs';

const modelKey = /^model(name|id|slug)?$/i;
const slug = /^grok-4\.7-(low|medium|high)$/;
const display = /^Grok 4\.7( \d+K)?( (Low|Medium|High))?$/;
const families =
  /claude|opus|sonnet|haiku|gpt|o\d-|gemini|composer|cursor-small|grok-(?!4\.7-(low|medium|high)\b)\d/i;

function collect(value, key, out) {
  if (typeof value === 'string') {
    if (modelKey.test(key)) out.push(value);
    // Arguments are sometimes JSON inside a string.
    if (/^\s*[{[]/.test(value))
      try {
        collect(JSON.parse(value), key, out);
      } catch {}
  } else if (Array.isArray(value)) for (const v of value) collect(v, key, out);
  else if (value && typeof value === 'object') {
    // A tool schema that describes a model parameter is not a model choice.
    if (modelKey.test(key) && ('description' in value || 'type' in value))
      return;
    for (const [k, v] of Object.entries(value))
      collect(v, modelKey.test(key) ? key : k, out);
  }
}

let bad = 0;
for (const file of process.argv.slice(2)) {
  const models = new Set();
  const problems = [];
  for (const [n, line] of readFileSync(file, 'utf8').split('\n').entries()) {
    if (!line.trim()) continue;
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      problems.push(`line ${n + 1} is not JSON`);
      continue;
    }
    const found = [];
    collect(parsed, '', found);
    for (const m of found) models.add(m);
    // Catch model ids in any field, including escaped or stringified ones.
    for (const m of found)
      if (families.test(m)) problems.push(`line ${n + 1}: ${m}`);
  }
  for (const m of models)
    if (m !== 'inherit' && !slug.test(m) && !display.test(m))
      problems.push(`model not allowed: ${m}`);
  if (!models.size) problems.push('no model recorded');
  if (problems.length) {
    bad++;
    console.error(
      `${file}: non-grok or over-ceiling model use:\n  ${[...new Set(problems)].join('\n  ')}`,
    );
  } else console.log(`${file}: models ok (${[...models].join(', ')})`);
}
process.exit(bad ? 1 : 0);
