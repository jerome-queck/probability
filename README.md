# Probability

An interactive learning site for a first course in probability: counting, conditional
probability, random variables, the common discrete and continuous distributions, joint
distributions, expectation and covariance, and the limit theorems. Every lesson has an idea,
definitions, a theorem with its conditions, a proof, a worked example, practice with hints, and
a textbook reference; some have live experiments.

## Run it locally

Requires Node.js 24 or newer.

```bash
npm ci
npm run dev                         # http://127.0.0.1:5173 with hot reload
npm run build && npm run preview    # production build at http://127.0.0.1:4173
```

## Check

```bash
npm run check
```

This is the same command CI runs. See `AGENTS.md` for the full workflow.

## Licence

MIT. The lessons are original; the textbook is cited for further reading.
