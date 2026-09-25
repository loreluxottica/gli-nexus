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

`FlowSitesView` implements the approved list-and-detail layout at
`content/sites`. Content rows expose `View sites`; explorer summaries expose
`View all sites`, and driver names open the same workspace at that site.
The left list supports search across all contributors, size/absolute-change
ordering, 25-site pagination and persistent multi-selection. The right pane
shows either scoped site metrics or a horizontally scrollable comparison.
On desktop its position stays below the shared shell while scrolling, and
the list height adapts to the viewport.
Comparison never sums selected sites, and search never changes flow totals.
The workspace header combines area, market, category and sub-category in one
title. There is no subtitle or flow-total strip; the period control remains
available and the reclaimed height is assigned to the site list. Flow totals
still provide the denominator for the selected site's contribution.
Search and ordering share one control row. Selection is a count badge plus
row tint, not an explanatory sentence; the count stays visible while a search
hides unselected rows. A filtered count uses the accent; YoY stays color.
On desktop the site list and detail panes share one height, so their bottoms
align; the list scrolls inside that height. The site-detail scope note is not
shown.
Download CSV exports the selected sites as Database source rows: same columns
and monthly grain, limited to the active flow, area, market and YTD months.
Search and paging do not change the file. The database payload loads on click.

The URL owns scope and working state; native History updates integrate with
Next's search params without fetching on every keystroke. The left pane stays
mounted while detail/comparison changes. Explicit detail actions move focus
to the right pane (and bring it into view on phones); returning focuses search.
Names absent in a changed scope remain explicitly unavailable, not zero.
Site detail uses `flow_site_metrics`, never the general `sites` summary.
Comments' general site-mention summary remains separate and unchanged.
