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
- `src/` is the frontend; its modules are documented in `src/app`,
  `src/components`, `src/data` and `src/lib`.
- `data_pipeline/` holds the live extraction and transformation;
  `reference-data-pipeline/` holds the historical Excel logic, read-only.

**Constraints:** `CONSTRAINTS.md` (protected pipeline and contracts; how a UI
change ships).

**Details:** `HANDOFF.md` (run, build, data flow; in Italian) and
`DATA_PIPELINE_READTHROUGH.md` (authoritative pipeline and contract guide).

**Fonts today:** Schibsted Grotesk (UI) and Spline Sans Mono (data) via
`next/font`. EssilorLuxottica endorsement in `src/components/shell/Masthead.tsx`.
