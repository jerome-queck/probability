# Probability

A public first course in probability: 48 lessons, eight chapters, 24 chapter problems,
14 distribution reference entries and six experiments. Each lesson includes definitions,
conditions, reasoning, a worked example and hinted practice. Quoted background is labeled.

Read without an account. ChatGPT sign-in saves study marks and practice self-ratings across
visits. Guest progress stays in the browser; importing it requires a preview. Ratings record
your judgment, not mastery. Optional scratch work clears when you leave the page.

## Develop

Requires Node 24 or newer and Chrome for browser verification.

```sh
npm ci
npm run dev
```

Open the printed loopback URL. Development sign-in uses the supplied local fixture and does
not prove hosted ChatGPT authentication. Apply local migrations with Wrangler before using
account progress. Production preview serves the emitted Worker:

```sh
npm run build
npm run agent -- launch --data-dir .verify-run/reading
npm run agent -- stop --data-dir .verify-run/reading
```

## Verify

```sh
npm run agent -- doctor
npm run agent -- map --check
npm run agent -- show --id R05
npm run check
```

CI runs the same complete check. Selected journeys speed development; release requires all
mapped states, the full rendering sweep, real local D1/account journeys and independent
mathematical, visual and code review. See [AGENTS.md](AGENTS.md), [MAP.md](MAP.md) and the
[verification skill](.agents/skills/verify/SKILL.md).

Progress ownership, response ordering, revisions and retries also have a bounded formal
check. Run `npm run verify:formal -- --mutations` with Java 11+ after changing those boundaries.
The [progress integrity skill](.agents/skills/progress-integrity/SKILL.md) records scope and
maintenance steps. This opt-in command keeps Java/TLC setup separate from the existing CI
release check; `npm run check` does not run it.

## Hosting

The supported Sites Vinext integration packages the application, assets and generated D1
migrations. `.openai/hosting.json` identifies this Site. Sites owns top-level ChatGPT sign-in;
server handlers derive record ownership from its trusted identity. No application OAuth stack
or account credential is stored here. Follow [the hosting decision](docs/adr/0003-sites-and-account-progress.md)
when changing that boundary.

Production-only dependency audit is clean. One unpatched build-tool advisory remains tracked
in [issue 26](https://github.com/jerome-queck/probability/issues/26); the full audit is not clean.

## Licence

MIT. Lessons and exercises are original. Textbook references support further reading.
