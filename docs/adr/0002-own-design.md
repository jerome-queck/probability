# 2. Same stack, its own design

Status: accepted (2026-10-13). Amends decision 0001.

The site keeps the sibling sites' stack and lesson schema (React 19, Vite, TypeScript, KaTeX,
Biome, `node --test`, lessons as JSON), but no longer reuses their stylesheet. It has its own
design, built for long study sessions:

- **Reading surface:** warm paper background, Source Serif 4 at 1.1rem / 1.7 for lesson text,
  a 44rem measure, and Inter for interface text. Both fonts are bundled so screenshots are
  deterministic.
- **Navigation:** a dark rail with chapters and lessons, a sticky top bar for Learn / Practice /
  Reference, an "on this lesson" rail on wide screens, and a drawer on mobile.
- **Meaning by colour:** cobalt for anything you can act on and for the core idea, terracotta
  for theorems and results, green for practice and answers, amber for hints.
- **Proof and example steps:** numbered and joined by a line, so a long argument reads as a path.
- **Math:** KaTeX at 1.06em, with display math scrolling sideways inside its block instead of
  overflowing the page.

New study features (progress tracking, chapter summaries and so on) arrive in their own PRs,
each with a feature-map entry, visual states and baselines.
