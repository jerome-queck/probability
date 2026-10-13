# Interactive labs

Lessons with a `lab` field render an Experiment section (`#lab`, `data-lab=<id>`) with sliders (`input[name=...]`) and a live result line (`data-testid="lab-result"`). Simulations use a fixed seed, so results are reproducible.

## Sub-features

| Lab ID | Slider names | Result line starts with |
|---|---|---|
| `birthday` | `people` | P(at least one shared birthday) |
| `bayes` | `prior`, `sensitivity`, `false-positive` | P(D \| +) |
| `binomial-poisson` | `trials`, `p` | λ = np |
| `normal-approximation` | `trials`, `p` | P(X = |
| `law-of-large-numbers` | `tosses` | Proportion of heads |
| `central-limit` | `n` | Largest gap |

## How to get to it (user POV)

Open a lesson that has an Experiment link in its section bar.

## Driving it with control-probability

- Move a slider → `set-range --url <lesson path> --name <slider> --value <v>` → prints the updated result line.
- `smoke.json` drives every lab that is attached to a published lesson.

## Visual states

One state per lab once a lesson uses it: `<lab-id>-default` and `<lab-id>-moved` (desktop, mobile), compared with `baselines/labs/`.

- `birthday-default` (desktop, mobile) — C04 experiment as it loads.
- `birthday-moved` (desktop, mobile) — `people` set to 40.

- `bayes-default` (desktop, mobile) — K03 experiment as it loads.
- `bayes-moved` (desktop, mobile) — `prior` set to 0.2.

## Gotchas

A lab exists in code before any lesson uses it; it can only be driven once a lesson references it. `check:drift` requires every lab ID in `src/content/types.ts` to have a row here.
