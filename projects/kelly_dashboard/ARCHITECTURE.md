# kelly_dashboard — Project Kelly

**Owns:** absenteeism forecast per plant (Dash): landing globe, per-plant
forecast and performance pages, weather and holiday context.

**Interfaces:**
- `app.py` exposes `server` (WSGI). Mounted at `/kelly/` through
  `KELLY_URL_PREFIX`; standalone `python app.py` serves `/` on port 8050.
- `data_loader.load_data(warehouse_id)` reads the per-plant Unity Catalog
  tables mapped in `warehouses.py` (schema `KELLY_UC_SCHEMA`).
- Forecast data retains one successful daily frame per plant, replaced on
  refresh. Per-plant locks coalesce concurrent misses without blocking other
  plants. Waiters share a failed attempt instead of queuing repeated SQL
  timeouts; later requests can retry immediately. A failed refresh returns
  unavailable, never yesterday's frame.
- External services: Open-Meteo weather (in-memory cache) and the Mapbox GL
  JS globe (`MAPBOX_TOKEN`, `MAPBOX_STYLE`).
- Nager public holidays cache successful country/year responses, including
  valid empty lists. Request failures and invalid top-level responses are
  logged and retried after 30 seconds, not cached as a permanent empty calendar.

**Constraints:**
- Unity Catalog is the only data source. On failure the loader returns `None`
  and the page shows "DATA UNAVAILABLE"; never substitute placeholder data.
- The app is gated by project key `KELLY`; each plant page also checks
  `shared.auth.is_authorized(<plant id>)`. `pages/denied.py` is the denied state.
- Internal links use `dash.get_relative_path` in both mounted and standalone
  runs. The portal return link is shown only when mounted.
- Fonts today: Avenir LT Std (`assets/fonts/`).

**Regression checks:** `tests/test_kelly_cache.py` covers cache bounds, daily
refresh, concurrency, failure recovery and the existing data enrichment.
