# AGENTS.md — probability

> Canonical instruction file for AI agents. `CLAUDE.md` is a symlink to this file.

## What this repo is

A public, interactive learning site for a first course in probability: sample spaces and
counting, conditional probability, discrete and continuous random variables, joint
distributions, expectation, and the limit theorems. React 19 + Vite + TypeScript + KaTeX,
using the same stack as the sibling calculus, algebra and number theory sites, with its own design (docs/adr/0002-own-design.md). Lessons are JSON in
`src/content/part*.json`; exact and numeric helpers live in `src/math/`.

**One job for agents here:** keep this site correct, readable and verified — every change lands
as a small PR with evidence.

## Setup (from a clean clone)

```bash
node --version        # 24 or newer
npm ci
```

## Run it locally

```bash
npm run dev           # dev server with hot reload: http://127.0.0.1:5173
npm run build && npm run preview   # production build served at http://127.0.0.1:4173
```

There is no deployment from this repo.

## Check (run before every PR — CI runs exactly this)

```bash
npm run check
```

It runs, in order: `check:forbidden`, `check:content`, `check:results`, `check:drift`,
`check:rules`, `typecheck`, `lint`, `format:check`, `test:agent-run`, `test`, `build`, `smoke`. Run any piece alone with
`npm run <name>`.

## Verify like a user

Use `.cursor/skills/verify-probability/` (feature map in `features/`, driver
`scripts/control-probability.mjs`). Prove user-facing changes with the driver and put the
evidence in the PR.

## pstack

Agents may use any pstack skill when `poteto-mode` calls for it or when they judge it is
needed (for example `interrogate` for review, `tdd`, `create-verification-skill`,
`maintain-verification-skill`, `correct`, `show-me-your-work`). Agents run on the
Cursor CLI (`cursor-agent`, also `agent`) with pstack installed as its Cursor plugin. Models are
`grok-4.7` tiers only (never Claude, GPT, Gemini or Composer); the tier is the effort.
`setup-pstack` writes `~/.cursor/rules/pstack-models.mdc`: pstack's
Task subagents accept only `grok-4.7-high`, so every pstack role uses it. The review workflow
picks its tier per role and runs each role as a fresh headless session (resumed with --resume if it stalls or drops) with
`scripts/agent-run.sh <role> <prompt-file> <out-prefix>`, always in its own git worktree:
Before each attempt it waits at a box-wide gate: at most 2 heavy runs (cursor-agent sessions plus
Playwright smoke runs) at once and a 1-minute load below 8 (`AGENT_MAX_RUNS`, `AGENT_MAX_LOAD`).
Receipt agent-run-stability-2026-10-15: the stall watchdog is 1800s and does not count time while a
Task subagent call is open; after a `NonRetriableError` the next attempt is a fresh session with the
original prompt, not `--resume`; images over 2000px per side written under the worktree (or
`AGENT_IMAGE_DIRS`) during an attempt are downscaled in place by `scripts/shrink-images.py` once
unchanged for 10s and while no smoke run is active in that tree; baselines are never touched
(needs Pillow; without it only a warning is logged and the image tests are skipped). Long runs are started detached through
Box Ops' `longrun`, never supervised from a chat turn.

| Role | Tier | What it does |
|---|---|---|
| verifier | `grok-4.7-high` | independent verifier using `verify-probability`; looks at the screenshots |
| review | `grok-4.7-high` | one `interrogate` reviewer per session, no Task subagents; each PR gets two such sessions (R1, R2), started one at a time, each with its own prompt |
| math | `grok-4.7-high` | independent math check of lesson content against the sources, at authoring time (before the verifier and reviewers) and again after any lesson edit |
| chore | `grok-4.7-medium` | mechanical work: merges, baselines, PR bodies |

Before each batch of sessions, check the plan usage (`/usage` in `cursor-agent`) and stop if
on-demand spend is above $0.

## Public-content rule (hard)

