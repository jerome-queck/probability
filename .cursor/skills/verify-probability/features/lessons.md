# Lesson pages

Each lesson at `/lessons/<id>-<slug>` has: idea, definitions, the claim with its conditions, the argument, a worked example, an optional experiment, a practice problem with hints and answer, a boundary note, and a textbook reference. Previous/next buttons follow `src/content/order.json`.

## Sub-features

- `lesson.sections` — all section headings render; KaTeX mathematics renders without “Invalid mathematics”.
- `lesson.practice` — “Show a hint” reveals hints one at a time; “Show answer” toggles the answer.
- `lesson.pagination` — previous/next buttons open neighbouring lessons.
- `lesson.sidebar` — the sidebar lists chapters; search filters lessons by ID or words.

Chapters currently published (kept in sync by `check:drift`):

- Foundations
- Counting
- Conditional probability
- Discrete random variables
- Continuous random variables
- Joint distributions

## How to get to it (user POV)

From the home chapter grid, the sidebar, the reference page, or a direct link.

## Driving it with control-probability

- Open → `open --url /lessons/f02-the-axioms-of-probability` → heading “The axioms of probability”.
- Next → `click --url /lessons/f01-sample-spaces-and-events --role button --name "F02 · The axioms of probability →"` → path `/lessons/f02-the-axioms-of-probability`.
- Answer → `click --url /lessons/f03-equally-likely-outcomes --role button --name "Show answer"` → page shows “Hide answer”.

## Visual states

Each state is screenshotted at the listed widths, checked for overflow, KaTeX, fonts and contrast, and compared with `baselines/lessons/<state>.<width>.png`.

- `open` (desktop, mobile)
- `next` (desktop, mobile)
- `hint-shown` (desktop, mobile)
- `answer-shown` (desktop, mobile)
- `sidebar-collapsed` (desktop)
- `search-results` (desktop)
- `search-empty` (desktop)
- `search-chapter-collapsed` (desktop) — a matching chapter collapsed while a search is active

## Gotchas

Button names include the lesson ID and arrow characters; copy them exactly.
