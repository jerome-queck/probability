# Account progress integrity

`npm run verify:formal -- --mutations` checks finite state models with TLC and selected schedules against actual TypeScript and local D1. It keeps original logs under a fresh `artifacts/formal-progress/` directory. Node 24+, Java 11+, and `npm ci` are required. No jar or generated evidence belongs in Git.

## Why two checks

Two designs were compared before implementation.

| Design | Benefit | Limit |
| --- | --- | --- |
| Actual-code schedule exploration alone | Executes the implementation and SQL directly | Exhausts only the schedules the bridge defines; obscures the state-machine assumptions |
| TLC plus an actual-code bridge | Exhausts every reachable model interleaving; real-code mutations catch removed implementation guards | Requires a reviewed correspondence between the model and code |

The second design fits response ordering and compare-and-write races. TLC is an explicit finite-state model checker. It does not verify arbitrary TypeScript. The bridge imports the actual implementation, gates its actual SQL statements, and uses the repository's migrations and local D1. It does not duplicate the handler's SQL in a mock database.

TLC release 1.7.4 contains TLC 2.19, revision `5a47802`. `coverage.json` pins the download and SHA256. The runner checks the version banner as well as the jar checksum. Runs use one worker, fixed seed and fingerprint polynomial, and a 512 MiB Java heap. TLC fingerprints introduce a collision risk; its own completion output reports the estimate.