This repository is public. Never write the name, abbreviation or code of any course,
university, school, lecturer or handout anywhere: files, commit messages, branch names, PR
titles or bodies, metadata. Teach the mathematics only. Never commit source handouts, extracts
or pasted source text; keep them outside the clone (for example `../sources-private/`).
Explanations, proofs and examples are original. The textbook may be cited by title and
section.

## Mathematical correctness gate

Every content PR records, in the PR body: (1) the source check — each lesson compared against
the source material and the textbook, (2) an independent review by a separate session or model
that did not write the content, with its verdict, and (3) any corrections made. A lesson whose
review is not clean does not merge.

The math check runs at authoring time: run `scripts/agent-run.sh math <prompt> <out>` on the
changed lessons before the verifier and reviewers, fix what it finds, and run it again after any
later edit to the lesson text. The PR body's “Math review:” records the last clean run in a fixed
form, `clean — grok-4.7-high (session <id>) on <sha>; notes`, where `<sha>` is the commit it
checked; the evidence job fails if a lesson file the PR changes differs between `<sha>` and the
head, or if `<sha>` is not an ancestor of the head.

## Merge gates (auto-merge)

A PR auto-merges (squash) only when all hold:

1. Independent verifier verdict **VERIFIED** on the PR head, using the verify skill — including
   visual verification: the verifier opened and inspected the screenshots of every state the
   change touches, at desktop and mobile widths.
2. Multi-model review (`interrogate` or equivalent) is **clean**: no open *Act on* items, and
   **every** review session reported its own verdict. A reviewer that drops or returns nothing is
   rerun; the lead alone is not a review. The PR body's “Reviewer verdicts:” lists each one in a
   fixed form, `R1 grok-4.7-high CLEAN (session <id>); R2 grok-4.7-high CHANGES NEEDED (session <id>)`.
   Run each reviewer as its own top-level session (`scripts/agent-run.sh review <prompt> <out>`,
   one prompt per reviewer, telling it to work alone), one at a time: Task subagents are cut off
   when the lead is stalled and resumed, and then never report. A dropped reviewer is rerun the
   same way, never as a subagent. The session id is the `session=` value agent-run.sh prints.
3. CI `check` is green on a head that is up to date with `main` (the ruleset requires it).
4. Evidence is in the PR body (the `evidence` CI job checks the template fields): verdict and
   verified head, review record naming the reviewer, skills used with model and effort, and for
   feature changes a link to the CI run whose `verify-evidence` artifact holds the driver run
   and screenshots.

A new push resets 1 and 2. Force-pushes, deleting `main`, and weakening a gate need Jerome’s
OK. Fixing a wrong gate is its own PR.

## Boundaries

- Changes only via PRs; one concern per PR. Never push to `main`.
- Don’t edit: `dist/`, `node_modules/`, `package-lock.json` by hand.
- Secrets: none are needed. Never commit tokens or `.env*` files.
- Drive only instances you launched, each with its own `--data-dir`; stop only those.

## Rule → enforcer

