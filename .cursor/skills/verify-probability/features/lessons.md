# Lesson pages

Each lesson at `/lessons/<id>-<slug>` has: idea, definitions, the claim with its conditions, the argument, a worked example, an optional experiment, a practice problem with hints and answer, a boundary note, and a textbook reference. Previous/next buttons follow `src/content/order.json`.

## Sub-features

- `lesson.sections` — all section headings render; KaTeX mathematics renders without “Invalid mathematics”.
- `lesson.proof-status` — quoted supporting results are labeled and expandable; an experiment is not a proof.
- `lesson.practice` — “Show a hint” reveals hints one at a time; “Show answer” toggles the answer.
- `lesson.pagination` — previous/next buttons open neighbouring lessons.
- `lesson.prerequisites`. Buttons below the heading and in the desktop rail open earlier lessons.
- `lesson.sections-nav`. The desktop rail links to definition, claim, proof, example, experiment when present, and practice anchors.
- `lesson.sidebar`. Search requires every query word somewhere in the lesson text, in any order and across sections. Words absent from its ID, title and chapter get a `Words in` caption with their first matching section labels. Matching chapters open and can be collapsed. Clearing search restores the saved browsing preferences.

Chapters currently published (kept in sync by `check:drift`):

- Foundations
- Counting
- Conditional probability
- Discrete random variables
- Continuous random variables
- Joint distributions
- Properties of expectation
- Limit theorems

## How to get to it (user POV)

From the home chapter grid, the sidebar, the reference page, or a direct link.

## Driving it with control-probability

- Open → `open --url /lessons/f02-the-axioms-of-probability` → heading “The axioms of probability”.
- Next → `click --url /lessons/f01-sample-spaces-and-events --role button --name "F02 · The axioms of probability →"` → path `/lessons/f02-the-axioms-of-probability`.
- Answer → `click --url /lessons/f03-equally-likely-outcomes --role button --name "Show answer"` → page shows “Hide answer”.

The `next` state first follows F02's prerequisite to F01, then returns with Next. Also check a desktop section-rail link.

Navigation journeys search `Boole`, `axioms Boole` and `Boole 60%`. They check section captions, cross-section matches, ID/title caption suppression, no results, clearing, chapter preferences, native/modified links, current styling and studied marks. They preserve sidebar captures at desktop and mobile widths. Inspect caption wrapping and the studied mark at 320px as an additional reflow probe.

## Visual states

Each state is screenshotted at the listed widths, checked for overflow, KaTeX, fonts and contrast, and compared with `baselines/lessons/<state>.<width>.png`.

- `open` (desktop, mobile)
- `next` (desktop, mobile), after prerequisite and next-lesson navigation
- `quoted-result` (desktop, mobile)
- `hint-shown` (desktop, mobile)
- `answer-shown` (desktop, mobile)
- `sidebar-collapsed` (desktop)
- `search-results` (desktop)
- `search-empty` (desktop)
- `search-chapter-collapsed` (desktop) — a matching chapter collapsed while a search is active

## Gotchas

Button names include the lesson ID and arrow characters; copy them exactly.
