#!/usr/bin/env node
// Fail if a cursor-agent stream-json transcript used any model that is not grok-4.7.
//   node scripts/check-models.mjs <transcript.jsonl>...
// Checks every "model" field: tier slugs must be grok-4.7-*, display names must be "Grok 4.7 ...".
import { readFileSync } from "node:fs";

const allowed = (m) =>
  /^grok-4\.7(-[a-z]+)?$/.test(m) || /^Grok 4\.7\b/.test(m);
let bad = 0;
for (const file of process.argv.slice(2)) {
  const seen = new Set();
  for (const line of readFileSync(file, "utf8").split("\n")) {
    for (const m of line.matchAll(/"model"\s*:\s*"((?:[^"\\]|\\.)*)"/g))
      seen.add(m[1]);
  }
  const offenders = [...seen].filter((m) => !allowed(m));
  if (offenders.length) {
    bad++;
    console.error(`${file}: non-grok model used: ${offenders.join(", ")}`);
  } else
    console.log(
      `${file}: models ok (${[...seen].join(", ") || "none recorded"})`,
    );
}
process.exit(bad ? 1 : 0);
