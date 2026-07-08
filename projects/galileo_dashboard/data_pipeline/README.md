# Galileo data pipeline (Databricks → static JSON)

Regenerates the JSON files the Next app bakes in at build time, querying three
Unity Catalog tables instead of the old Excel workbook. This is the real,
runnable replacement for `../reference-data-pipeline/` (kept only as history).

## Sources

| Table | Sheet | Feeds |
|-------|-------|-------|
| `sbx-logistics.gli_nexus.galileo`          | DB       | content.json, db.json, content_trends.json, site_analysis.json |
| `sbx-logistics.gli_nexus.coverage_galileo` | Coverage | content.json → coverage_page |
| `sbx-logistics.gli_nexus.mapping_galileo`  | Mapping  | content.json → database_page.mapping |

Table names are overridable via `GALILEO_TABLE`, `GALILEO_COVERAGE_TABLE`,
`GALILEO_MAPPING_TABLE`.

## Outputs (regenerated)

`../src/data/`: `content.json`, `db.json`, `content_trends.json`, `site_analysis.json`.
Hand-written `content_comments.json` and `story.json` are left untouched.

## Run

```bash
pip install -r data_pipeline/requirements.txt        # once
DATABRICKS_CONFIG_PROFILE=luxottica \
DATABRICKS_WAREHOUSE_ID=2663c9a13af5c078 \
python data_pipeline/run.py
npm run build          # re-bake the static export in out/
# commit src/data/*.json and out/
```

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
