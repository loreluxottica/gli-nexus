# Galileo data pipeline (Databricks → payloads)

Turns three Unity Catalog tables into the four payloads the dashboard renders.

These scripts run in **two places, with one implementation**:

- **At runtime**, called by `../data_service.py` on a cache miss. This is how the
  live dashboard gets its data — no build, no commit.
- **Offline**, via `run.py`, writing into `../src/data/` for inspection. Those
  files are gitignored: they are a debugging convenience, not the source.

The two modes differ only in where the files land, through `GALILEO_RAW_JSON`
and `GALILEO_DATA_DIR`.

## Sources

| Table | Sheet | Feeds |
|-------|-------|-------|
| `sbx-logistics.gli_nexus.galileo`          | DB       | content.json, db.json, content_trends.json, site_analysis.json |
| `sbx-logistics.gli_nexus.coverage_galileo` | Coverage | content.json → coverage_page |
| `sbx-logistics.gli_nexus.mapping_galileo`  | Mapping  | content.json → database_page.mapping |

Table names are overridable via `GALILEO_TABLE`, `GALILEO_COVERAGE_TABLE`,
`GALILEO_MAPPING_TABLE`.

## Getting a new month in

1. Drop the CSV into `/Volumes/sbx-logistics/gli_nexus/galileo_volume`.
2. Run `galileo_datauploading.py` (import it into the workspace as a notebook).
   It picks the newest `SQL Source*.csv`, detects its encoding, validates it and
   overwrites the tables.
3. Nothing else. The app rebuilds its payloads within `GALILEO_CACHE_TTL`
   (10 minutes). To see it immediately, `POST /galileo/api/refresh`.

Uploading to the Volume on its own changes nothing — no job watches it. The
notebook is what loads the tables.

## Outputs

`content.json`, `db.json`, `content_trends.json`, `site_analysis.json` — served
from `/galileo/api/*.json`. Hand-written `content_comments.json` and `story.json`
are not produced here and are still imported at build time.

## Run offline

```bash
pip install -r data_pipeline/requirements.txt        # once
DATABRICKS_CONFIG_PROFILE=luxottica \
DATABRICKS_WAREHOUSE_ID=2663c9a13af5c078 \
python data_pipeline/run.py
```

Writes into `../src/data/` (gitignored). Useful to diff a payload or check the
reporting window; the deployed app does not read those files.

Connection/auth reuses `kelly_dashboard/data_loader.py` (the same helpers Cortana
uses): a local CLI profile (`DATABRICKS_CONFIG_PROFILE`) or a service principal.

## Notes / assumptions

- **Reporting window** (`CUR_YEAR` / `PY_YEAR` / YTD months) is derived from the
  data by default; override with `GALILEO_CUR_YEAR` and `GALILEO_YTD_MONTHS`
  (e.g. `GALILEO_YTD_MONTHS=1,2,3,4`).
- **Structural metadata** (the 6 Content rows' category / sub-category /
  coverage% / driver, plus scope) has no source table and is hand-seeded in
  `build_content.py` (`STRUCTURAL_ROWS`). Edit there if the Content taxonomy
  changes.
- **Coverage %**: `coverage_galileo.Coverage` is a per-site percent string
  (`"94%"`). The Coverage page's "Coverage % vol" per area is the **mean** of its
  sites' percentages. Change `build_coverage_efficiency` if a different roll-up
  (e.g. volume-weighted) is wanted.
- **Sites not mapped** (`coverage_page.mappings_under_review`, the panel at the
  bottom of the Coverage page): a site counts as *not mapped* when it has no
  `Galileo Volume`; each one is weighted by its `Estimated Volume` share of the
  product×area total. If `coverage_galileo` carries neither column,
  `build_mappings_under_review` falls back to a `Mapping` flag, then to
  `Coverage == 0`, and reports the sites with a null weight (the UI shows them
  as "under review"). With none of the three it emits `[]` and logs a warning —
  the key is always present, since the frontend type requires it.
- **Area order** (`GEOS` = EMEA → NA → APAC → LATAM) drives `geo_options` and
  `area_options`; it mirrors `GEO_AREAS` in `../src/data/geo.ts`. Keep the two
  in sync or the UI tabs and the payload will disagree.
- **Determinism is a requirement, not a nicety.** Payload ETags are hashes of the
  serialised bytes, so output that varies at identical data makes every client
  re-download on every rebuild. Sort anything derived from a `set` before it
  reaches the JSON — `build_content.py` does this for the `drills` keys and the
  Export Labs list.
- **`Customer Country` is load-bearing.** It drives the Export Labs → EMEA
  reattribution (~60% of Export Labs pieces). A load that drops it fails loudly
  with `KeyError` rather than silently shifting volume from EMEA to APAC.
