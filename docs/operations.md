# Verification and publishing

Use Node 24 or newer, `npm ci`, and `npm run agent -- doctor`. Each worker owns a separate
worktree and instance data directory. `npm run agent -- map --check` checks feature coverage;
`plan --base main` explains what changed. Unknown files select every feature. A selected journey
helps development but cannot replace the full release run.

`npm run check` runs the source gates, behavior tests, Worker build, all mapped visual states,
the full lesson/practice/checkpoint/reference rendering sweep, and complete guest/account
journeys. Source checks and browser checks are separately available as `verify:source` and
`verify:browser`. Browser receipts identify source/build digests, selected states, failures and
original PNGs. Keep originals unchanged and create separate inspection copies.

For interrupted local runs, follow the [verification cleanup contract](../.agents/skills/verify/SKILL.md#cleanup). SIGINT/SIGTERM retain failed receipts and logs after owned cleanup; the first signal selects 130/143. Retained-state and browser timeout outcomes require process inspection before retry. Standalone launches remain detached for subsequent driver commands.

The full visual comparison uses the pinned Linux Chrome in CI. Other browsers and systems may
render differently. Record those failures precisely; do not widen the threshold or call a
capture-only run a visual pass. Intended changes need inspected candidate images followed by a
new complete comparison. New content also needs independent mathematical review of its final
text. Syntax and numerical examples do not prove a general theorem.

The local Sites fixture exercises top-level sign-in and actual local D1 writes. It does not
prove hosted authentication. Before release, separately verify anonymous reading, real ChatGPT
sign-in, a saved account change after reload, and rejected anonymous/spoofed identity requests
at the literal deployed origin. A second simulated owner proves handler authorization, not a
second real visitor session. Label that distinction in release evidence.

Keep exact-head independent verifier and reviewer reports in the PR. Both protected `check`
and trusted-base `evidence` must pass. Bugbot adds feedback. It does not replace the independent
verdicts. Merge with a server-enforced expected head; confirm the resulting commit is on main.

For publication, use the installed Sites workflow and the existing `.openai/hosting.json`
project ID. Keep source credentials in session memory and send them only through the helper's
hidden stdin. Push the exact source, build and package it, then save and deploy that matching
version. Preserve native source, version and deployment receipts. Never infer a deployment
from a local preview or GitHub merge.

Custom domains are registered after the first publication. Configure only the returned DNS
records, then verify native hostname/certificate status and HTTPS at the final domain. Keep
unrelated DNS records intact.

For a later regression, redeploy the last verified saved version through Sites, verify its
literal URL and progress readback, then repair the source in a reviewed PR. Database changes
must remain compatible with the previous version or include an explicit recovery plan. The
initial schema stores one row per owner and lesson; ordinary deployments preserve those rows.
