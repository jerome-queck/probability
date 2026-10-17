# AGENTS.md - probability

Canonical agent instructions. `CLAUDE.md` is a symlink to this file.

Keep this public probability learning site correct, readable and verified. One concern per PR.

## Architecture

React 19, Vite, TypeScript and KaTeX. Lessons are original JSON in `src/content/part*.json`.
`order.json` sets the study path. `results.json` registers named results and their proof status.
`src/content/lessons.ts` loads lessons. `src/state.ts` and `src/routes.ts` own browser-history navigation.
`src/progress.ts` stores guest progress and practice self-ratings in local storage. A self-rating
does not establish mastery. `MathText`, `mathBreaks.ts` and `src/math/` own formula rendering and
probability calculations. `Labs.tsx` supplies interactive experiments.

The application is browser-only. Read `docs/adr/0002-own-design.md` before changing its design.
This repository has no deployment workflow.

## Commands

Node 24 or newer. CI runs the same `npm run check` command as local verification.

```bash
npm ci
npm run dev                         # http://127.0.0.1:5173
npm run build && npm run preview    # http://127.0.0.1:4173
npm run check
```

`check` runs forbidden-content, lesson, result-tag, drift and rule checks, then types, lint,
formatting, unit tests, build and browser smoke. Run a component with `npm run <name>`.

## Agent tools and verification

Use configured Codex model and reasoning defaults unless the task explicitly overrides them.
Record actual runner, model, effort and full session identity. Optional Cursor and Bugbot support
stays available. Bot status never replaces the independent verdicts below.

Read `.cursor/skills/verify-probability/SKILL.md`. Its feature map and browser driver are shared
by Codex and Cursor. Prove user-facing changes through the real UI. Inspect screenshots for every
touched state at desktop and mobile widths, plus a sample of other states. Keep original PNGs
unchanged. Produce separate inspection copies when needed. Keep the unfiltered browser suite and
four-width lesson, Practice and Reference sweep. Selected runs supplement full verification.

Each worker uses its own branch or worktree and its own `--data-dir`. Drive and stop only instances
you launched. The driver chooses a free port. Different `part*.json` files are separate writing
seams. Edit shared `order.json` in one PR at a time.

## Public-content rule (hard)

This repository is public. Never write the name, abbreviation or code of any course,
university, school, lecturer or handout anywhere: files, commit messages, branch names, PR
titles or bodies, metadata. Teach the mathematics only. Never commit source handouts, extracts
or pasted source text; keep them outside the clone (for example `../sources-private/`).
Explanations, proofs and examples are original. The textbook may be cited by title and section.

## Independent reviews and merge gates

Every PR needs all of the following on the full current head SHA. A new push resets verification
and reviewer verdicts. Session records use the fixed forms in `.github/pull_request_template.md`.

1. An independent verifier reports `VERIFIED` using `verify-probability`, including actual
   screenshot inspection for touched UI states at desktop and mobile widths.
2. At least two independent reviewers each report `CLEAN`. Every reviewer reports its own
   verdict. Rerun dropped or silent sessions. Resolve every Act-on item. `CHANGES NEEDED` fails
   even when the summary says clean. The verifier and reviewers are separate sessions that did
   not author the change. Use different models when available and allowed by the task.
3. CI `check` passes on a head up to date with `main`.
4. The PR body records verdicts, full reviewed SHAs, actual runner/model/effort, full session
   identities, skills and evidence. Every PR links the successful exact-head check run
   whose nonexpired `verify-evidence` artifact contains the driver run and screenshots inspected.

Codex identities are full UUIDs or full canonical paths such as `/root/reviewer_one`.
Cursor uses runner `cursor-agent` and its full UUID. Never shorten identities, invent sessions,
or count a lead's self-review as an independent verdict. Examples in the template show syntax,
not completed runs.

