# AGENTS.md — probability

> Canonical instruction file for AI agents. `CLAUDE.md` is a symlink to this file.

## What this repo is

A public, interactive learning site for a first course in probability: sample spaces and
counting, conditional probability, discrete and continuous random variables, joint
distributions, expectation, and the limit theorems. React 19 + Vite + TypeScript + KaTeX,
matching the sibling calculus, algebra and number theory sites. Lessons are JSON in
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

It runs, in order: `check:forbidden`, `check:content`, `check:drift`, `check:rules`,
`typecheck`, `lint`, `format:check`, `test`, `build`, `smoke`. Run any piece alone with
`npm run <name>`.

## Verify like a user

Use `.cursor/skills/verify-probability/` (feature map in `features/`, driver
`scripts/control-probability.mjs`). Prove user-facing changes with the driver and put the
evidence in the PR.

## pstack

Agents may use any pstack skill when `poteto-mode` calls for it or when they judge it is
needed (for example `interrogate` for review, `tdd`, `create-verification-skill`,
`maintain-verification-skill`, `correct`, `show-me-your-work`). Model and effort per role come from
`setup-pstack`: every role runs on `grok-4.7` with a per-role effort, written to
`.grok/rules/pstack-models.md` (Grok Build loads `.grok/rules/*.md` in every session in this
repo; the same file is installed at `~/.grok/rules/pstack-models.md` and, for Cursor,
`~/.cursor/rules/pstack-models.mdc`). Run a role as `grok -m grok-4.7 --effort <effort>`.

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

## Merge gates (auto-merge)

A PR auto-merges (squash) only when all hold:

1. Independent verifier verdict **VERIFIED** on the PR head, using the verify skill — including
   visual verification: the verifier opened and inspected the screenshots of every state the
   change touches, at desktop and mobile widths.
2. Multi-model review (`interrogate` or equivalent) is **clean**: no open *Act on* items.
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
| Feature map, verify skill, smoke drives, labs, chapters and tests stay in sync | `scripts/check-drift.mjs` |
| Every rule here names an enforcer that exists | `scripts/check-rule-table.mjs` |
| Probability helpers behave correctly | `src/math/counting.test.ts`, `src/math/distributions.test.ts`, `src/math/simulation.test.ts` |
| Strict types | `tsconfig.json` (`strict`) via `npm run typecheck` |
| Lint and format | `biome.json` via `npm run lint` and `npm run format:check` |
| The real site loads and every mapped feature works | `scripts/control-probability.mjs` (`npm run smoke`) |
| Every feature state looks right at desktop and mobile widths; no unintended visual change | `scripts/control-probability.mjs` (rendering checks + pixel comparison with `.cursor/skills/verify-probability/baselines`) |
| Every feature lists visual states that are driven and baselined | `scripts/check-drift.mjs` |
| Same check locally and in CI | `.github/workflows/check.yml` runs `npm run check` |
| Evidence and verdicts are in the PR | `.github/workflows/evidence.yml` + `.github/pull_request_template.md` |
| Merge only on green, up-to-date heads | GitHub ruleset `main-gates` (required checks `check` and `evidence`, strict) |
| Math reviewed independently before merge | `.github/workflows/evidence.yml` (requires a clean math-review line for content PRs) |

## Run log (every agent run)

End each run with four short parts:

- **Read:** files, sources and docs consulted.
- **Did:** changes made, PRs opened, commands run.
- **Proof:** the evidence (check output, smoke drives, CI run URLs, review verdicts).
- **Couldn’t do:** anything skipped or blocked, and why.

Decision trails go in `.audit/<task>.tsv` (git-ignored; pstack `show-me-your-work` format)
with these columns: `ts, phase, decision, why, evidence, result, skills, model, effort` —
`skills` names every pstack or repo skill invoked for that step (for example
`poteto-mode,verify-probability`), and `model`/`effort` record what ran it (`grok-4.7`, effort
from `.grok/rules/pstack-models.md`). The PR’s “Skills used” line summarises the same. One-way-door decisions get a short record in `docs/adr/`.

## Parallel agents

Each worker uses its own branch or worktree and its own `--data-dir`; the driver picks a free
port per instance, so instances run side by side. Lessons in different `part*.json` files are
separate seams; `order.json` is shared, so edit it in one PR at a time.
