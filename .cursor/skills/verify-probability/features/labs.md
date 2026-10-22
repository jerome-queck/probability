# Interactive labs

Lessons with a `lab` field render an Experiment section (`#lab`, `data-lab=<id>`) with sliders (`input[name=...]`) and a live result line (`data-testid="lab-result"`). Simulations start with a reproducible seed. The law-of-large-numbers “New run” button advances its seed and changes the sample path.

## Sub-features

| Lab ID | Slider names | Result line starts with |
|---|---|---|
| `birthday` | `people` | P(at least one shared birthday) |
| `bayes` | `prior`, `sensitivity`, `false-positive` | P(D \| +) |
| `binomial-poisson` | `trials`, `lambda` | p = λ/n |
| `normal-approximation` | `trials`, `p` | P(X = |
| `law-of-large-numbers` | `tosses` | Proportion of heads |
| `central-limit` | `n` | Largest gap |

## How to get to it (user POV)

Open a lesson that has an Experiment link in its section bar.

## Driving it with control-probability

- Move a slider → `set-range --url <lesson path> --name <slider> --value <v>` → prints the updated result line.
- `smoke.json` drives every lab that is attached to a published lesson.

For the law-of-large-numbers lab, click “New run” and inspect the changed result and values table. Also change Bayes sensitivity and false-positive rate, binomial-Poisson λ, and normal-approximation p. The mapped moved states exercise one slider per lab; these extra controls need separate live checks.

## Visual states

One state per lab once a lesson uses it: `<lab-id>-default` and `<lab-id>-moved` (desktop, mobile), compared with `baselines/labs/`.

- `birthday-default` (desktop, mobile) — C04 experiment as it loads.
- `birthday-moved` (desktop, mobile) — `people` set to 40.

- `bayes-default` (desktop, mobile) — K03 experiment as it loads.
- `bayes-moved` (desktop, mobile) — `prior` set to 0.2.

- `binomial-poisson-default` (desktop, mobile) — D05 experiment as it loads.
- `binomial-poisson-moved` (desktop, mobile) — `trials` set to 200 with λ = 3 held, so p = 0.015.

- `normal-approximation-default` (desktop, mobile) — R05 experiment as it loads.
- `normal-approximation-moved` (desktop, mobile) — `trials` set to 100.

- `law-of-large-numbers-default` (desktop, mobile) — L02 experiment as it loads.
- `law-of-large-numbers-moved` (desktop, mobile) — `tosses` set to 5000.

- `central-limit-default` (desktop, mobile) — L04 experiment as it loads.
- `central-limit-moved` (desktop, mobile) — `n` set to 12.

## Gotchas

Chart labs include axis labels, a legend and an accessible values table; Bayes explains expected positive counts in prose. Journeys assert changed numerical results, chart/table labels and deterministic table values. Captures select `#lab`, preserving controls and output rather than the lesson header. A lab exists in code before any lesson uses it; it can only be driven once a lesson references it. `check:drift` requires every lab ID in `src/content/types.ts` to have a row here.
