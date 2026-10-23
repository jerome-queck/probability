# Feature map — probability site

Start with a fresh build and owned data directory. Public preview drives anonymous reading; local account journeys use a separately migrated D1 and loopback sign-in fixture. Source ownership lives in `verification/features.json`; exact visual states live in `smoke.json`. Drift is fixed here; product bugs stay in product changes.

| Feature | File |
|---|---|
| Home (learn view) | [home.md](home.md) |
| Lesson pages | [lessons.md](lessons.md) |
| Interactive labs | [labs.md](labs.md) |
| Practice view | [practice.md](practice.md) |
| Reference view | [reference.md](reference.md) |
| Finite model studio | [studio.md](studio.md) |
| Routing and navigation | [routing.md](routing.md) |
| Study progress and self-check | [progress.md](progress.md) |
| Account progress | [accounts.md](accounts.md) |

## Review tooling (not a site feature)

Use the configured Codex model/effort defaults unless explicitly overridden. Cursor compatibility and Bugbot remain available. Preserve original PNG/ARIA evidence; do not resize proof images in place. Independent verifier, reviewer and mathematical verdicts require actual completed sessions.

## Named results (content gate, not a site feature)

Each lesson lists in `results` the ids of the named results it names or states (binomial theorem,
Chebyshev's inequality, strong law, ...); the field is not rendered. `src/content/results.json`
registers each id with its name and status: proved in the lesson named by `in`, `quoted` (used
without proof, introduced in `in`), or `background` (calculus tools the site assumes). `npm run
check:results` reads only the tags, never the prose: it fails on a tag that is not registered, a
registered result no lesson tags, and a proved or quoted result its home lesson does not tag.
Adding a lesson: tag every named result it uses, and add a row here for any new one; the math
review confirms nothing named was left untagged.
