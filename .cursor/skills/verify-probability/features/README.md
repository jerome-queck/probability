# Feature map — probability site

Baseline: a fresh `npm run build` and `control-probability launch` with an empty data dir. No
accounts, no seed data. Drive through the accessible UI; prove each journey by the route, heading
and visible text it ends on. Drift is fixed here; product bugs are reported, never written around.
`npm run check:drift` fails when this index, the feature files, `smoke.json`, the routes, the labs
or the lesson chapters disagree.

| Feature | File |
|---|---|
| Home (learn view) | [home.md](home.md) |
| Lesson pages | [lessons.md](lessons.md) |
| Interactive labs | [labs.md](labs.md) |
| Practice view | [practice.md](practice.md) |
| Reference view | [reference.md](reference.md) |
| Routing and navigation | [routing.md](routing.md) |
| Study progress and self-check | [progress.md](progress.md) |

## Review tooling (not a site feature)

Verifier, review and math sessions run through `scripts/agent-run.sh` (see AGENTS.md). For anyone
driving this map from such a session: screenshots over 2000px per side that appear in the worktree
during a run are downscaled in place by `scripts/shrink-images.py` once they have been unchanged for
10s and no smoke run is active in that tree (baselines are never touched), so wait before reading a
fresh screenshot. End the session with the verdict line at the start of a line; a run whose Task
subagent call never returns fails as `INCOMPLETE`, so reviewers run as their own sessions, not as
subagents. Covered by `npm run test:agent-run` (`bigshot`, `freshshot`, `followup`, `taskdrop`,
`nonretriable`, `asstverdict`).

## Named results (content gate, not a site feature)

Each lesson lists in `results` the ids of the named results it names or states (binomial theorem,
Chebyshev's inequality, strong law, ...); the field is not rendered. `src/content/results.json`
registers each id with its name and status: proved in the lesson named by `in`, `quoted` (used
without proof, introduced in `in`), or `background` (calculus tools the site assumes). `npm run
check:results` reads only the tags, never the prose: it fails on a tag that is not registered, a
registered result no lesson tags, and a proved or quoted result its home lesson does not tag.
Adding a lesson: tag every named result it uses, and add a row here for any new one; the math
review confirms nothing named was left untagged.
