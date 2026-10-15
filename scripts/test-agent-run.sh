#!/usr/bin/env bash
# Exercise scripts/agent-run.sh against fake agents (never the real cursor-agent). Retries are
# longrun's job, so a "resume" here is a second call with --resume, the way longrun makes it.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
t=$(mktemp -d)
trap 'rm -rf "$t"' EXIT
echo prompt > "$t/p"
fails=0
fake() { # name, body (bash; "$resume" is 1 on a --resume call)
  printf '#!/usr/bin/env bash\nresume=0; [[ " $* " == *" --resume "* ]] && resume=1\n%s\n' "$2" > "$t/$1"
  chmod +x "$t/$1"
}
call() { # name [--resume id]: one agent-run call; prints its exit code
  local n=$1
  shift
  AGENT_BIN="$t/$n" bash "$here/agent-run.sh" verifier "$t/p" "$t/$n.out" "$@" > "$t/$n.stdout" 2> /dev/null
  echo $?
}
check() { # name, exit code, expected (0 or nonzero), pattern expected in the last stdout line
  local last
  last=$(tail -n 2 "$t/$1.stdout" | grep -E '^session=' || true)
  if { [ "$3" = 0 ] && [ "$2" -ne 0 ]; } || { [ "$3" != 0 ] && [ "$2" -eq 0 ]; } ||
    { [ -n "$4" ] && ! grep -qE "$4" <<< "$last"; }; then
    echo "FAIL $1 (exit $2): $last"; fails=$((fails + 1))
  else echo "ok   $1"; fi
}
init='echo "{\"type\":\"system\",\"session_id\":\"s1\",\"model\":\"Grok 4.7 256K High\"}"'
done_ok='echo "{\"type\":\"result\",\"result\":\"VERDICT: VERIFIED\",\"session_id\":\"s1\"}"'
fake normal "$init; $done_ok"
check normal "$(call normal)" 0 'VERDICT: VERIFIED'
fake never "$init; exit 1"
check never "$(call never)" 1 'NO VERDICT'
# A non-grok model anywhere in the transcript fails the run, even beside a verdict.
fake badmodel "$init; echo '{\"type\":\"assistant\",\"model\":\"claude-opus-4-5\"}'; $done_ok"
check badmodel "$(call badmodel)" 1 'VERIFIED'
# longrun's retry: the second call passes --resume to the agent and appends to the transcript.
fake resume "if [ \$resume = 1 ]; then $done_ok; else $init; echo dropped >&2; exit 1; fi"
c1=$(call resume)
c2=$(call resume --resume s1)
if [ "$c1" -ne 0 ] && [ "$(grep -c '"session_id"' "$t/resume.out.jsonl")" -ge 2 ]; then check resume "$c2" 0 'VERDICT: VERIFIED'; else echo "FAIL resume (first exit $c1)"; fails=$((fails + 1)); fi
# A verdict written before a drop survives the retry (the transcript is appended, never truncated).
fake asstverdict "if [ \$resume = 1 ]; then $done_ok; else $init; echo '{\"type\":\"assistant\",\"message\":{\"content\":[{\"type\":\"text\",\"text\":\"REVIEW: CHANGES NEEDED\"}]}}'; exit 1; fi"
call asstverdict > /dev/null
check asstverdict "$(call asstverdict --resume s1)" 0 'REVIEW: CHANGES NEEDED'
# After a NonRetriableError the next call is a fresh session, never --resume.
fake nonretriable "if [ \$resume = 1 ]; then exit 1; fi; if [ -e $t/nr.once ]; then $done_ok; else touch $t/nr.once; $init; echo 'NonRetriableError: Invalid Image' >&2; exit 1; fi"
call nonretriable > /dev/null
check nonretriable "$(call nonretriable --resume s1)" 0 'VERDICT: VERIFIED'
# Real miss (#19 verifier r2, #20 verifier r2): a later turn's text follows the verdict with no newline.
fake followup "$init; echo '{\"type\":\"result\",\"result\":\"Proof.\\n\\nVERDICT: VERIFIED\`npm run check\` finished successfully.\",\"session_id\":\"s1\"}'"
check followup "$(call followup)" 0 'VERDICT: VERIFIED'
# Real miss (#18 review r4, the #18 after-the-fact review): reviewers started as Task subagents
# never returned, and the lead still wrote a verdict. That run fails.
task_s='echo "{\"type\":\"tool_call\",\"subtype\":\"started\",\"call_id\":\"c1\",\"tool_call\":{\"taskToolCall\":{}}}"'
task_c='echo "{\"type\":\"tool_call\",\"subtype\":\"completed\",\"call_id\":\"c1\",\"tool_call\":{\"taskToolCall\":{}}}"'
fake taskdrop "$init; $task_s; $task_s; echo '{\"type\":\"result\",\"result\":\"REVIEW: CLEAN\",\"session_id\":\"s1\"}'"
check taskdrop "$(call taskdrop)" 1 'INCOMPLETE: 1 Task'
fake taskdone "$init; $task_s; $task_c; echo '{\"type\":\"result\",\"result\":\"REVIEW: CLEAN\",\"session_id\":\"s1\"}'"
check taskdone "$(call taskdone)" 0 'REVIEW: CLEAN'
# A half-written last line that carried a verdict or a model id fails closed.
fake tornverdict "$init; printf '{\"type\":\"result\",\"result\":\"REVIEW: CHANGES NEEDED'; exit 1"
check tornverdict "$(call tornverdict)" 1 ''
fake tornmodel "$init; printf '{\"type\":\"assistant\",\"model\":\"claude-op'; exit 1"
check tornmodel "$(call tornmodel)" 1 ''
fake tornescmodel "$init; printf '{\"type\":\"tool_call\",\"args\":\"{\\\\\"model\\\\\":\\\\\"claude-op'; exit 1"
check tornescmodel "$(call tornescmodel)" 1 ''
# A complete last line with no newline is kept, not cut (PR #23 verifier r1, 78a1ac7f).
fake nlverdict "$init; printf '{\"type\":\"result\",\"result\":\"VERDICT: VERIFIED\",\"session_id\":\"s1\"}'"
check nlverdict "$(call nlverdict)" 0 'VERDICT: VERIFIED'
fake nlmodel "$init; $done_ok; printf '{\"type\":\"assistant\",\"model\":\"claude-opus-4-5\"}'"
check nlmodel "$(call nlmodel)" 1 'claude-opus-4-5'
fake nlresume "if [ \$resume = 1 ]; then $done_ok; else $init; printf '{\"type\":\"result\",\"result\":\"REVIEW: CHANGES NEEDED\",\"session_id\":\"s1\"}'; fi"
call nlresume > /dev/null
check nlresume "$(call nlresume --resume s1)" 0 'REVIEW: CHANGES NEEDED'
# ...but a torn line without either is dropped and the retry finishes.
fake tornid "if [ \$resume = 1 ]; then $done_ok; else $init; printf '{\"type\":\"assistant\",\"text\":\"hi\",\"model_call_id\":\"abc'; exit 1; fi"
call tornid > /dev/null
check tornid "$(call tornid --resume s1)" 0 'VERDICT: VERIFIED'
# Screenshots over 2000px written during the session are downscaled (receipt agent-run-stability-2026-10-15).
if python3 -c 'import PIL' 2> /dev/null; then
  mkdir -p "$t/wt/artifacts"
  fake bigshot "$init; python3 -c 'from PIL import Image; Image.new(\"RGB\", (3000, 40)).save(\"artifacts/big.png\")'; sleep 2; $done_ok"
  c=$(cd "$t/wt" && AGENT_IMAGE_SETTLE=0.5 call bigshot)
  check bigshot "$c" 0 'VERDICT: VERIFIED'
  w=$(python3 -c "from PIL import Image; print(max(Image.open('$t/wt/artifacts/big.png').size))")
  if [ "$w" -le 2000 ]; then echo "ok   bigshot-size"; else echo "FAIL bigshot-size ($w px)"; fails=$((fails + 1)); fi
  # A fresh screenshot is not rewritten before a reader (smoke's compare) can use it.
  fake freshshot "$init; python3 -c 'from PIL import Image; Image.new(\"RGB\", (3000, 40)).save(\"artifacts/fresh.png\")'; sleep 2; python3 -c 'from PIL import Image; print(max(Image.open(\"artifacts/fresh.png\").size))' > $t/fresh.size; $done_ok"
  c=$(cd "$t/wt" && AGENT_IMAGE_SETTLE=5 call freshshot)
  check freshshot "$c" 0 'VERDICT: VERIFIED'
  if [ "$(cat "$t/fresh.size" 2> /dev/null)" = 3000 ]; then echo "ok   freshshot-size"; else echo "FAIL freshshot-size ($(cat "$t/fresh.size" 2> /dev/null))"; fails=$((fails + 1)); fi
  # A process that merely mentions the driver in its arguments does not block the shrink.
  python3 -c 'from PIL import Image; Image.new("RGB", (3000, 40)).save("'"$t"'/wt/artifacts/settled.png")'
  touch -d '-1 minute' "$t/wt/artifacts/settled.png"
  (cd "$t/wt" && exec -a "mention-control-probability" sleep 30) &
  m=$!
  (cd "$t/wt" && bash -c 'sleep 30 # control-probability') &
  m2=$!
  sleep 0.5
  (cd "$t/wt" && AGENT_IMAGE_SETTLE=0 python3 "$here/shrink-images.py" --once 0 "$t/wt")
  kill $m $m2 2> /dev/null
  w=$(python3 -c "from PIL import Image; print(max(Image.open('$t/wt/artifacts/settled.png').size))")
  if [ "$w" -le 2000 ]; then echo "ok   mention"; else echo "FAIL mention ($w px)"; fails=$((fails + 1)); fi
else
  echo "skip bigshot (Pillow not installed)"
fi
exit $fails
