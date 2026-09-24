# projects

**Owns:** one folder per product mounted by the root `app.py`.

**Interfaces:** two mount patterns.
- Full WSGI sub-app (Kelly, Dash): exposes `server`, reads its URL prefix from
  an env var that `app.py` sets before the import (`KELLY_URL_PREFIX`), and is
  listed in `MOUNTS`.
- Flask blueprint (Cortana, Galileo, Laplace): exposes `bp` in
  `<name>/server.py`, registered with `url_prefix="/<name>"`.

Every project gates its pages with `shared.auth` on its project key (`KELLY`,
`CORTANA`, `GALILEO`, `LAPLACEPIPELINE`, `FLAGS`) and appears in
`portal/js/worlds-data.js` with its link and key.

**Constraints:**
- Projects are imported as top-level packages: `app.py` puts `projects/` and
  the repo root on `sys.path`. Kelly must stay runnable standalone
  (`python app.py`).
- Runtime Python dependencies must be reachable from the root
  `requirements.txt` (Kelly's via `-r`); that is what Databricks Apps installs.
- Each project folder keeps its own `ARCHITECTURE.md`.
