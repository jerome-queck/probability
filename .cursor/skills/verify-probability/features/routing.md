# Routing and navigation

Client-side routes: `/`, `/practice`, `/reference`, `/lessons/<id>-<slug>`. Unknown paths show “Page not found”. Browser back/forward works through `popstate`. The Vite dev and preview servers serve `index.html` for deep links.

## Sub-features

- `routing.deep-link` — a lesson URL loads that lesson directly.
- `routing.not-found` — an unknown lesson or path shows the not-found page.
- `routing.topbar` — Learn / Practice / Reference buttons switch views.

## How to get to it (user POV)

Type or share a URL; use the top bar.

## Driving it with control-probability

- `open --url /lessons/z99-nothing` → heading “Page not found”.
- `click --url /practice --role button --name "Reference"` → path `/reference`.

## Gotchas

The slug after the ID is optional; `/lessons/f01` also opens F01.
