#!/usr/bin/env bash
# Run one review-workflow role as a fresh headless Cursor CLI session.
#   scripts/agent-run.sh <role> <prompt-file> <out-prefix>
# Roles and tiers (grok-4.7 only; the tier is the effort):
#   verifier  grok-4.7-high   independent verifier using verify-probability
#   review    grok-4.7-high   interrogate lead (its Task reviewers run grok-4.7-high)
#   math      grok-4.7-high   independent math check of lesson content
#   chore     grok-4.7-medium mechanical work (merges, baselines, bodies)
# Writes <out-prefix>.jsonl (stream-json transcript) and prints the session id, model and verdict.
# A stalled or dropped session (no transcript growth for AGENT_STALL_SECS, or no result line) is
# resumed with --resume up to AGENT_RESUMES times; resumed parts are appended to the transcript.
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
stall=${AGENT_STALL_SECS:-900}   # no transcript growth for this long counts as a stall
tries=${AGENT_RESUMES:-3}        # resumes after a stall or a dropped connection
has_result() { grep -q '"type":"result"' "$1" 2> /dev/null; }
# Run one attempt in the background and kill it if its transcript stops growing.
attempt() {
  local part=$1
  shift
  "$agent" -p --trust --force --model "$model" --output-format stream-json "$@" \
    > "$part" 2>> "$out.err" &
  local pid=$! last=0 idle=0 size
  while kill -0 "$pid" 2> /dev/null; do
    sleep 30
    size=$(stat -c %s "$part" 2> /dev/null || echo 0)
    if [ "$size" = "$last" ]; then idle=$((idle + 30)); else idle=0 last=$size; fi
    if [ "$idle" -ge "$stall" ]; then
      echo "agent-run: no output for ${stall}s, killing $pid" >> "$out.err"
      kill "$pid" 2> /dev/null || true
    fi
  done
  wait "$pid" 2> /dev/null || true
  # A killed session can leave a half-written last line; drop it so the transcript stays JSONL.
  if [ -s "$part" ] && [ -n "$(tail -c 1 "$part")" ]; then
    echo "agent-run: dropped a truncated last line from $part" >> "$out.err"
    sed -i '$d' "$part"
  fi
}
: > "$out.err"
attempt "$out.jsonl" "$(cat "$prompt")"
session=$(grep -o '"session_id":"[^"]*"' "$out.jsonl" | head -1 | cut -d'"' -f4 || true)
n=0
while ! has_result "$out.jsonl" && [ -n "$session" ] && [ "$n" -lt "$tries" ]; do
  n=$((n + 1))
  echo "agent-run: no result yet, resume $n of $tries for session $session" >> "$out.err"
  attempt "$out.resume$n.jsonl" --resume "$session" \
    "The connection dropped. Continue the task from where you were and finish with the required final line."
  cat "$out.resume$n.jsonl" >> "$out.jsonl"
done
node -e '
const lines = require("fs").readFileSync(process.argv[1], "utf8").trim().split("\n").flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
const init = lines.find((l) => l.type === "system");
const result = lines.findLast((l) => l.type === "result");
const verdict = (result?.result ?? "").match(/(VERDICT|REVIEW|MATH): [A-Z ]+/g) ?? [];
console.log(`session=${init?.session_id} model="${init?.model}" ${verdict.join(" ")}`);
' "$out.jsonl"
# Fail the run if any model other than grok-4.7 appears anywhere in the transcript (including Task subagents).
node "$(dirname "$0")/check-models.mjs" "$out.jsonl"
