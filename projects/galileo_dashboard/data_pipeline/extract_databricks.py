"""Extract the Galileo source tables from Databricks into raw.json.

Replaces the Excel-based reference-data-pipeline/extract.py. Reads three Unity
Catalog tables and emits the same {"source_file", "sheets": [...]} shape the
build_* scripts consume, so the downstream aggregation logic is unchanged:

    sbx-logistics.gli_nexus.galileo          -> sheet "DB"       (shipment fact)
    sbx-logistics.gli_nexus.coverage_galileo -> sheet "Coverage" (per-site tiers)
    sbx-logistics.gli_nexus.mapping_galileo  -> sheet "Mapping"  (per-plant map)

Every cell is stringified and stripped (mirroring the Excel extractor's
`str(v).strip()`), because the build scripts parse strings (num_or_none,
Coverage == "1"/"94%", etc.). The galileo `Month/Year` DATE column is rendered
as "YYYY-MM" so the reference year_month() regex keeps working.

Connection/auth/identifier-quoting is reused from the Kelly data_loader (the
same helpers Cortana uses).

Run (locally, with a Databricks CLI profile):
    DATABRICKS_CONFIG_PROFILE=luxottica \
    DATABRICKS_WAREHOUSE_ID=2663c9a13af5c078 \
    python data_pipeline/extract_databricks.py
"""
from __future__ import annotations

import datetime as _dt
import json
import os
import sys
from pathlib import Path

# Make kelly_dashboard importable as a top-level package (mirrors app.py).
_PROJECTS = Path(__file__).resolve().parents[2]
if str(_PROJECTS) not in sys.path:
    sys.path.insert(0, str(_PROJECTS))

from kelly_dashboard.data_loader import (  # noqa: E402
    _IDENTIFIER_PART_RE,
    _sql_connect_kwargs,
    _sql_http_path,
)

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data_pipeline" / "data"

# table env var -> (default fully-qualified table, output sheet name)
TABLES = {
    "GALILEO_TABLE":          ("sbx-logistics.gli_nexus.galileo",          "DB"),
    "GALILEO_COVERAGE_TABLE": ("sbx-logistics.gli_nexus.coverage_galileo", "Coverage"),
    "GALILEO_MAPPING_TABLE":  ("sbx-logistics.gli_nexus.mapping_galileo",  "Mapping"),
}


def _quote_table(fq: str) -> str:
    parts = fq.split(".")
    if len(parts) != 3 or not all(_IDENTIFIER_PART_RE.fullmatch(p) for p in parts):
        raise ValueError(f"Invalid table identifier: {fq!r}")
    return ".".join(f"`{p}`" for p in parts)


def _cell(v) -> str:
    """Stringify a cell the way the Excel extractor did (str(v).strip()).

    A DATE (galileo Month/Year) becomes "YYYY-MM" so downstream year_month()
    parsing is unchanged; everything else is str()'d; NULL -> "".
    """
    if v is None:
        return ""
    if isinstance(v, (_dt.date, _dt.datetime)):
        return f"{v.year:04d}-{v.month:02d}"
    return str(v).strip()


def _fetch_sheet(conn, fq: str, sheet_name: str) -> dict:
    table = _quote_table(fq)
    with conn.cursor() as cur:
        cur.execute(f"SELECT * FROM {table}")
        header = [d[0] for d in cur.description]
        rows = [header]
        for r in cur.fetchall():
            rows.append([_cell(v) for v in r])
    # Drop trailing all-blank rows (matches the Excel extractor).
    while len(rows) > 1 and all(c == "" for c in rows[-1]):
        rows.pop()
    return {
        "name": sheet_name,
        "row_count": len(rows),
        "col_count": max((len(r) for r in rows), default=0),
        "rows": rows,
    }


def extract() -> dict:
    http_path = _sql_http_path()
    if not http_path:
        raise SystemExit(
            "No SQL warehouse configured. Set DATABRICKS_WAREHOUSE_ID "
            "(or KELLY_SQL_HTTP_PATH)."
        )
    from databricks import sql as dbsql

    out = {"source_file": "sbx-logistics.gli_nexus.galileo", "sheets": []}
    with dbsql.connect(http_path=http_path, **_sql_connect_kwargs()) as conn:
        for env_var, (default_fq, sheet_name) in TABLES.items():
            fq = os.environ.get(env_var, default_fq)
            sheet = _fetch_sheet(conn, fq, sheet_name)
            out["sheets"].append(sheet)
            print(f"  {sheet_name:<9} <- {fq}  ({sheet['row_count'] - 1} rows)")
    return out


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out = extract()
    dest = OUT_DIR / "raw.json"
    dest.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {dest}  ({dest.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
