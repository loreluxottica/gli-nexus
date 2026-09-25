# galileo_dashboard — Galileo Observatory

**Owns:** Content, Coverage and Database views of Galileo shipment volumes: a
Next.js static export served by Flask, with data built at runtime from Unity
Catalog.

**Interfaces:**
- `server.py` blueprint at `/galileo/`: serves `out/` and
  `/api/<name>.json`, `/api/status`, `POST /api/refresh`. Pages and API are
  gated by project key `GALILEO`; static assets are not.
- `data_service.py` builds and caches the four payloads (TTL
  `GALILEO_CACHE_TTL`) by running the `data_pipeline/` scripts in a temporary
  directory.
- Shared KPI comments: `GET` / `POST /api/comments` and
  `DELETE /api/comments/<id>`, backed by `comments_store.py` and the Delta
  table `GALILEO_COMMENTS_TABLE` (default
  `sbx-logistics.gli_nexus.galileo_comments`). An admin creates the table and
  grants the app service principal `SELECT, MODIFY` once, with
  `comments_table.sql`; the app never creates or alters it.
- `src/` is the frontend; its modules are documented in `src/app`,
  `src/components`, `src/data` and `src/lib`.
- `data_pipeline/` holds the live extraction and transformation;
  `reference-data-pipeline/` holds the historical Excel logic, read-only.

**Constraints:** `CONSTRAINTS.md` (protected pipeline and contracts; how a UI
change ships). For comments:
- The author is always the signed-in identity (`X-Forwarded-Email`, or
  `local-dev` in a local run), never a field from the request.
- Only the author can delete a comment, and emails never leave the server.
- `POST` accepts JSON only, which blocks cross-site form posts.
- An unreachable table returns 503, never an empty thread.

Content also links to a full-width `content/sites` workspace for scoped site
lookup and side-by-side comparison. It consumes the existing site-analysis
payload (no new database or pipeline contract). Product scope and approved
layout: `../../.gli/brief.md`.

**Details:** `HANDOFF.md` (run, build, data flow; in Italian) and
`DATA_PIPELINE_READTHROUGH.md` (authoritative pipeline and contract guide).

**Fonts today:** Schibsted Grotesk (UI) and Spline Sans Mono (data) via
`next/font`. EssilorLuxottica endorsement in `src/components/shell/Masthead.tsx`.
