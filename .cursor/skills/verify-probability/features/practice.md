# Practice

`/practice` starts with five problems. Select a chapter, filter self-rated review problems or choose Show all problems. Self-ratings express the reader's judgment, not a grade.

## Sub-features

- Chapter/review filters and count feedback; review problems rank first.
- Optional scratch reasoning, incremental hints, answer reveal and self-rating.
- Chapter checkpoints with independently opened hints and solutions.

## How to get to it (user POV)

Top bar → Practice, or home → Practise problems. Choose a chapter or a bounded set before revealing answers.

## Driving it with control-probability

`open --url /practice` → “One problem per lesson”. `smoke --feature practice --capture` drives the default, revealed answer and checkpoint solution. Study journeys verify filters and rating persistence. The full semantic sweep chooses Show all problems and asserts every lesson hint/answer and every checkpoint solution was opened.

## Visual states

- `load` (desktop, mobile)
- `answer-shown` (desktop, mobile)
- `checkpoint-solution` (desktop, mobile)

Captures show the relevant problem/solution region. Full release smoke compares inspected baselines.

## Gotchas

Embedded problems use `practice-<lesson ID>`. Scratch reasoning clears on navigation/reload; it is not a saved account field. A filtered empty state is legitimate and should explain how to broaden the selection.
