# src/app — routes

**Owns:** Next.js App Router route composition: landing (`page.tsx`), the app
shell `(app)/layout.tsx`, and the routes `content`, `content/sites`, `coverage`, `database`,
`styleguide`, `roadmap` (off unless `GALILEO_ROADMAP_ENABLED`) and
`content-v2` (client redirect to `content`, query string kept).

**Interfaces:** each route renders inside the `GalileoData` gate from
`src/data`. Only `content` and its `content/sites` drill request `site_analysis`; only `database`
loads `db.json` for browsing, lazily. An explicit CSV action in `content/sites`
can also load it; both reuse the memoized payload.

**Constraints:**
- Static export (`output: "export"`, `basePath: /galileo`, trailing slash):
  no server-side data or redirects.
- Lens state (area, market, period, explorer) stays in URL query params so it
  survives navigation and deep links.
- Shared chrome and other routes must not request `db.json`.

`content/sites` is the dedicated flow site workspace (the Content tab remains
active). It validates the flow, market, canonical area and period in the URL,
then reads existing scoped site metrics. Raw records load only for an explicit
CSV action; `View records` opens the existing Database route instead.
`q`, `sort`, `page`, `site`, repeated `selected`, and `compare=1` preserve the
working state. Detail/comparison navigation adds browser-history entries;
search, sorting, pagination and selection replace the current entry.

`database` receives Content's small reporting metadata plus its existing
column/filter config. `records=sites` opts into the selected-site source scope;
the link includes the reporting year and current/prior YTD end month.
Database refinements use `db-q`, `db-<filter key>` and `db-page`, preserving
the original Sites parameters for return navigation and shared links.
