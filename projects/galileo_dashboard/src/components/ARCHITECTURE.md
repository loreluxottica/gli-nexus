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
own metric through `?explore=` and `?metric=`. The explorer's trend chart
draws at its container's real width, and "Where the change comes from" ranks
areas under a Global row by absolute change vs last year, with every bar on
one scale; on phones the bar column drops and the printed change remains.

The Content table has fixed column widths (`table-layout: fixed` and a
`<colgroup>`), so switching market or area never moves a column: the labels
are sized to the longest name and the trend columns take the rest, with
sparklines filling them between 112 and 220px. Rows keep one height too:
empty cells match a figure's height and the LM-only flow pill sits under its
site name.

The explorer's `CommentPanel` reads and writes the shared comments API for its
flow and market. A region view shows and saves only that region's comments;
Global shows every area and saves as Global. Author is the signed-in user;
seed comments from
`content_comments.json` show read-only; drafts left in `localStorage` by the
old browser-only version can be published or discarded.
