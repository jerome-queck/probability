# Repository map

| Path | Responsibility |
| --- | --- |
| `app/`, `build/sites-worker.ts`, `vite.config.ts` | Supported Sites host and API routes; import the browser reader after mount |
| `src/App.tsx`, `src/Sidebar.tsx` | Application shell, navigation and keyboard focus |
| `src/LessonPage.tsx`, `src/StudyViews.tsx`, `src/AtlasViews.tsx` | Lessons, bounded practice, checkpoints, reference and study overview |
| `src/Labs.tsx`, `src/math/` | Experiments and probability calculations |
| `src/content/` | Ordered lessons, checkpoint problems, distribution reference, search and named-result registry |
| `src/progress.ts`, `src/AccountPanel.tsx` | Guest storage, confirmed account state, pending intents and recovery UI |
| `server/progress.ts`, `db/`, `drizzle/` | Owner-scoped D1 writes, revisions and generated migrations |
| `scripts/probability.mjs` | Agent command discovery, feature selection and verification receipts |
| `verification/features.json` | Feature ownership; unknown files require full coverage |
| `.agents/skills/verify/`, `.cursor/skills/verify-probability/` | Shared verification instructions, driven states and visual baselines |
| `.github/` | CI, trusted evidence gate, dependency maintenance and PR template |
| `docs/adr/`, `docs/research/` | Decisions and source-backed study design |

Start with `npm run agent -- help`; inspect a lesson with `show --id F01` instead of loading
all content. `plan --base main` explains affected features. Each worker uses its own worktree
and instance data directory. Only the recorded owned process may be stopped.
