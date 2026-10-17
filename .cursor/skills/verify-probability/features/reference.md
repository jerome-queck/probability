# Reference

`/reference` offers searchable lesson results and a distribution guide. Conditions and support remain part of each formula's meaning.

## Sub-features

- Lesson results with expandable conditions and links to their derivation.
- Distribution parameters, support, mass/density, mean, variance, caution and lesson link.
- Shared query filters the selected collection; empty results are explained.

## How to get to it (user POV)

Top bar → Reference. Select Lesson results or Distribution guide, then search a name, condition or ID.

## Driving it with control-probability

`open --url /reference` → “Results and distributions”. `smoke --feature reference --capture` captures the heading, a linked lesson, expanded conditions and a distribution entry. Study journeys search F02 and Poisson then follow their lessons. The full render sweep opens every result's conditions and checks every distribution entry at four widths.

## Visual states

- `load` (desktop, mobile)
- `open` (desktop, mobile)
- `conditions` (desktop, mobile)
- `distributions` (desktop, mobile)

## Gotchas

Switching collections retains the query. A distribution approximation is valid only under its stated conditions; formula rendering does not prove that condition check.
