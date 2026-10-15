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
inequality, strong law, ...) with the lesson that proves it, or status `quoted` (used without proof) or
`background` (calculus tools the site assumes). `npm run check:results` scans every lesson string for
two kinds of title: a capitalised name before a title word ("Wald's equation", "Binomial theorem",
"Berry–Esseen bound"), and lowercase titles ("the central limit theorem", "the cdf criterion", "the
multiplication principle", "the strong law", "the law of total probability", inclusion–exclusion),
also as a heading or sentence start without "the" ("Central limit theorem.").
After "the", only "theorem", "criterion" and "principle" count as titles, so a result called
"the … formula" or "the … rule" is not found and must be registered by hand, as must a result stated
without a title (MGF uniqueness). The check fails when a scanned title is not registered, or when a
quoted result is named without a marker such as "quoted without proof" in that entry. Deleting any
scanned row fails the tests. Adding a lesson that proves or quotes a new result: add its row here first.
