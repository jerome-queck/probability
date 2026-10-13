# MAP

| Path | What lives there |
|---|---|
| `src/App.tsx`, `src/Sidebar.tsx`, `src/LessonPage.tsx`, `src/AtlasViews.tsx` | The app shell, lesson navigation, lesson page, and the learn/practice/reference views |
| `src/Labs.tsx` | Interactive experiments, registered by `LabId` |
| `src/content/` | Lessons (`part*.json`), their order (`order.json`), schema (`types.ts`) and search |
| `src/math/` | Counting, distribution and simulation helpers with their tests |
| `src/routes.ts`, `src/state.ts` | URL routes and the navigation store |
| `scripts/` | The checks behind `npm run check` and the driver CLI `control-probability.mjs` |
| `.cursor/skills/verify-probability/` | The verify skill and the feature map |
| `.github/` | CI (`check`, `evidence`) and the PR template |
| `docs/adr/` | Decision records |
