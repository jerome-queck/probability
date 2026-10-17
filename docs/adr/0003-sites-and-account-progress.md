# Sites and account progress

The reader remains a React application inside the supported Sites Vinext build. A client boundary imports it after mount because the route and progress stores read browser APIs. Public lessons stay available without an account. Sites owns ChatGPT sign-in and injects trusted request identity.

One D1 row belongs to an account and lesson. It records studied state, a nullable self-rating, review time, revision and the latest mutation ID. Writes express desired states and compare revisions atomically. The server selects the owner from platform identity and rejects a mismatched expected account. Retried writes cannot toggle a result twice. A conflict remains visible until the learner chooses what to keep.

Guest progress keeps its existing browser key. Signing in loads account progress. An explicit import adds guest study marks and missing self-ratings while preserving existing account ratings and the guest copy. Confirmed progress survives reload through D1. Pending account changes stay in memory and are labeled unsaved.

The architecture comparison rejected a custom embedded-asset Worker and a full server-rendered rewrite. The supported build already packages assets and migrations. Keeping the reader bounds the migration and preserves valid mathematics. Separate exercise tables and a persistent synchronization queue do not earn their complexity for lesson-level progress.

Verification retains mathematical contracts and real rendering checks. A versioned feature map owns source coverage; unknown files require full verification. Independent image inspection remains necessary because pixel comparisons alone are sensitive to browser and operating-system rendering. Local fixture authentication, production sign-in and a second real account are separate claims.

Cursor Bugbot remains useful. Codex review records replace obsolete model-specific runner requirements. A clean CI badge cannot replace an independent verifier or mathematical review.