Primary references are the [TLC documentation](https://docs.tlapl.us/using%3Atlc%3Astart), the [pinned tool release](https://github.com/tlaplus/tlaplus/releases/tag/v1.7.4), and the [upstream authoring workflow](https://github.com/cursor/plugins/blob/main/pstack/skills/create-formal-verification-skill/SKILL.md). The installed workflow governed authoring. Social-post research used a [mirror](https://twiscan.com/en/x/poteto) because direct access returned HTTP 403. That mirror is context, not tool or correctness authority.

## Properties

| Invariant | Promise and harm prevented | Deliberate model fault |
| --- | --- | --- |
| `OwnerAuthorized` | A command for one owner cannot write under another trusted owner. A switched account must not receive the previous account's intent. | Skip the expected-owner branch |
| `RevisionChecked` | Every applied write compares the current revision. A stale tab must not overwrite unseen work. | Ignore the UPDATE revision condition |
| `RetryAtMostOnce` | An identical owner, expected revision, mutation ID, and desired value applies at most once. A lost response must not write twice. | Ignore the UPDATE revision condition |
| `ReplayHonest` | A failed write is acknowledged as a replay only when ID, next revision, and desired value all match the selected row. An unrelated write must not look saved. | Acknowledge any existing row after a failed write |
| `GenerationIsolated` | A completion from before refresh cannot settle the retained account's current work. An old acknowledgement or read must not clear unsaved intent. | Ignore `generation` in `active` |
| `ResponseOwnerChecked` | A completion for another owner cannot enter the current account data. Another account's response must not become personal progress. | Skip response-owner validation |
| `ConfirmedRevisionMonotone` | A retained account object's confirmed revision never decreases. An old read or acknowledgement must not replace newer confirmed work. | Replace a record without the revision comparison |

Each invariant has its own deliberately broken run. The runner requires TLC exit 12, the exact invariant name, and a counterexample trace. Parser errors and other nonzero exits do not count. Baselines require completed model checking with zero queued states.

Eight real-code mutants independently remove the expected-owner branch, SQL owner predicate, SQL revision predicate, retry mutation-ID comparison, generation guard, merge comparison, response-owner check, and stable command reuse. Each must fail its named bridge assertion. The `retry-command` mutant detects `LostResponseRecovery`: a committed write with a lost response must retry the original command and reach saved state. This mutant instead reaches conflict while the server still prevents a duplicate write. It does not demonstrate a violation of `RetryAtMostOnce`. Duplicate-application sensitivity comes from the server model's revision fault and the bridge's SQL revision mutant. Mutants live under the evidence directory and never overwrite the working source.

## Server action map

`ProgressServer.tla` has two trusted owners, one lesson, two request slots, two mutation IDs, Boolean studied values, and expected revisions 0 or 1. Each owner starts absent at revision 0 or with a seeded false value at revision 1 and an earlier mutation ID. This includes two competing UPDATEs against an existing row. Every slot chooses its command and trusted owner independently. Reachable row revisions are 0 through 3. Identical commands can occur in both slots.

| Model action | Actual code boundary |
| --- | --- |
| `Begin` | The request reaches `handleProgress` with trusted context and a valid mutation. Parsing and body validation are outside the model. |
| `Authorize` | After `await parseMutation`, `handleProgress` checks `mutation.expectedOwner !== owner` before invoking `write`. No SQL has run. |
| `CompareAndWrite` | One `.first()` on INSERT or UPDATE atomically compares and writes a single owner/lesson row. Its returned row belongs to that statement. |
| `ReadAfterFailedWrite` | Only after the failed statement completes, a separate awaited SELECT reads the current row. Another request may write between these two statements. The synchronous continuation checks the ID, next revision, and desired value. |

The model does not combine the write and fallback SELECT into one transaction. Revision 0 uses INSERT with conflict suppression. Positive revisions use UPDATE with the revision predicate. `Fault = "revision"` affects only positive-revision writes, matching the deliberately broken UPDATE.

`applied` and the violation flags are observation state. They record what a transition did; the product does not contain them. Response delivery after a successful SQL statement does not change database safety and is omitted from this model.

## Client action map

`ProgressClient.tla` starts with account A already loaded. It permits one read and one write completion, plus one refresh to A or B. Responses carry revisions 1 or 2. Refresh may contain revision 0, 1, or 2. The environment may delay responses, supply an older snapshot, or return a valid-shaped row labelled with another owner. Server revision correctness is checked separately.

| Model action | Actual code boundary |
| --- | --- |
| `Start("write")` | `flush` has prepared one command and reaches `await request` for PATCH. Queue construction is outside the model. |
| `Start("read")` | `acceptRemote` has successfully completed `confirmAccount` and reaches `await request` for GET. |
| `ReceiveHTTP` | The request promise resolves. `await response.json()` still separates it from the continuation. |
| `ReceiveJSON` | The JSON promise resolves. `active`, response validation, `mergeRecord`, and the success continuation execute synchronously before another await. A stale commit also includes settling or discarding pending intent, even if its row revision is unchanged. |
| `RefreshStart` | `loadSession` increments generation, aborts previous requests, marks retained saving work as error, and publishes loading before its first await. |
| `RefreshAwait` | Account HTTP, account JSON, and progress HTTP complete as separate steps. |
| `RefreshJSON` | Progress JSON resolves. A fresh `loadSession` merges rows, reuses the same owner's retained object or creates the other owner's object, then publishes the account. |

The model assumes abort may fail to prevent completion. It relies on `active`, not cancellation. It projects each account object to its owner and revision. With only one refresh, that owner projection matches object identity. Returning to an owner after an intervening owner is outside the bound. The model's read slot starts after a current-account confirmation; overlapping confirmations and multiple `loadSession` calls are outside the bound.

The model abstracts valid successful response continuations. It does not model the entire queue, error/conflict branches, optimistic snapshots, or import. The code bridge separately checks lost-response retries for studied state and self-ratings. It retains error intent across delayed old reads and writes, delays both HTTP and JSON boundaries, and checks older GET/newer PATCH and older PATCH/newer GET orders.

## Bridge correspondence and limits

The bridge exhausts 20 enabled SQL orderings for ten fixed request pairs and runs 15 client schedules. They cover INSERT and UPDATE races, identical retries, different IDs with equal values, equal IDs with different values, independent owners, isolated UPDATEs with both owners present, mismatched expected owners, and stale revisions. It waits until every request is at its next SQL boundary or has completed, then chooses the next actual statement. It replays every alternate choice from a clean database. The runner rejects incomplete schedule or assertion counts.

Before and after each actual statement, the bridge reads the database through the original connection. It checks owner isolation and the applied revision. Fallback acknowledgement assertions inspect the row actually returned by the handler's SELECT. Client schedules execute actual handlers and D1 for successful responses. The transport only delays completion, loses a committed response, or routes a GET through a different supplied trusted identity.

These schedules are executable correspondence checks, not exhaustive verification of JavaScript. Native hosted identity, browser/UI behavior, network infrastructure, D1 replication, arbitrary lesson counts, more than two concurrent requests, multiple refreshes, unbounded revisions, multi-lesson queues, conflict-resolution choices, guest import, and liveness remain outside the formal claim. The existing tests and browser verifier cover additional behavior independently.

The suite is opt-in and separate from normal CI `check`. This keeps Java/TLC installation and its bounded proof claim separate from the current browser release check. Run it when the [progress-integrity skill](../../.agents/skills/progress-integrity/SKILL.md) applies. `verification/features.json` assigns the models to accounts. The source digest gate catches silent covered-source drift. Review correspondence before updating that gate and its full sync commit.
