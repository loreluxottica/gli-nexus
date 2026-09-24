# laplace_dashboard — Laplace Pipeline Monitor

**Owns:** serving the customs-pipeline HTML report produced by the Laplace
Databricks notebook, plus the Flags Excel download.

**Interfaces:**
- Blueprint `bp` in `server.py`, mounted at `/laplace/`.
- `/` serves the newest `LAPLACE_HTML_PREFIX*.html` file in the Unity Catalog
  volume `LAPLACE_HTML_DIR` (default
  `/Volumes/sbx-logistics/gli_nexus/nexus_volume`), read through the
  Databricks Files API and cached `LAPLACE_CACHE_TTL_S`.
- `/flags-download` serves the Flags Excel file from the same volume.
- `data_pipeline/publish_to_nexus.py` is a reference copy of the notebook's
  publish cell; the app never imports it.

**Constraints:**
- `/` is gated by `LAPLACEPIPELINE`, `/flags-download` by `FLAGS`.
- A notebook run refreshes the page with no redeploy.

**Known gap:** `publish_to_nexus.py` still appends to the `laplace_report`
table, while `server.py` reads the volume, and the root `README.md` still
describes the table. Confirm which one the notebook uses before changing
either.
