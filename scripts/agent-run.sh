#!/usr/bin/env bash
# Run one review-workflow role as a fresh headless Cursor CLI session.
#   scripts/agent-run.sh <role> <prompt-file> <out-prefix>
# Roles and tiers (grok-4.7 only; the tier is the effort):
#   verifier  grok-4.7-high   independent verifier using verify-probability
#   review    grok-4.7-high   interrogate lead (its Task reviewers run grok-4.7-high)
#   math      grok-4.7-high   independent math check of lesson content
#   chore     grok-4.7-medium mechanical work (merges, baselines, bodies)
# Writes <out-prefix>.jsonl (stream-json transcript) and prints the session id, model and verdict.
# Run it in its own git worktree: a session must never share a working tree with other work.
set -euo pipefail
role=$1 prompt=$2 out=$3
case $role in
  verifier | review | math) model=grok-4.7-high ;; # high is the ceiling
  chore) model=grok-4.7-medium ;;
  *) echo "unknown role $role" >&2; exit 2 ;;
esac
case $model in
  grok-4.7-low | grok-4.7-medium | grok-4.7-high) ;;
  *) echo "refusing model outside grok-4.7-low/medium/high: $model" >&2; exit 2 ;;
esac
agent=${AGENT_BIN:-cursor-agent}
"$agent" -p --trust --force --model "$model" --output-format stream-json "$(cat "$prompt")" \
  > "$out.jsonl" 2> "$out.err"
node -e '
const lines = require("fs").readFileSync(process.argv[1], "utf8").trim().split("\n").map((l) => JSON.parse(l));
const init = lines.find((l) => l.type === "system");
const result = lines.findLast((l) => l.type === "result");
const verdict = (result?.result ?? "").match(/(VERDICT|REVIEW|MATH): [A-Z ]+/g) ?? [];
console.log(`session=${init?.session_id} model="${init?.model}" ${verdict.join(" ")}`);
' "$out.jsonl"
# Fail the run if any model other than grok-4.7 appears anywhere in the transcript (including Task subagents).
node "$(dirname "$0")/check-models.mjs" "$out.jsonl"
