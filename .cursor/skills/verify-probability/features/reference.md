# Reference view

`/reference` lists every lesson’s main result, grouped by chapter, with a link to the lesson.

## Sub-features

- `reference.list` — each chapter heading and each lesson’s theorem.
- `reference.open` — clicking a lesson title opens it.

## How to get to it (user POV)

Top bar → “Reference”.

## Driving it with control-probability

- `open --url /reference` → heading “Every result on one page”.
- `click --url /reference --role button --name "F02 · The axioms of probability"` → path `/lessons/f02-the-axioms-of-probability`.

## Visual states

Each state is screenshotted at the listed widths, checked for overflow, KaTeX, fonts and contrast, and compared with `baselines/reference/<state>.<width>.png`.

- `load` (desktop, mobile)
- `open` (desktop, mobile)

## Gotchas

None known.
