# Galileo frontend read-through: protect the data pipeline

This is the authoritative guide for building Galileo frontend features without
breaking the Databricks-to-frontend path. Read it before editing Galileo.

The central rule is simple:

> Frontend work consumes the existing typed JSON contract. It does not alter
> ingestion, table schemas, extraction, aggregation semantics, tuple positions,
> generated JSON, or the committed static export unless the user explicitly
> requests a Galileo data-contract change.

The upstream loader is tracked as
`data_pipeline/galileo_datauploading.py` and is imported into Databricks as a
notebook. Its operational contract is recorded here so cleanups and audits
cannot accidentally reinterpret it.

## 1. Read the system from left to right

```text
semicolon CSV files in the Databricks volume
                    |
                    v
data_pipeline/galileo_datauploading.py: route, cast, overwrite three tables
                    |
                    v
server.py /galileo/api/*.json -> data_service.py cache
                    |
                    v
extract_databricks.py -> temporary raw.json
                    |
                    v
build_content.py -> temporary content.json + db.json
                    |
                    +-> build_content_trends.py -> temporary content_trends.json
                    |
                    +-> build_site_analysis.py  -> temporary site_analysis.json
                    v
src/data/api.ts -> GalileoData gate -> Next.js routes/components

Separately: Next.js source -> npm run build -> committed out/ static shell
```

The browser never queries Unity Catalog directly. It fetches typed payloads
from the authenticated Flask API; on a cache miss, `data_service.py` runs the
same extraction and transformation scripts into a temporary directory. The
payloads are not baked into `out/`. A frontend component therefore cannot fix
source-data semantics, and a visual refactor must not rewrite the producer
contract.

## 2. Immutable upstream upload contract

The Databricks upload job reads files from:

```text
/Volumes/sbx-logistics/gli_nexus/galileo_volume
```

It lists the files once and routes them by case-sensitive filename base. Every
recognized input is a CSV with a header, semicolon separator (`;`), and schema
inference disabled.

| Filename base | Destination table | Required behavior |
| --- | --- | --- |
| `SQL Source <English month>` | `sbx-logistics.gli_nexus.galileo` | From all basenames starting with `SQL Source`, rank the English month names January=1 through December=12, process only the highest-ranked file, and skip the rest. The chosen file already contains all preceding data. Overwrite the table. |
| `Coverage Galileo` | `sbx-logistics.gli_nexus.coverage_galileo` | Process an exact basename match and overwrite the table. |
| `Mapping Galileo` | `sbx-logistics.gli_nexus.mapping_galileo` | Process an exact basename match and overwrite the table. |

For `SQL Source`, preserve these casts before writing:

- `Month/Year`: parse with Spark date pattern `d/M/yyyy`.
- `Pieces`: `try_cast` through `double`, then cast to `bigint`.
- `Shipments`: `try_cast` through `double`, then cast to `bigint`.

All three writes use overwrite mode with `overwriteSchema=true`. Unrecognized
files are skipped. Do not turn overwrite into append, process more than the one
selected SQL Source file, change the delimiter, enable inference, rename the
tables, normalize headers, or change the casts as part of cleanup or frontend
work.

The month selection is deliberately the recorded behavior: it ranks the month
word in the filename; it is not a filesystem-time or year-aware comparison.
An audit may flag that behavior for discussion but must not silently fix it.

## 3. Immutable repository extraction contract

[`data_pipeline/extract_databricks.py`](data_pipeline/extract_databricks.py)
queries the three tables and emits one compatibility payload at
`data_pipeline/data/raw.json`:

| Table | Raw sheet alias | Downstream use |
| --- | --- | --- |
| `sbx-logistics.gli_nexus.galileo` | `DB` | Content metrics, database rows, trends, site analysis, top sites |
| `sbx-logistics.gli_nexus.coverage_galileo` | `Coverage` | Coverage blocks and sites not mapped |
| `sbx-logistics.gli_nexus.mapping_galileo` | `Mapping` | Database-page mapping reference |

The table names can be overridden only through `GALILEO_TABLE`,
`GALILEO_COVERAGE_TABLE`, and `GALILEO_MAPPING_TABLE`. Identifiers must remain
three-part, validated, and SQL-quoted.

Extraction intentionally uses `SELECT *` because it preserves source headers
for header-name lookup downstream. Each cell is stringified and stripped,
`NULL` becomes an empty string, and date/datetime cells become `YYYY-MM`. The
raw payload shape remains:

