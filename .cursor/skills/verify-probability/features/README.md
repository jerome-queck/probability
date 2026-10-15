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
fresh screenshot. Covered by `npm run test:agent-run` (`bigshot`, `freshshot`, `taskwait`,
`taskreplay`, `nonretriable`, `asstverdict`).

## Named results (content gate, not a site feature)

`src/content/results.json` registers the named results the lessons use (binomial theorem, Chebyshev's
inequality, strong law, ...): the exact names each goes by, and the lesson that proves it, or status
`quoted` (used without proof) or `background` (calculus tools the site assumes). `npm run
check:results` matches those names exactly (case-insensitive, whole words; a curly apostrophe equals a
straight one and an en dash a hyphen). It fails when a proved result's home lesson never uses its
names, or when a lesson names a quoted result without a marker such as "quoted without proof" in an
entry that names it. It does not search for names missing from the registry: adding a lesson that
proves or quotes a new result means adding its row here first.
