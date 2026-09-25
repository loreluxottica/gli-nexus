# src/app — routes

**Owns:** Next.js App Router route composition: landing (`page.tsx`), the app
shell `(app)/layout.tsx`, and the routes `content`, `coverage`, `database`,
`styleguide`, `roadmap` (off unless `GALILEO_ROADMAP_ENABLED`) and
`content-v2` (client redirect to `content`, query string kept).

**Interfaces:** each route renders inside the `GalileoData` gate from
`src/data`. Only `content` also requests `site_analysis`; only `database`
loads `db.json`, lazily.

**Constraints:**
- Static export (`output: "export"`, `basePath: /galileo`, trailing slash):
  no server-side data or redirects.
- Lens state (area, market, period, explorer) stays in URL query params so it
  survives navigation and deep links.
- Shared chrome and other routes must not request `db.json`.
