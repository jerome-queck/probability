#!/usr/bin/env bash
# Exercise scripts/agent-run.sh against fake agents (never the real cursor-agent).
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
run() { # name, expected exit (0 or nonzero), grep pattern expected on stdout
  AGENT_MAX_LOAD=1000 AGENT_MAX_RUNS=1000 AGENT_BIN="$t/$1" AGENT_STALL_SECS=3 AGENT_POLL_SECS=1 AGENT_RESUMES=2 \
    bash "$here/agent-run.sh" verifier "$t/p" "$t/$1.out" > "$t/$1.stdout" 2> /dev/null
  local code=$?
  if { [ "$2" = 0 ] && [ $code -ne 0 ]; } || { [ "$2" != 0 ] && [ $code -eq 0 ]; } ||
    { [ -n "$3" ] && ! grep -qE "$3" "$t/$1.stdout"; }; then
    echo "FAIL $1 (exit $code): $(cat "$t/$1.stdout")"; fails=$((fails + 1))
  else echo "ok   $1"; fi
}
init='echo "{\"type\":\"system\",\"session_id\":\"s1\",\"model\":\"Grok 4.7 256K High\"}"'
done_ok='echo "{\"type\":\"result\",\"result\":\"VERDICT: VERIFIED\",\"session_id\":\"s1\"}"'
fake normal "$init; $done_ok"
run normal 0 'VERDICT: VERIFIED'
fake stall "if [ \$resume = 1 ]; then $done_ok; else $init; sleep 60; fi"
run stall 0 'VERDICT: VERIFIED'
fake drop "if [ \$resume = 1 ]; then $done_ok; else $init; echo stalled >&2; exit 1; fi"
run drop 0 'VERDICT: VERIFIED'
fake never "$init; exit 1"
run never 1 'NO VERDICT'
fake badresume "if [ \$resume = 1 ]; then echo '{\"type\":\"assistant\",\"model\":\"claude-opus-4-5\"}'; $done_ok; else $init; exit 1; fi"
run badresume 1 'VERIFIED'
fake nonewline "$init; printf '{\"type\":\"result\",\"result\":\"VERDICT: NOT VERIFIED\",\"model\":\"claude-opus-4-5\"}'"
run nonewline 1 'NOT VERIFIED'
fake earlyverdict "if [ \$resume = 1 ]; then $done_ok; else $init; echo '{\"type\":\"result\",\"result\":\"VERDICT: NOT VERIFIED\"}'; fi"
run earlyverdict 0 'NOT VERIFIED'
fake halfline "if [ \$resume = 1 ]; then $done_ok; else $init; printf '{\"type\":\"assis'; exit 1; fi"
run halfline 0 'VERDICT: VERIFIED'
fake orphan "$init; (sleep 301; echo late) & echo \$! > $t/orphan.pid; setsid sleep 302 & echo \$! > $t/session.pid; sleep 60"
run orphan 1 'NO VERDICT'
for f in orphan session; do
  p=$(cat "$t/$f.pid" 2> /dev/null) || continue
  if kill -0 "$p" 2> /dev/null; then echo "FAIL $f child $p survived"; fails=$((fails + 1)); kill -KILL "$p"; fi
