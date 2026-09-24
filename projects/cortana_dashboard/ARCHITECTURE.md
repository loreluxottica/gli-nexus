# cortana_dashboard — Cortana Usage Monitor

**Owns:** the Cortana usage report, rendered server-side.

**Interfaces:**
- Blueprint `bp` in `server.py`, mounted at `/cortana/` (single route `/`).
- `cortana.html` is standalone HTML (Chart.js, neon theme) with `__TOKEN__`
  placeholders that `_render()` replaces.
- Data from `CORTANA_USAGE_TABLE` (default
  `sbx-logistics.gli_nexus.cortana_usage`), cached `CORTANA_CACHE_TTL_S`
  (300 s).

**Constraints:**
- Gated by project key `CORTANA`; otherwise a 403 "Access restricted" page.
- Every placeholder in `cortana.html` must have a value in `_render()`;
  user-facing values are HTML-escaped before they are inserted.

**Known gap:** the `server.py` docstring and the root `README.md` still call
`cortana.html` a `str.format` template.
