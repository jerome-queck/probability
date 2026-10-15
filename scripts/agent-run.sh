#!/usr/bin/env bash
# Run one review-workflow role as a headless Cursor CLI session and print its verdict.
#   scripts/agent-run.sh <role> <prompt-file> <out-prefix> [--resume <session-id>]
# Roles and tiers (grok-4.7 only; the tier is the effort):
#   verifier  grok-4.7-high   independent verifier using verify-probability
#   review    grok-4.7-high   one interrogate reviewer working alone (no Task subagents); a PR gets
#                             two such sessions, started one at a time (AGENTS.md merge gate 2)
#   math      grok-4.7-high   independent math check of lesson content
#   chore     grok-4.7-medium mechanical work (merges, baselines, bodies)
# Supervision is not done here. Box Ops owns it: start runs with /home/box/box-ops/longrun, which
# detaches, caps concurrent heavy runs, detects stalls, kills the whole tree and retries, using
#   LONGRUN_RESUME_CMD='bash scripts/agent-run.sh <role> <prompt> <out> --resume {session}'
# (see docs/root-cause/18.md for why the supervisor moved out of this script).
# This script: refuses any model outside grok-4.7-low/medium/high; streams the transcript to
# <out>.jsonl (appended, so a retry never erases an earlier attempt's verdict) and to stdout (so
# longrun sees activity and the session id); downscales screenshots over AGENT_IMAGE_MAX (default
# 2000) px while the session runs; then prints the session, every model seen and every verdict.
# Exits non-zero when there is no verdict, when a Task subagent started and never returned (a
# review in which a reviewer dropped is not a review), or when check-models.mjs finds a
# disallowed model.
set -euo pipefail
role=$1 prompt=$2 out=$3
resume=""
[ "${4:-}" = --resume ] && resume=${5:-}
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
touch "$out.jsonl" "$out.err"
# A NonRetriableError (e.g. an unreadable image) cannot be resumed: start a fresh session.
if [ -n "$resume" ] && grep -q NonRetriableError "$out.err"; then
  echo "agent-run: NonRetriableError earlier; starting a fresh session instead of --resume" >> "$out.err"
  resume=""
  : > "$out.err.prev" && cat "$out.err" >> "$out.err.prev" && : > "$out.err"
  set -- "$(cat "$prompt")

(A previous session for this task died with a non-retriable error, for example an unreadable or oversized image. Start the task again. Never read an image larger than 2000px on a side.)"
elif [ -n "$resume" ]; then
  set -- --resume "$resume" "The connection dropped. Continue the task from where you were and finish with the required final line."
else
  set -- "$(cat "$prompt")"
fi
[ -s "$out.jsonl" ] && [ -n "$(tail -c 1 "$out.jsonl")" ] && echo >> "$out.jsonl"
started=$(date +%s)
code=0
"$agent" -p --trust --force --model "$model" --output-format stream-json "$@" 2>> "$out.err" |
  tee -a "$out.jsonl" &
pipe=$!
# $! is the pipeline's last process (tee), which lives exactly as long as the session's output;
# watch for screenshots until then. $code is the pipeline's status, logged only.
python3 "$(dirname "$0")/shrink-images.py" --watch "$pipe" "$((started - 1))" "$PWD" ${AGENT_IMAGE_DIRS:-} \
  2>> "$out.err" &
watcher=$!
wait "$pipe" || code=$?
wait "$watcher" 2> /dev/null || true
# A last line with no newline: if it is complete JSON, keep it (end the line). If it is half-written
# (a killed session), fail closed when it carried a verdict or a model id, else cut it.
if [ -n "$(tail -c 1 "$out.jsonl" 2> /dev/null)" ] &&
  tail -n 1 "$out.jsonl" | node -e 'JSON.parse(require("fs").readFileSync(0, "utf8"))' 2> /dev/null; then
  echo >> "$out.jsonl"
  echo # the streamed copy on stdout lacks it too; the summary starts its own line
elif [ -n "$(tail -c 1 "$out.jsonl" 2> /dev/null)" ]; then
  echo
  if tail -n 1 "$out.jsonl" | grep -qE '(VERDICT|REVIEW|MATH):|"model(Name|Id|Slug)?\\*"[[:space:]]*:'; then
    echo "agent-run: a half-written last line carried a verdict or a model id; failing the run" >&2
    echo >> "$out.jsonl"
    exit 1
  fi
  # Harmless: cut it, so the transcript stays one JSON object per line for check-models.mjs.
  torn=$(tail -n 1 "$out.jsonl" | wc -c)
  truncate -s "-$torn" "$out.jsonl"
fi
echo "agent-run: session exited with status $code" >> "$out.err"
status=0
summary=$(node -e '
const lines = require("fs").readFileSync(process.argv[1], "utf8").split("\n").flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
const session = [...lines].reverse().find((l) => l.session_id)?.session_id;
const models = new Set();
const walk = (v, k) => {
  if (typeof v === "string") { if (/^model(name|id|slug)?$/i.test(k)) models.add(v); }
  else if (Array.isArray(v)) v.forEach((x) => walk(x, k));
  else if (v && typeof v === "object") for (const [kk, vv] of Object.entries(v)) if (!(/^model/i.test(kk) && vv && typeof vv === "object" && typeof vv.description === "string")) walk(vv, kk);
};
lines.forEach((l) => walk(l, ""));
// Verdicts from result events and assistant text. A verdict may be followed directly by the text
// of a later turn (no newline), so match the verdict words, not the whole line.
const texts = lines.flatMap((l) => l.type === "result" ? [l.result ?? ""] : l.type === "assistant" ? [(l.message?.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("")] : []);
const verdicts = texts.flatMap((t) => [...t.matchAll(/^(VERDICT|REVIEW|MATH): (NOT VERIFIED|VERIFIED|INCONCLUSIVE|CLEAN|CHANGES NEEDED)/gm)].map((m) => m[0])).filter((v, i, a) => v !== a[i - 1]);
// Task subagents (reviewers) that started and never completed.
const open = new Set();
for (const e of lines) if (e.type === "tool_call" && e.tool_call && "taskToolCall" in e.tool_call) { const id = e.call_id ?? JSON.stringify(e.tool_call); if (e.subtype === "started") open.add(id); else if (e.subtype === "completed") open.delete(id); }
const verdict = verdicts.join(" ") || "NO VERDICT";
console.log(`session=${session} models="${[...models].join(", ")}" ${verdict}${open.size ? ` INCOMPLETE: ${open.size} Task subagent call(s) never returned` : ""}`);
process.exit(verdicts.length && !open.size ? 0 : 1);
' "$out.jsonl") || status=$?
echo "$summary"
# Fail the run if any model other than grok-4.7 appears anywhere in the transcript (including subagents).
node "$(dirname "$0")/check-models.mjs" "$out.jsonl"
[ "$status" = 0 ] || exit 1
