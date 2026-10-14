#!/usr/bin/env bash
# Run one review-workflow role as a fresh headless Cursor CLI session, resuming that same session
# if the connection drops or it stalls.
#   scripts/agent-run.sh <role> <prompt-file> <out-prefix>
# Roles and tiers (grok-4.7 only; the tier is the effort):
#   verifier  grok-4.7-high   independent verifier using verify-probability
#   review    grok-4.7-high   interrogate lead (its Task reviewers run grok-4.7-high)
#   math      grok-4.7-high   independent math check of lesson content
#   chore     grok-4.7-medium mechanical work (merges, baselines, bodies)
# Writes <out-prefix>.jsonl (stream-json transcript) and prints the session id, every model seen,
# and every verdict line from every attempt in order (a resume never hides an earlier verdict).
# Stall: no transcript write for AGENT_STALL_SECS (default 900) kills the attempt's whole process
# group. A run with no result event is resumed with --resume up to AGENT_RESUMES (default 3) times.
# Exits non-zero if no attempt produced a result, or if check-models.mjs finds a disallowed model.
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
stall=${AGENT_STALL_SECS:-900}
tries=${AGENT_RESUMES:-3}
poll=${AGENT_POLL_SECS:-15}
pid=""
# All descendants of a pid, found through /proc, so children that start their own session
# (the CLI runs shell tools detached) are stopped too.
descendants() {
  local kids k
  kids=$(grep -l "^PPid:[[:space:]]*$1\$" /proc/[0-9]*/status 2> /dev/null | cut -d/ -f3 || true)
  for k in $kids; do echo "$k"; descendants "$k"; done
}
# Stop an attempt and everything it started: TERM, wait up to 10s, then KILL.
stop() {
  [ -n "$pid" ] || return 0
  local all p
  all="$pid $(descendants "$pid" | tr '\n' ' ')"
  for p in $all; do kill -TERM "$p" 2> /dev/null || true; done
  kill -TERM -- "-$pid" 2> /dev/null || true
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    local alive=0
    for p in $all; do kill -0 "$p" 2> /dev/null && alive=1; done
    [ "$alive" = 1 ] || return 0
    sleep 1
  done
  for p in $all; do kill -KILL "$p" 2> /dev/null || true; done
}
trap 'stop; exit 130' INT TERM
trap stop EXIT
has_result() { node -e '
const ok = require("fs").readFileSync(process.argv[1], "utf8").split("\n").some((l) => {
  try { return JSON.parse(l).type === "result"; } catch { return false; } });
process.exit(ok ? 0 : 1);' "$1"; }
attempt() {
  local part=$1
  shift
  : > "$part"
  setsid "$agent" -p --trust --force --model "$model" --output-format stream-json "$@" \
    > "$part" 2>> "$out.err" &
  pid=$!
  local started now mtime
  started=$(date +%s)
  while kill -0 "$pid" 2> /dev/null; do
    sleep "$poll"
    now=$(date +%s)
    mtime=$(stat -c %Y "$part" 2> /dev/null || echo "$started")
    [ "$mtime" -gt "$started" ] || mtime=$started
    if [ $((now - mtime)) -ge "$stall" ]; then
      echo "agent-run: no transcript write for ${stall}s, stopping attempt $pid" >> "$out.err"
      stop
    fi
  done
  local code=0
  wait "$pid" 2> /dev/null || code=$?
  stop
  pid=""
  echo "agent-run: attempt exited with status $code" >> "$out.err"
  # Only a last line that is not valid JSON counts as half-written; anything parseable is kept.
  if [ -s "$part" ] && [ -n "$(tail -c 1 "$part")" ]; then
    if tail -n 1 "$part" | node -e 'JSON.parse(require("fs").readFileSync(0, "utf8"))' 2> /dev/null; then
      echo >> "$part"
    else
      echo "agent-run: dropped a half-written last line from $part:" >> "$out.err"
      tail -n 1 "$part" >> "$out.err"
      echo >> "$out.err"
      if tail -n 1 "$part" | grep -qE '(VERDICT|REVIEW|MATH): |"model' ; then
        echo "agent-run: the dropped line carried a verdict or a model id; failing the run" >&2
        exit 1
      fi
      sed -i '$d' "$part"
    fi
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
const lines = require("fs").readFileSync(process.argv[1], "utf8").split("\n").flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
const session = lines.find((l) => l.session_id)?.session_id;
const models = new Set();
const walk = (v, k) => {
  if (typeof v === "string") { if (/^model(name|id|slug)?$/i.test(k)) models.add(v); }
  else if (Array.isArray(v)) v.forEach((x) => walk(x, k));
  else if (v && typeof v === "object") for (const [kk, vv] of Object.entries(v)) if (!(/^model/i.test(kk) && vv && typeof vv === "object" && typeof vv.description === "string")) walk(vv, kk);
};
lines.forEach((l) => walk(l, ""));
const verdicts = lines.filter((l) => l.type === "result").flatMap((l) => (l.result ?? "").match(/^(VERDICT|REVIEW|MATH): [A-Z ]+$/gm) ?? []);
console.log(`session=${session} models="${[...models].join(", ")}" ${verdicts.join(" ") || "NO VERDICT"}`);
' "$out.jsonl"
# Fail the run if any model other than grok-4.7 appears anywhere in the transcript (including Task subagents).
node "$(dirname "$0")/check-models.mjs" "$out.jsonl"
has_result "$out.jsonl" || { echo "agent-run: no result after $n resume(s)" >&2; exit 1; }