| Rule | Enforced by |
|---|---|
| No course, institution, lecturer or handout identifiers anywhere | `scripts/check-forbidden.mjs` (tree, history, branch, PR text) + `scripts/check-forbidden.test.mjs` |
| Lessons are complete, IDs unique, prerequisites earlier, math renders | `scripts/check-content.mjs` |
| Every named result a lesson names or states is tagged in its `results` list; every tag is registered in `src/content/results.json`, every registered result is tagged by some lesson, and a proved or quoted result's home lesson tags it. No prose is scanned; tag completeness is the math review's job (docs/root-cause/19.md) | `scripts/check-results.mjs` + `src/content/results.json` + `scripts/check-results.test.mjs` (deleting any row fails) |
| Feature map, verify skill, smoke drives, labs, chapters and tests stay in sync | `scripts/check-drift.mjs` |
| Every rule here names an enforcer that exists | `scripts/check-rule-table.mjs` |
| Probability helpers behave correctly | `src/math/counting.test.ts`, `src/math/distributions.test.ts`, `src/math/simulation.test.ts` |
| Strict types | `tsconfig.json` (`strict`) via `npm run typecheck` |
| Lint and format | `biome.json` via `npm run lint` and `npm run format:check` |
| The real site loads and every mapped feature works | `scripts/control-probability.mjs` (`npm run smoke`) |
| Every feature state looks right at desktop and mobile widths; no unintended visual change | `scripts/control-probability.mjs` (rendering checks + pixel comparison with `.cursor/skills/verify-probability/baselines`) |
| No inline formula orphans on a phone: no scrap under 40px alone on a new line, no formula under 120px split across lines, on every lesson page at 390, 600, 860 and 1280px | `scripts/orphans.mjs` called by the sweep in `scripts/control-probability.mjs` + `scripts/orphans.test.mjs` (fails on E03 at daf7a37) + `isShortFormula` in `src/mathBreaks.ts` |
| Every feature lists visual states that are driven and baselined | `scripts/check-drift.mjs` |
| Same check locally and in CI | `.github/workflows/check.yml` runs `npm run check` |
| Evidence and verdicts are in the PR | `.github/workflows/evidence.yml` (pull_request_target: the gate script comes from the base branch, never the PR head) + `.github/pull_request_template.md` |
| Merge only on green, up-to-date heads | GitHub ruleset `main-gates` (required checks `check` and `evidence`, strict) |
| Every review session reported (no merge on a lead-only review after a reviewer dropped) | `scripts/evidence-rules.mjs` via `.github/workflows/evidence.yml` (“Reviewer verdicts:”) + `scripts/evidence-rules.test.mjs` (fails on PR #18's body) |
| Math checked independently on the lesson text as merged | `.github/workflows/evidence.yml` + `scripts/evidence-rules.mjs` (content PRs: “Math review:” in the fixed form, no lesson file the PR changes edited after the checked commit) + `scripts/evidence-rules.test.mjs` (fails on PR #13, merged with E03 edited after its math check) |

## Run log (every agent run)

End each run with four short parts:

- **Read:** files, sources and docs consulted.
- **Did:** changes made, PRs opened, commands run.
- **Proof:** the evidence (check output, smoke drives, CI run URLs, review verdicts).
- **Couldn’t do:** anything skipped or blocked, and why.

Decision trails go in `.audit/<task>.tsv` (git-ignored; pstack `show-me-your-work` format)
with these columns: `ts, phase, decision, why, evidence, result, skills, runner, model, session` —
`skills` names every pstack or repo skill invoked for that step (for example
`poteto-mode,verify-probability`), `runner` is `cursor-agent`, `model` is the tier slug that ran
it (for example `grok-4.7-high`; the tier is the effort) and `session` is the session id that
`scripts/agent-run.sh` prints. The PR’s “Skills used” line summarises the same. One-way-door decisions get a short record in `docs/adr/`.

## Parallel agents

Each worker uses its own branch or worktree and its own `--data-dir`; the driver picks a free
port per instance, so instances run side by side. Lessons in different `part*.json` files are
separate seams; `order.json` is shared, so edit it in one PR at a time.

## Known gate gaps

- The `main-gates` ruleset requires `check` and `evidence` from the GitHub Actions app
  (integration 15368, pinned 2026-10-14), so another app can no longer satisfy them. Two holes
  remain, because every Actions job and workflow token is that same app:
  - Any PR whose `pull_request` workflows run can add a job named `check` or `evidence`; required
    checks match name and app, not the workflow path. That includes same-repo branches and forks
    from anyone who has had a commit or PR merged here (the repo only asks approval for
    first-time contributors).
  - A same-repo workflow with `statuses: write` can post a success status on the test merge
    commit, which moves evaluation to a commit where the real gate never ran. (A status beside the
    head's failing `evidence` check does not clear it.)
  No repo setting closes either hole: a required approving review adds a human check before merge
  but does not bind the contexts to `.github/workflows/evidence.yml` or stop a merge-commit status.
  Jerome decides whether to add that review or accept the risk.
- The evidence gate checks the linked run's workflow name, path, head SHA, success and a non-empty
  `verify-evidence` artifact, not that the PR's `check.yml` still runs `npm run check`.
