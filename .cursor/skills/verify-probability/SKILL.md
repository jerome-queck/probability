---
name: verify-probability
description: Drive the probability learning site (React/Vite web UI) in headless Chrome like a reader to prove behaviour — lessons, labs, practice, reference, routing. Use before claiming any user-facing change works, and in every PR's evidence.
---

# verify-probability

The site is a static React/Vite app with no backend, accounts or stored data. A "data dir"
holds only the driver's own state (pid, port, server log), so instances are disposable.

## Launch

```bash
npm ci                                   # once per clone
npm run build                            # preview mode serves dist/
node scripts/control-probability.mjs launch --data-dir /tmp/prob-a   # optional --port N, --mode dev
```

Ready when it prints `READY http://127.0.0.1:<port> pid=<pid> mode=preview data-dir=/tmp/prob-a`.
Launch waits until the page answers. `--mode dev` serves the source with hot reload and needs no build.

## Doctor

```bash
node scripts/control-probability.mjs doctor --data-dir /tmp/prob-a
```

Read-only. Passes (`doctor: OK`) when the recorded pid is alive, the page has the app root and
the Probability title, and a deep lesson link (`/lessons/f01-...`) is served. Run it first
whenever anything looks off.

## Drive

Feature map: [`features/README.md`](features/README.md). Use accessible names and route paths:

```bash
node scripts/control-probability.mjs open --url /lessons/f02-the-axioms-of-probability --data-dir /tmp/prob-a
node scripts/control-probability.mjs click --url / --role button --name "Begin at the beginning" --data-dir /tmp/prob-a
node scripts/control-probability.mjs set-range --url <lesson with a lab> --name people --value 40 --data-dir /tmp/prob-a
node scripts/control-probability.mjs snapshot --url /reference --path artifacts/reference/aria.txt --data-dir /tmp/prob-a
node scripts/control-probability.mjs screenshot --url /practice --path artifacts/practice/page.png --data-dir /tmp/prob-a
```

Every browser command fails if the page logs a console error or throws.
`npm run smoke` runs launch → doctor → every step in `features/smoke.json` → stop, using a fresh
temporary data dir; it is part of `npm run check` and CI.

## Evidence

Save to `artifacts/<feature>/` (git-ignored; attach or summarise in the PR). A proof shows the
action and the resulting state: the route and heading after a click, the lab result text after a
slider move, the ARIA snapshot of `<main>`. Drive the real UI only; never call internal functions
to fake a state. There are no side effects to check beyond the page (no network writes, no storage
except the sidebar's expanded-chapter preference in `localStorage`).

## Cleanup

```bash
node scripts/control-probability.mjs stop --data-dir /tmp/prob-a
```

Stops only the process group recorded in that data dir. Never kill by process name. `artifacts/`
is never removed by `stop` or `smoke`.

## Helpers

- `scripts/control-probability.mjs` — the driver (`help` lists every command). Uses
  `playwright-core` with the system Chrome (`CHROME_PATH` overrides the path).
- `features/smoke.json` — the drives `smoke` performs, one or more per feature file.

Two instances can run side by side with different `--data-dir` values; each gets its own port.
