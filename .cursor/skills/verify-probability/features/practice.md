# Practice

`/practice` offers a guided topic/review plan and a complete problem library. Plans capture their membership when built. Ratings record the reader's judgment, not a grade.

## Sub-features

- A topic path contains its complete ordered prerequisite closure, Needed by links, live records, next reading and a bounded Today preview.
- Review captures only marked problems, with prerequisite links for context. Clearing a rating leaves the current roster in place. Refresh from current records rebuilds it explicitly.
- Recall mounts each captured problem once. One panel is visible. Ratings preserve cursor, roster, reasoning, reveals and focus. Previous, Next and Finish control movement.
- Set summaries show current ratings, captured continuation and explicit refresh. Closing a set writes no study marks or ratings.
- The library shows the first five or all problems in fixed curriculum/chapter order. Ratings never filter or reorder it. Every chapter checkpoint retains hints and solutions.

## How to get to it (user POV)

Top bar → Practice, home → Practise problems, or the home topic/review entry. Choose a topic and three or five problems per set, then Build topic path. Review marked problems builds from current review marks. Start this set opens recall. Browse all problems and checkpoints reaches the library outside active recall.

## Driving it with control-probability

`open --url /practice` shows Guided study and Problem library. `smoke --feature practice --capture` drives chooser, topic/review/empty paths, active recall, summary, a library answer and a checkpoint solution. `node scripts/verify-journeys.mjs --only guided` drives stable ratings, hidden-panel focus/accessibility, explicit movement, K03 continuation in sizes three/five, refresh, Back/Forward, reload and all-studied recall through real controls. Study journeys assert exact library chapter/order/counts and checkpoint disclosure inventory. The unfiltered full semantic sweep still opens every problem, hint, answer and checkpoint at four widths.

## Visual states

- `load` (desktop, mobile)
- `answer-shown` (desktop, mobile)
- `checkpoint-solution` (desktop, mobile)
- `topic-path` (desktop, mobile)
- `review-path` (desktop, mobile)
- `review-empty` (desktop, mobile)
- `recall-active` (desktop, mobile)
- `set-summary` (desktop, mobile)

Inspect all touched desktop/mobile originals. Journey captures include each active member, final summaries, all-studied recall and planner account lifecycle states. The 320px probe includes an actually opened count-model checkpoint solution.

## Gotchas

Embedded problems use `practice-<lesson ID>`. Every document ID must be unique, including hidden panels. The library is absent during recall. Activate every member before claiming rendering coverage. Native hidden panels must expose no problem controls/headings or keyboard stops.

Reasoning and reveals survive ratings and movement within the mounted set. Leaving Practice, closing/replacing the set or reloading clears them. Back/Forward and visits to Studio keep the visit's plan and cursor. The owner-keyed StudyContent stays mounted when Studio is visible, so identity changes there still reset the retained plan. Reload, account discovery and owner changes reset the plan. Saving/error/conflict for the same resolved owner retain it. A got-it rating does not remove an unstudied prerequisite. Studied marks can reduce topic recall to its target while the complete reading path remains visible.