```text
{
  "source_file": "...",
  "sheets": [
    {"name": "DB", "row_count": ..., "col_count": ..., "rows": [header, ...]},
    {"name": "Coverage", ...},
    {"name": "Mapping", ...}
  ]
}
```

Those aliases, header spelling, cell normalization, and date representation are
join and parser contracts. Do not tidy or type-coerce them in the extractor.

## 4. Source columns and business semantics that must survive

### Main `galileo` table

The builders address columns by exact header name. At minimum, preserve:

| Header | Meaning in the frontend |
| --- | --- |
| `Month/Year` | Reporting year/month and cumulative YTD windows |
| `Site` | Plant drill-downs, top sites, database rows |
| `Market` | Separate `REP` and `LM` metrics; other values are excluded from metric aggregation |
| `Product` | Maps facts to one of the six Content rows |
| `Site Type` | Completes the Product + Site Type mapping to a Content row |
| `Pieces` | Content volume metric; it must not be used as Coverage estimated volume |
| `Shipments` | Shipment and efficiency metrics |
| `Geographical Area` | Raw displayed geo and default canonical geo |
| `Accounting Area` | Independent accounting scope |
| `Customer Country` | Destination rule used to derive canonical geo |

The Content mapping is exact:

| Product | Required Site Type | Category | Sub-category |
| --- | --- | --- | --- |
| `Finished Frames` | Any | `Frames` | `Finished Frames` |
| `GV Frames` | Any | `Frames` | `GV Frames*` |
| `Stock Lenses` | <code>Mass Production &#124; DCs</code> | `Stock Lenses` | <code>Mass Production &#124; DCs</code> |
| `RX` | `Export Labs` | `RX Lenses` | `Export Labs` |
| `RX` | `Nearshore Labs` | `RX Lenses` | `Nearshore Labs` |
| `RX` | `Local Labs to ECP` | `RX Lenses` | `Local Labs to ECP` |

Other Product + Site Type combinations do not feed the six Content metric rows.

Canonical geographical attribution has one non-obvious business rule: an
`Export Labs` row whose `Customer Country` is `EMEA` is counted in `EMEA`, even
when its raw production geography says APAC. Everywhere else, canonical geo is
the raw `Geographical Area`. All Content calculations, trends, site analysis,
filters, and top-site logic must keep using the same canonical rule.

The reporting window is also semantic logic:

- Current year defaults to the greatest valid source year; prior year is
  current year minus one.
- `GALILEO_CUR_YEAR` can override the current year.
- `GALILEO_YTD_MONTHS` can override the YTD months.
- Otherwise YTD is the contiguous run from January whose monthly Pieces are at
  least 10% of the busiest current-year month. This excludes pre-populated,
  near-zero future months.
- Current and prior metrics use the same selected YTD months.
- YoY is `(current - prior) / prior`; when prior is zero, YoY is `null`, not
  zero. The UI must preserve the distinction between missing baseline and a
  measured zero.

The six structural Content rows, their order, coverage metadata, and driver
labels are hand-seeded in `STRUCTURAL_ROWS`. Their category/sub-category text is
also a join key for trends, periods, comments, and site analysis. Do not rename,
reorder, or casually extract it into another abstraction.

### `coverage_galileo` table

`Coverage Galileo.csv` mirrors the authoritative `Galileo Frontend.xlsx`
Coverage sheet. The active builder requires the exact headers `Site`,
`Product`, `Site Type`, `Galileo Volume`, `Estimated Volume`, `Area`,
and `Automation`; it fails before generation if any is missing. `Market` is
expected in the mirrored CSV, while precomputed `Coverage` and `Covered 2025`
columns may remain for traceability. The builder recomputes the published
percentage. `Automation` normalizes to `Low`, `Mid`, or `High`.

Important semantics:

- Coverage is calculated at Product + Area grain using the frontend Excel
  formula: each row contributes its full `Estimated Volume` to the numerator
  when `Galileo Volume > 0`, and zero otherwise.
- `Coverage % vol` is `sum(covered Estimated Volume) / sum(Estimated Volume)`.
- Volume math counts every matching CSV row, including duplicate site names.
- `Tot sites` and Low/Mid/High Automation shares count distinct site names.
- `Estimated Volume` comes only from `Coverage Galileo.csv`; main-table `Pieces`
  must not replace or alter it.
- A site is not mapped when all of its rows have `Galileo Volume <= 0`. Its
  weight is its `Estimated Volume` share of the Product-family + Area total.
