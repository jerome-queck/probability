# 1. Match the sibling learning sites

Status: accepted (2026-10-13); the visual design part is superseded by decision 0002.

The calculus, algebra and number theory sites are the model. The number theory site is the
closest TypeScript match: a React 19 + Vite + KaTeX single-page app with lessons as JSON
records (question, definitions, theorem, proof, example, practice, caution), Biome for lint
and format, `node --test` for behaviour tests, and the same visual design. This site reuses
that stack, lesson schema and stylesheet, and keeps the scope to the same kind of site:
lessons, a few labs, practice and reference views. It has no deployment of its own.
