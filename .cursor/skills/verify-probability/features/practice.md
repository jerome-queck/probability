# Practice view

`/practice` lists every lesson’s practice problem with hints and answers.

## Sub-features

- `practice.list` — one problem per lesson, headed “<id> · <title>”.
- `practice.reveal` — hint and answer buttons work as in a lesson.

## How to get to it (user POV)

Top bar → “Practice”, or the “Practise →” button on the home page.

## Driving it with control-probability

- `open --url /practice` → heading “One problem per lesson”.

## Visual states

Each state is screenshotted at the listed widths, checked for overflow, KaTeX, fonts and contrast, and compared with `baselines/practice/<state>.<width>.png`.

- `load` (desktop, mobile)
- `answer-shown` (desktop, mobile)

## Gotchas

Each embedded problem has the id `practice-<lesson id>`.
