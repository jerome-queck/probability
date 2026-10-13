# Study progress and self-check

Progress kept in the browser (`localStorage` key `probability.progress.v1`): lessons the reader marks as studied, and their own verdict on each practice problem. Nothing is sent anywhere.

## Sub-features

- `progress.studied` — “Mark this lesson as studied” at the end of every lesson; pressed state reads “✓ Studied” and can be undone.
- `progress.sidebar` — studied lessons get a tick in the chapter list; chapter counts read “studied/total”.
- `progress.home` — each chapter card shows a progress bar (“1 of 3 studied”); once anything is studied the main action becomes “Continue with <next unstudied lesson>”.
- `progress.self-check` — after “Show answer”, “✓ I got it” / “↺ Review again” record a verdict; “Review again” problems are listed first on the Practice page.

## How to get to it (user POV)

Open any lesson and scroll to the end, or open a practice answer.

## Driving it with control-probability

Preconditions: launched instance, doctor OK, empty data dir (fresh browser context per drive).

- Mark studied → `click --url /lessons/f01-sample-spaces-and-events --role button --name "Mark this lesson as studied"` → page shows “✓ Studied”.
- Self-check → on `/lessons/f03-equally-likely-outcomes` click “Show answer”, then “✓ I got it” → page shows “Saved. Nice work.”
- Home → mark F01 studied, then click “Learn” → page shows “Continue with F02” and “1 of 3 studied”.

## Visual states

Each state is screenshotted at the listed widths, checked for overflow, KaTeX, fonts and contrast, and compared with `baselines/progress/<state>.<width>.png`.

- `studied` (desktop, mobile)
- `self-check` (desktop, mobile)
- `home-continue` (desktop, mobile)

## Gotchas

Each smoke drive gets a new browser context, so progress never leaks between states. Counts in the home check change when a chapter gains lessons.