- A missing or zero estimated-volume denominator produces `null`, which the
  frontend intentionally displays as under review.
- Finished Frames and GV Frames fold into the `Frames` family in the not-mapped
  panel.

Legacy `Mapping` and `Coverage == 0` branches remain inside the not-mapped
helper for isolated historical inputs. They are not accepted by the active
production build: the required `Galileo Volume` and `Estimated Volume`
validation runs first.

### `mapping_galileo` table

The mapping builder accepts documented header aliases, but `Product` and `Site
Type` must resolve or the mapping table is rejected. The table can provide site,
raw site, market, area, source, owner, flow, note, and explicit Content
destination fields. If usable mapping data is absent, the builder deliberately
falls back to distinct Product + Site Type pairs derived from the DB table.

The JSON value `mapping_source: sheet` is a historical compatibility label; in
the active pipeline it means the Databricks `Mapping` sheet alias, not that the
frontend still reads Excel.

## 5. Generated frontend contract

Runtime order is fixed:

```text
GET /galileo/api/<payload>.json
  1. data_service.py checks the in-process TTL cache
  2. extract_databricks.py reads the three Unity Catalog tables
  3. build_content.py produces content.json + db.json in a scratch directory
  4. build_content_trends.py produces content_trends.json
  5. build_site_analysis.py produces site_analysis.json
  6. server.py returns the bytes with an ETag
```

`python data_pipeline/run.py` uses the same scripts offline and writes the four
files into `src/data/` for inspection. Those copies are gitignored and are not
production build inputs. `npm run build` independently regenerates the static
application shell in `out/`.

The runtime payload contract is:

| File | Producer | Main consumers |
| --- | --- | --- |
| `content.json` | `build_content.py` | Landing, masthead, Content, Coverage, Database config |
| `db.json` | `build_content.py` | Lazy-loaded Database rows; input to trends and site analysis builders |
| `content_trends.json` | `build_content_trends.py` | Content sparklines and metric explorer |
| `site_analysis.json` | `build_site_analysis.py` | Site mentions, site drill, top driver sites |

`content_comments.json` and `story.json` are hand-authored and are not pipeline
outputs.

[`src/data/types.ts`](src/data/types.ts) is the authoritative frontend shape.
Especially fragile contracts are:

- `MarketMetrics` keeps current, prior, and nullable YoY for REP and LM.
- Period snapshots keep row order aligned with `current_view.rows`.
- Flow keys use exact `Category|Sub-category` text.
- Per-site metric arrays keep this eight-position order: REP Pieces current,
  REP Pieces prior, REP Shipments current, REP Shipments prior, LM Pieces
  current, LM Pieces prior, LM Shipments current, LM Shipments prior.
- `DbRow` is an 11-position tuple. Indices 0-9 are display data; index 10 is
  canonical geo.
- `database_page.geo_col` is 10. Never filter the Database using displayed raw
  geo at tuple index 7.
- Geo order is `ALL, EMEA, NA, APAC, LATAM` and must agree between the builder
  and `src/data/geo.ts`.

The TypeScript loaders in `src/data/api.ts` fetch and memoize these payloads.
`GalileoData.tsx` holds back rendering until the required payloads arrive, and
the Database payload remains lazy so it is downloaded only for that route. Do
not make shared chrome or unrelated routes request `db.json` for convenience.

`out/` is generated but committed because `server.py` serves it directly. Do
not hand-edit or delete it during cleanup. It changes only after an authorized
`npm run build`.

## 6. How to add a frontend feature safely

### A. Classify the feature before coding

1. **Presentation-only:** layout, styling, accessibility, copy, interaction, or
   navigation using data already passed to the component. Work only in the
   component, CSS module, or route composition.
2. **New view of existing data:** calculate a display value in an additive
   selector/helper in `src/lib/` or a view model near the component. Keep source
   units, null behavior, geo attribution, and REP/LM separation unchanged.
3. **New data requirement:** any new source column, table, aggregation, JSON
   property, tuple element, area rule, or time-window rule is a pipeline change.
   Stop and obtain an explicit request to change the Galileo data contract.

### B. Follow the data slice to its owner

