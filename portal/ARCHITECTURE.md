# portal

**Owns:** the GLI Nexus launcher served at `/`: one static page (`index.html`)
with gate, single-product view, detail cards and launcher dialog. No build step.

**Interfaces:**
- Served by `app.py` routes `/`, `/css/*`, `/js/*`, `/assets/*` and
  `/GLI-Branding/*` (the eleven legacy URLs alias canonical assets, without
  keeping a second copy on disk).
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
  `index.html` to exist and prevents duplicate image/font copies.
- Published screenshots live only in `assets/`. `Project Details/`
  retains original intakes and distinct source captures, not copies of the
  published screenshots.
- Fonts: Geist for UI, Sora for display, IBM Plex Mono for data
  (`--font-ui`, `--font-display`, `--font-mono`), loaded from Google Fonts in
  `index.html` until a self-host policy is decided; no font files in the
  portal. The EssilorLuxottica endorsement is in the shell.
- Gate (`css/gate.css`, `js/gate.js`, `js/gate-bg.js`): first visit per
  session only; returns and deep links skip it. `GateBG` draws a WebGL
  corridor of GLI monoliths; without WebGL `init()` returns false and the
  gate falls back to a static CSS background (`is-static`), and reduced
  motion shows the lit corridor still. The lockup waits for Sora and Geist
  (at most 1.5 s), so the wordmark never shows in a fallback face. Open Nexus
  runs a 1.3 s warp; the app and the suite (`launcher.js`) activate under the
  full light at 92%, then the gate fades onto the open suite. The gate must
  stay above the launcher and detail layers (z-index 70 over 60).

**Details:** `FRONTEND-READTHROUGH.md`.