For content PRs, compare each changed lesson against private sources and the textbook. Obtain a
clean independent math review while authoring, before verifier and reviewers. The reviewer checks
claims, hypotheses, examples, proofs and completeness of named-result tags. Record sources and
corrections in the PR. Repeat the math review after any later lesson edit. Its full checked commit
must be an ancestor of the head, with unchanged PR lesson text. An unclean lesson never merges.

Auto-merge is squash only after every gate passes. Never push to `main`. Force-pushes, deleting
`main` and weakening a gate need the user's explicit authorization. Fix a wrong gate in its own PR.
Do not hand-edit `dist/`, `node_modules/` or `package-lock.json`. Never commit tokens or `.env*`.

## Rule → enforcer

| Rule | Enforcer |
| --- | --- |
| No private source identifiers in tree, history, branch or PR text | `scripts/check-forbidden.mjs` + `scripts/check-forbidden.test.mjs`; `scripts/check-evidence.mjs` checks live PR text from the trusted base branch |
| Complete lessons, unique IDs, earlier prerequisites and valid math syntax | `scripts/check-content.mjs` |
| Explicit complete named-result tags and registered result homes | `scripts/check-results.mjs` + `src/content/results.json` + `scripts/check-results.test.mjs`; semantic completeness requires independent math review |
| Feature map, drives, baselines, labs, chapters and tests stay synchronized | `scripts/check-drift.mjs` |
| Rule-table references exist | `scripts/check-rule-table.mjs` |
| Correct probability calculations | `src/math/counting.test.ts`, `src/math/distributions.test.ts`, `src/math/simulation.test.ts` |
| Strict types, lint and format | `tsconfig.json`, `biome.json`, `npm run typecheck`, `npm run lint`, `npm run format:check` |
| Every mapped feature works and renders at desktop and mobile widths | `scripts/control-probability.mjs` + `.cursor/skills/verify-probability/baselines` |
| Exact nonempty smoke selection with runnable viewports | `scripts/smoke-selection.mjs` + `scripts/smoke-selection.test.mjs` |
| No inline formula scraps under 40px or split formulas under 120px at 390, 600, 860 and 1280px | `scripts/orphans.mjs`, `scripts/orphans.test.mjs`, `src/mathBreaks.ts` + the sweep in `scripts/control-probability.mjs` |
| Same local and CI checks | `.github/workflows/check.yml` runs `npm run check` |
| Exact-head independent verifier and two completed clean reviewers | `scripts/evidence-rules.mjs`, `scripts/evidence-rules.test.mjs` + `.github/workflows/evidence.yml` |
| Fresh independent math check of merged lesson text | `scripts/evidence-rules.mjs`, `scripts/evidence-rules.test.mjs` + `.github/workflows/evidence.yml` |
| PR evidence and successful exact-head artifact metadata | `scripts/check-evidence.mjs` + `.github/workflows/evidence.yml` from the trusted base branch |
| Merge only on green, up-to-date heads | GitHub ruleset `main-gates` requires `check` and `evidence` |

## Run log

End every run with four short parts: **Read**, **Did**, **Proof**, **Couldn't do**. Name skipped
checks and blockers. Keep decisions in git-ignored `.audit/<task>.tsv` with columns
`ts, phase, decision, why, evidence, result, skills, runner, model, effort, session`. Use actual
values and evidence pointers. Summarize the same skills and runner details in the PR. Record
irreversible design decisions in `docs/adr/`.

## Known gate gaps

The ruleset pins `check` and `evidence` to GitHub Actions integration 15368. All workflows and
workflow tokens share that app identity. Another PR workflow can create a job with the same
required name. A same-repository workflow with `statuses: write` can also post success on the
test merge commit. Required contexts do not bind to a workflow path. An approving human review
adds a check but does not bind those contexts. The user decides whether to accept this risk.

The evidence gate validates linked run name, workflow path, full SHA, success and nonempty
artifact metadata. It does not authenticate PR-body session claims or prove that the linked
workflow still runs the documented check chain. Independent reviewers inspect those boundaries.