done
fake tornverdict "if [ \$resume = 1 ]; then $done_ok; else $init; printf '{\"type\":\"result\",\"result\":\"REVIEW: CHANGES NEEDED'; exit 1; fi"
run tornverdict 1 ''
fake droporphan "if [ \$resume = 1 ]; then $done_ok; else $init; setsid sleep 303 & echo \$! > $t/drop.pid; sleep 2; exit 1; fi"
run droporphan 0 'VERDICT: VERIFIED'
p=$(cat "$t/drop.pid" 2> /dev/null) && if kill -0 "$p" 2> /dev/null; then echo "FAIL droporphan child $p survived"; fails=$((fails + 1)); kill -KILL "$p"; fi
fake proseverdict "if [ \$resume = 1 ]; then $done_ok; else $init; printf '{\"type\":\"assistant\",\"text\":\"The VERDICT: comes later'; exit 1; fi"
run proseverdict 1 '' # fail closed: any verdict token in a torn line stops the run
fake churn "if [ \$resume = 1 ]; then $done_ok; else $init; setsid sleep 304 & echo \$! > $t/churn.pid; for i in \$(seq 60); do sleep 0.05; echo '{\"type\":\"tick\"}'; done; exit 1; fi"
run churn 0 'VERDICT: VERIFIED'
p=$(cat "$t/churn.pid" 2> /dev/null) && if kill -0 "$p" 2> /dev/null; then echo "FAIL churn child $p survived"; fails=$((fails + 1)); kill -KILL "$p"; fi
fake tornid "if [ \$resume = 1 ]; then $done_ok; else $init; printf '{\"type\":\"assistant\",\"text\":\"hi\",\"model_call_id\":\"abc'; exit 1; fi"
run tornid 0 'VERDICT: VERIFIED'
fake tornmodel "if [ \$resume = 1 ]; then $done_ok; else $init; printf '{\"type\":\"assistant\",\"model\":\"claude-op'; exit 1; fi"
run tornmodel 1 ''
# Gate closed (load limit 0): exits 3 after the max wait without starting the agent.
AGENT_MAX_LOAD=0 AGENT_GATE_POLL=1 AGENT_GATE_MAX_WAIT=2 AGENT_BIN="$t/normal" \
  bash "$here/agent-run.sh" verifier "$t/p" "$t/gate.out" > /dev/null 2>&1
code=$?
if [ $code -eq 3 ] && [ ! -s "$t/gate.out.jsonl" ]; then echo "ok   gate"; else echo "FAIL gate (exit $code)"; fails=$((fails + 1)); fi
# Receipt agent-run-stability-2026-10-15: each of these fails on 9252f57 and passes after the fix.
# A lead silent while a Task subagent call is open is not a stall (resume would fail here).
task_s='echo "{\"type\":\"tool_call\",\"subtype\":\"started\",\"call_id\":\"c1\",\"tool_call\":{\"taskToolCall\":{}}}"'
task_c='echo "{\"type\":\"tool_call\",\"subtype\":\"completed\",\"call_id\":\"c1\",\"tool_call\":{\"taskToolCall\":{}}}"'
fake taskwait "if [ \$resume = 1 ]; then exit 1; fi; $init; $task_s; sleep 6; $task_c; $done_ok"
run taskwait 0 'VERDICT: VERIFIED'
# After a NonRetriableError the next attempt is a fresh session, never --resume.
fake nonretriable "if [ \$resume = 1 ]; then exit 1; fi; if [ -e $t/nr.once ]; then $done_ok; else touch $t/nr.once; $init; echo 'NonRetriableError: Invalid Image' >&2; exit 1; fi"
run nonretriable 0 'VERDICT: VERIFIED'
# A screenshot over 2000px written during the attempt is downscaled before the run ends.
if python3 -c 'import PIL' 2> /dev/null; then
  mkdir -p "$t/wt/artifacts"
  fake bigshot "$init; python3 -c 'from PIL import Image; Image.new(\"RGB\", (3000, 40)).save(\"artifacts/big.png\")'; sleep 2; $done_ok"
  (cd "$t/wt" && run bigshot 0 'VERDICT: VERIFIED')
  w=$(python3 -c "from PIL import Image; print(max(Image.open('$t/wt/artifacts/big.png').size))")
  if [ "$w" -le 2000 ]; then echo "ok   bigshot-size"; else echo "FAIL bigshot-size ($w px)"; fails=$((fails + 1)); fi
else
  echo "skip bigshot (Pillow not installed)"
fi
# A torn line with an escaped model key (tool args) or a spaced result verdict also fails closed.
fake tornescmodel "if [ \$resume = 1 ]; then $done_ok; else $init; printf '{\"type\":\"tool_call\",\"args\":\"{\\\\\"model\\\\\":\\\\\"claude-op'; exit 1; fi"
run tornescmodel 1 ''
fake tornspaceverdict "if [ \$resume = 1 ]; then $done_ok; else $init; printf '{\"type\":\"result\",\"result\": \"VERDICT: NOT VERIFIED'; exit 1; fi"
run tornspaceverdict 1 ''
exit $fails
