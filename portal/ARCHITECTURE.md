# portal

**Owns:** the GLI Nexus launcher served at `/`: one static page (`index.html`)
with gate, single-product view, detail cards and launcher dialog. No build step.

**Interfaces:**
- Served by `app.py` routes `/`, `/css/*`, `/js/*`, `/assets/*` and
  `/GLI-Branding/*` (kept one compatibility cycle for cached pages).
- Reads `/api/my-access` (`js/access.js`) to open or restrict each product.
- Product roster: `js/worlds-data.js` (`NEXUS_WORLDS`: link and access project
  key). Detail cards: `js/detail-data.js` (`NEXUS_DETAILS`).

**Constraints:**
- Every destination starts closed until `/api/my-access` answers. The API
  tells a failed lookup (`error: lookup_failed`) apart from an empty grant
  list; the UI must not show a failed lookup as "Access restricted".
- Keep the script load order in `index.html`; design tokens live only in
  `css/tokens.css`.
- `tests/test_portal.py` requires every local asset referenced by
  `index.html` to exist.
- Fonts today: Avenir LT Std for UI and display, IBM Plex Mono for data. The
  EssilorLuxottica endorsement is in the shell.

**Details:** `FRONTEND-READTHROUGH.md`.
