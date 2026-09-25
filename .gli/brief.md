# Galileo - flow site exploration

## Confirmed task

From Content, users need both quick lookup of a specific contributing site
and deeper exploration beyond the top-three drivers. Selected sites can be
compared side by side; combining them into a new total is not requested.

The user approved a dedicated, full-width flow site view, reachable through
`View sites` on Content and `View all sites` in the existing metric explorer.
It is part of Content, not a new unrelated primary-navigation section.

## Required behavior

- Preserve the flow, geographical area, REP/LM market and selected YTD period.
- Search all contributing sites in that context, not just visible results.
- Distinguish ranking by size from ranking by absolute year-over-year change.
- Show Pieces, Shipments and pieces per shipment with comparable baselines.
- Site detail stays scoped to the originating flow, area, market and period.
- Keep selected sites when searching for another site.
- Preserve search, sort, selection and position when returning from detail.
- Keep the flow total independent of search and selection.
- Support meaningful links and browser-back navigation.
- Keep missing baselines distinct from measured zeroes.

## Existing evidence and boundaries

`MetricExplorer.tsx` truncates its site ranking with `slice(0, 3)`.
`flow_site_metrics` already contains per-site current/prior Pieces and
Shipments at period, flow and canonical geographical-area grain, separately
for REP and LM. Use this existing contract for list, detail and comparison.
The current general `SiteAnalysis` is not scoped to the originating flow or
selected period and must not silently substitute for contextual detail.

Accounting-area site exploration is not supported by this payload.
No new monthly site-history contract, arbitrary site aggregate, database
schema, ingestion change or other product work is authorized by this brief.
Do not load the raw Database payload for this feature.

## Identity and design status

Preserve the incumbent Galileo daylight palette, Schibsted Grotesk UI,
Spline Sans Mono data, and EssilorLuxottica shell. This is a feature
extension, not a font migration or rebrand.

The user selected **B: list and detail** after inspecting three
medium-fidelity layouts with the same synthetic data and scope.
The left search/list pane stays mounted while the right pane switches
between a scoped site's detail and side-by-side comparison. On narrow screens
the panes stack, and explicit detail actions bring the detail into view.

The refined workspace header reads `Area · Market · Category / Sub-category`.
The separate context subtitle and flow-total summary strip are removed to
prioritize list and comparison space. Keep the period selector and the scoped
metrics/denominators; this refinement changes presentation only.

Search and ordering sit on one row so the site list keeps the height. Do not
explain persistent selection with a sentence: show it with the count badge,
selected-row tint and the count remaining while search changes the list.
Prefer color, size and state over explanatory copy in this workspace.
On desktop the list box and the detail box end on the same bottom edge.
Do not restore the site-detail scope sentence.
Selected sites can download a Database-format CSV: same columns and monthly
source rows, scoped to the active flow, area, market and YTD months.

Local preview artifacts and screenshot-bound observations are gitignored in
`.gli-preview/flow-sites/`. The recorded choice is B on snapshot
`d227c71c7340d0ad134ca68ad5d8482fbe07f9c445b31d97890a142063febdb8`.
The previews
do not implement production routing, data loading or shared links, and are
not evidence of a production implementation or real business data.

Implementation lives at `content/sites`: native URL state preserves search,
ordering, site-list page, active site and repeated selected-site names.
The list pages at 25 rows without restricting how many contributors can be
searched or selected. Comparison uses a horizontal scroll region rather
than an arbitrary selection cap. Unavailable selections remain visible as
unavailable when the scope changes. No silent period or Global fallback.

## Outcome to verify after implementation

Users can open a flow's full site list directly, find a site outside the top
three, compare selected sites without leaving their scope, and return without
reconstructing their working state. Verify the real journeys, not only the
presence of controls.

## Implementation verification

The implemented route was exercised in Edge with intercepted synthetic API
fixtures (35 sites, two periods, multiple areas, and zero/missing baselines).
Verified Content/explorer entry, full-list search and paging, preserved
selection and list scroll, scoped detail/comparison, browser Back, shared URL
restoration, keyboard focus, mobile layout and explicit API-failure states.
The existing TypeScript check and nine pure-helper regressions pass.
Live Databricks data was not exercised. The user authorized regenerating the
deployment export and publishing the branch; `out/` now includes `content/sites`.
The user also authorized rebuilding the export for the later compact-header
refinement; `out/` now includes the contextual title and expanded site list.
The user then authorized another export for the one-row search and ordering
controls and the visual selection state; `out/` includes that revision.
