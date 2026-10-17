# Routing and navigation

Client-side routes: `/`, `/practice`, `/reference`, `/lessons/<id>-<slug>`. Unknown paths show “Page not found”. Browser back/forward works through `popstate`. The emitted Worker and Vinext development server serve the application at deep links.

## Sub-features

- `routing.deep-link` — a lesson URL loads that lesson directly.
- `routing.not-found` — an unknown lesson or path shows the not-found page.
- `routing.topbar` — Learn / Practice / Reference buttons switch views.

## How to get to it (user POV)

Type or share a URL; use the top bar.

## Driving it with control-probability

- `open --url /lessons/z99-nothing` → heading “Page not found”.
- `click --url /practice --role button --name "Reference"` → path `/reference`.

## Visual states

Each state is screenshotted at the listed widths, checked for overflow, KaTeX, fonts and contrast, and compared with `baselines/routing/<state>.<width>.png`.

- `not-found` (desktop, mobile)
- `topbar` (desktop, mobile)
- `mobile-drawer-open` (mobile)
- `mobile-drawer-closed` (mobile)

## Gotchas

Study journeys also drive browser back/forward, keyboard search, heading focus, drawer autofocus/Escape return and direct `#lab` positioning. The slug after the ID is optional; `/lessons/f01` also opens F01.
