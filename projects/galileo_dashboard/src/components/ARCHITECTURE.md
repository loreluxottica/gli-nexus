# src/components — UI

**Owns:** all Galileo UI, grouped by surface: `content-v2/` (Content table,
metric explorer, comments, site analysis), `coverage/`, `database/`,
`landing/`, `roadmap/`, `story/` (Story mode), `shell/` (masthead, area and
page tabs) and `ui/` (shared primitives: Button, Modal, Tag, Tour, ...).

**Interfaces:** components take typed payload slices as props, or read them
through the `src/data` getters inside the `GalileoData` gate. They read and
write lens state through URL params.

**Constraints:**
- Consume the data contract without changing its meaning: REP and LM stay
  separate, `null` stays distinct from `0`, filtering uses canonical geo, and
  imported arrays are copied before sorting.
- `data-tour` attributes are targets for the tutorial and for
  `src/data/story.json`; renaming one breaks those stops.

**Decisions:** the Content table shows Pieces, Shipments and pieces per
shipment side by side (YTD figure over its YoY chip, plus a sparkline), with
no Metric toggle and no Coverage column. A YoY chip opens the explorer on its
own metric through `?explore=` and `?metric=`.
