# pstack per-role model choices (written by setup-pstack; overrides skill defaults)
# pstack model configuration. One line per role. Delete a line to fall back to the skill default.
# `inherit-parent` or `auto` as a value: the role runs on the parent chat model (omit Task `model`). Alias entries in a panel list still count toward its fan-out.
# Grok Build runs a role as: grok -m grok-4.7 --effort <effort>. grok-4.7 is the only model.
# budget: per-role (deliberate effort per role; Jerome 2026-10-13). Independent verifiers and math-correctness reviews run as interrogate reviewers (xhigh).
feature, refactoring: grok-4.7 (effort high)
bug-fix: grok-4.7 (effort high)
perf-issue: grok-4.7 (effort high)
hillclimb: grok-4.7 (effort medium)
judgment and prose: grok-4.7 (effort high)
hardest tasks: grok-4.7 (effort xhigh)
how explorer: grok-4.7 (effort medium)
how explainer: grok-4.7 (effort high)
why investigators: grok-4.7 (effort high)
why synthesizer: grok-4.7 (effort xhigh)
reflect tooling: grok-4.7 (effort low)
reflect judgment, divergent, synthesizer: grok-4.7 (effort high)
arena runners: grok-4.7 (effort xhigh), grok-4.7 (effort xhigh)
arena cross-judge pool: grok-4.7 (effort xhigh)
swarm workers: grok-4.7 (effort medium)
architect runners: grok-4.7 (effort xhigh), grok-4.7 (effort xhigh)
interrogate reviewers: grok-4.7 (effort xhigh), grok-4.7 (effort xhigh)
