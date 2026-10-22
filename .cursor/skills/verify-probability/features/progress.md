# Study marks and self-ratings

Guest progress stays in the browser (`probability.progress.v1`). Signed-in progress uses account D1; see [accounts](accounts.md).

## Sub-features

- Studied toggle, sidebar ticks and chapter counts.
- Home count and first unstudied lesson; marking every lesson studied offers opening the first lesson again, preserving marks. Reading a lesson alone does not mark it studied.
- Revealed answers offer “I got it” or “Review again”. Repeating the choice clears it. Guided Review captures marked problems only when built or explicitly refreshed. Library order remains fixed.
- A storage failure says Not saved. Account writes expose saving, failure and conflict states.

## How to get to it (user POV)

Read a lesson, then mark it studied. Attempt a problem, reveal its answer and record an honest self-rating. Use Progress for account actions.

## Driving it with control-probability

`smoke --feature progress --capture` drives a studied mark, self-rating and home resume action. The resume state clicks Continue, follows the destination's prerequisite, and returns home. Study journeys prove both guest fields survive reload and drive captured review paths and static library chapter/order selection. Guided journeys prove stable ratings inside mounted recall, explicit refresh and visit/scratch lifetime. Account journeys prove cloud reloads and guest-copy preservation separately.

## Visual states

- `studied` (desktop, mobile)
- `self-check` (desktop, mobile)
- `home-continue` (desktop, mobile)

## Gotchas

Each smoke state gets a fresh context. Scratch reasoning is not saved. Guest and account records stay distinct until explicit import; these self-reports are not a mastery assessment.
