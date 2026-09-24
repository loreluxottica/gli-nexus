# kelly_dashboard — Project Kelly

**Owns:** absenteeism forecast per plant (Dash): landing globe, per-plant
forecast and performance pages, weather and holiday context.

**Interfaces:**
- `app.py` exposes `server` (WSGI). Mounted at `/kelly/` through
  `KELLY_URL_PREFIX`; standalone `python app.py` serves `/` on port 8050.
- `data_loader.load_data(warehouse_id)` reads the per-plant Unity Catalog
  tables mapped in `warehouses.py` (schema `KELLY_UC_SCHEMA`).
- External services: Open-Meteo weather (in-memory cache) and the Mapbox GL
  JS globe (`MAPBOX_TOKEN`, `MAPBOX_STYLE`).

**Constraints:**
- Unity Catalog is the only data source. On failure the loader returns `None`
  and the page shows "DATA UNAVAILABLE"; never substitute placeholder data.
- The app is gated by project key `KELLY`; each plant page also checks
  `shared.auth.is_authorized(<plant id>)`. `pages/denied.py` is the denied state.
- Internal deep links still use absolute paths and are not yet wired for the
  `/kelly/` mount (root `README.md`, Note).
- Fonts today: Avenir LT Std (`assets/fonts/`).
