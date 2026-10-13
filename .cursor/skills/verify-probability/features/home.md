# Home (learn view)

The landing page at `/`: a hero with the site promise, a start button, and a chapter grid listing every lesson.

## Sub-features

- `home.hero` — heading “Uncertain outcomes. Exact reasoning.” and two actions.
- `home.start` — “Begin at the beginning” opens the first lesson.
- `home.chapters` — one card per chapter, each lesson a button.

## How to get to it (user POV)

Open the site root, or click “Probability” / “Learn” in the top bar from anywhere.

## Driving it with control-probability

Preconditions: launched instance, doctor OK.

- Load → `open --url /` → heading contains “Uncertain outcomes”.
- Start → `click --url / --role button --name "Begin at the beginning"` → path `/lessons/f01-sample-spaces-and-events`.

## Gotchas

The hero heading has a line break, so match a fragment of it.
