# Home (learn view)

The landing page at `/`: a hero with the site promise, a start button, and a chapter grid listing every lesson.

## Sub-features

- `home.hero` — heading “Learn to reason under uncertainty.”, two actions, and the binomial-with-normal-curve figure.
- `home.start`. With no studied marks, “Begin at the beginning” opens the first lesson. Existing marks offer the first unstudied lesson. When every lesson is studied, the action offers a restart.
- `home.progress`. The study overview reports studied lessons and review ratings. Chapter cards show studied counts. See [progress](progress.md).
- `home.plan`. Topic/review entry appears before Chapters. Active visits offer Continue set, Open topic path, Open review plan or Open set summary plus explicit Choose another plan. Unresolved accounts hide personal planning and counts.
- `home.scope` — expandable scope and required preparation.
- `home.chapters` — one card per chapter, each lesson a button.

## How to get to it (user POV)

Open the site root, or click “Probability” / “Learn” in the top bar from anywhere.

## Driving it with control-probability

Preconditions: launched instance, doctor OK.

- Load → `open --url /` → heading contains “Learn to reason”.
- Start → `click --url / --role button --name "Begin at the beginning"` → path `/lessons/f01-sample-spaces-and-events`.

Use a fresh guest context for the start action. Inspect the study overview and chapter grid separately at desktop and mobile widths; the mapped hero captures do not include them. Activate a chapter lesson and check its heading. `progress/home-continue` exercises resume and returns to the home hero.

## Visual states

Each state is screenshotted at the listed widths, checked for overflow, KaTeX, fonts and contrast, and compared with `baselines/home/<state>.<width>.png`.

- `load` (desktop, mobile)
- `start-hover` (desktop, mobile)
- `start-focus` (desktop, mobile)
- `start` (desktop, mobile)
- `course-scope` (desktop, mobile)
- `study-entry` (desktop, mobile)

## Gotchas

The hero heading has a line break, so match a fragment of it. The study-entry state captures the complete planner entry; the hero capture excludes it. Building from home opens Practice. Continue set resumes captured membership without rebuilding it.
