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

Open a lesson that includes an Experiment section. At desktop widths above 1100px, its context rail links directly to Experiment. At narrower widths, scroll to that section.

## Driving it with control-probability

- Move a slider → `set-range --url <lesson path> --name <slider> --value <v>` → prints the updated result line.
- `smoke.json` drives every lab that is attached to a published lesson.

Lab journeys change every slider at desktop and mobile widths. After the mapped primary changes, they set Bayes sensitivity to 0.8 and false-positive rate to 0.1, λ to 5, and normal-approximation p to 0.3. Fixed numerical assertions check posteriors, expected positive counts, the approximation result and updated chart table cells. The law-of-large-numbers New run check compares the new result with its final table value. Each secondary control and New run gets a separate journey capture. The mapped moved states and Linux baselines remain unchanged.

## Visual states

Two states per attached lab: `<lab-id>-default` and `<lab-id>-moved` (desktop, mobile), compared with `baselines/labs/`.

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

Every lab asks for a prediction before changing controls and an explanation afterward. An experiment illustrates a model; it does not prove its theorem. Chart labs include axis labels, a legend and an accessible values table; Bayes explains expected positive counts in prose. Journeys assert changed numerical results, chart/table labels and deterministic table values. Captures select `#lab`, preserving controls and output rather than the lesson header. A lab exists in code before any lesson uses it; it can only be driven once a lesson references it. `check:drift` requires every lab ID in `src/content/types.ts` to appear in backticks here.

Distribution helper tests compare large binomial and hypergeometric masses, a large gamma value and density, a small binomial tail, and negative gamma reflection against independent numerical references. They also check complete finite-support sums, validation, degenerate masses, gamma-density origin limits at both zero signs, and the exact `0.09375` binomial masses that display as `0.0938`. Relative tolerances include a separate subnormal allowance and require finite results.

The binomial helper retains direct arithmetic where its factors have normal range and complementation is reversible. Other cases use logarithms. Gamma and hypergeometric currently have no lab callers. These bounded tests establish neither correct rounding nor uniform accuracy for every accepted input. Chart geometry uses unrounded masses, so inspect actual desktop and mobile captures after a numerical change even when table text matches. Include the binomial/Poisson state with n = 260 and λ = 4 when checking this transition.