| Feature area | Start reading | Build the feature in |
| --- | --- | --- |
| Content metrics, periods, sparklines | `src/app/(app)/content/page.tsx`, then `ContentViewV2.tsx` and `ContentTableV2.tsx` | `src/components/content-v2/`, CSS modules, additive `src/lib/` selectors |
| Coverage, automation, not-mapped sites | `src/app/(app)/coverage/page.tsx`, then `CoverageView.tsx` | `src/components/coverage/`, CSS modules, view-only selectors |
| Database table, filters, mapping | `src/app/(app)/database/page.tsx`, then `DatabaseView.tsx` | `src/components/database/`; keep the existing lazy `db.json` import and config indices |
| Shared area/period/page navigation | `src/components/shell/` | Shell components; reuse `isGeoArea`, `areaLabel`, and existing URL query conventions |
| Static narrative features | `content_comments.json`, `story.json`, `src/data/roadmap.ts` | Their existing hand-authored data and consuming components, never derived JSON |

### C. Consume; do not mutate

- Import types with `import type` and accept the smallest existing slice through
  props.
- Treat JSON-derived objects and arrays as immutable. Sort copies such as
  `[...rows]`, not imported arrays in place.
- Keep `REP` and `LM` separate; their units and meaning are not interchangeable.
- Preserve `null` versus `0`. Do not coerce nullable YoY, coverage, weights, or
  volumes with `|| 0` unless the existing display contract explicitly does so.
- Use canonical geo for calculations and filtering; raw geo is display-only.
- Keep area state in the established `?area=` URL parameter so shared shell and
  routes stay synchronized.
- Keep heavy data route-local and lazy. Prefer a small precomputed view model
  from the existing page payload over importing `db.json` into a new route.
- Never make a component write to generated JSON or Unity Catalog.

### D. Verify the feature without regenerating production data

From `projects/galileo_dashboard/`, run:

```text
npm run typecheck
npm run build
```

For full UI checks, run against the Flask API or a controlled API fixture. Then
exercise Global plus EMEA, NA, APAC, and LATAM, both REP and LM where present,
latest and an earlier YTD period, zero values, null baselines, empty
coverage/mapping states, and the Database filter/pagination path. Confirm the
feature did not make an unrelated route request `db.json`.

## 7. Protected and safe change zones

| Zone | Normal frontend feature | Cleanup or audit |
| --- | --- | --- |
| `src/components/**`, component CSS | Safe when consuming the existing contract | May edit, subject to normal behavior checks |
| `src/app/**` route composition | Safe when data loading boundaries remain intact | May edit cautiously |
| Additive display helpers in `src/lib/**` | Safe when semantics stay view-only | May edit cautiously |
| Hand-authored narrative files | Edit only when the requested feature owns that content | Do not treat as generated or dead data |
| `data_pipeline/*.py` | Protected; explicit pipeline request required | Read-only; report findings only |
| `reference-data-pipeline/**` | Protected historical logic | Read-only; do not modernize or delete |
| Contract/loaders in `src/data/*.ts` | Protected; explicit contract request required | Read-only; report findings only |
| Runtime payloads and offline generated JSON copies | Never hand-edit; generate through the pipeline | Do not format, deduplicate, truncate, or commit |
| `out/**` | Regenerate only after an authorized build | Do not hand-edit, prune, or delete |

Generic requests such as clean the repo, remove dead files, format all, audit
and fix, simplify the data code, or upgrade everything leave all protected zones
untouched. An audit can identify a risk in them and recommend a separate,
explicit change; it cannot apply that change.

## 8. If a pipeline change is explicitly authorized later

Treat it as an end-to-end contract migration, never a drive-by frontend edit:

1. Name the source table/header and business meaning being changed.
2. Record whether the change affects upload routing, table schema, extraction,
   normalization, aggregation, JSON shape, TypeScript types, or a consumer.
3. Prefer additive, backward-compatible fields before removals or renames.
4. Update every duplicate semantic mapping together, especially
   `sheet1_key_for`, canonical geo, geo order, tuple indices, and period logic.
5. Generate all four derived payloads through `data_pipeline/run.py` in a
   controlled environment; never patch them by hand.
6. Validate row counts, years/months, six Content keys, geo totals, REP/LM
   totals, nullable YoY cases, coverage blocks, mapping source, and tuple width.
7. Run `npm run typecheck`; when frontend code changes, also run `npm run build`
   and inspect the resulting `out/` application across all feature areas.
8. Commit the pipeline change, types/consumers, documentation, and any required
   rebuilt `out/` as one reviewable migration. Do not commit offline payloads.

Without that explicit authorization, the correct implementation strategy is to
adapt the frontend feature around the existing contract and leave this path
untouched.
