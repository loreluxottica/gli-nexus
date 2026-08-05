from __future__ import annotations
import logging
import os
import pandas as pd
from kelly_dashboard.warehouses import get_warehouse
from shared.db import _IDENTIFIER_PART_RE, _sql_connect_kwargs, _sql_http_path

_log = logging.getLogger(__name__)

_cache: dict[str, pd.DataFrame] = {}

# A closed facility-day is recorded as 100% absenteeism (or missing). Days at or
# above this level are treated as non-working (closure), not real absenteeism.
CLOSED_THRESHOLD = 0.99
# A (plant-area, weekday) is classified non-working when at least this share of
# its historical days are closed (NaN or >= CLOSED_THRESHOLD).
CLOSED_DOW_FRACTION = 0.5

def load_data(warehouse_id: str) -> pd.DataFrame | None:
    """Load a plant's data from Unity Catalog, or None when it can't be read.

    None is never substituted with placeholder data: callers render an explicit
    "data unavailable" state instead of a plausible-looking but invented one.
    """
    # Key by day so a long-lived process picks up fresh data after midnight
    cache_key = f"{warehouse_id}:{pd.Timestamp.today():%Y-%m-%d}"
    if cache_key in _cache:
        return _cache[cache_key]

    df = _load_delta(warehouse_id)
    if df is None:
        # Not cached: a transient warehouse error must not pin the plant to
        # "unavailable" for the rest of the calendar day.
        return None

    df["ID"] = df["ID"].apply(_fix_encoding)
    df["Date"] = pd.to_datetime(df["Date"])
    df["Year"] = df["Date"].dt.year
    df["Week"] = df["Date"].dt.isocalendar().week.astype(int)
    df = _add_working_flag(df, warehouse_id)
    _cache[cache_key] = df
    return df


def _add_working_flag(df: pd.DataFrame, warehouse_id: str) -> pd.DataFrame:
    """Tag each row with a boolean ``Working`` for its (plant-area, weekday).

    Working status is inferred from *historical* Actual: a (ID, weekday) is
    non-working when the majority of its past days are closed — Actual missing
    or at/above CLOSED_THRESHOLD (100% "absent"). Closure is marked
    inconsistently across plants (NaN for weekday-only sites, 1.0 for sites that
    log closed weekends), so this single rule covers both. A (ID, weekday) with
    no history defaults to Working=True so new areas are never over-filtered.

    A matching entry in ``working_schedule.AREA_WORKDAY_OVERRIDES`` overrides the
    inferred schedule for that (warehouse_id, area) — the escape hatch for areas
    whose source rows can't reveal their true schedule.
    """
    from kelly_dashboard.working_schedule import AREA_WORKDAY_OVERRIDES

    df = df.copy()
    dow = df["Date"].dt.dayofweek

    today = pd.Timestamp.today().normalize()
    hist = df[df["Date"] < today]
    if hist.empty:
        df["Working"] = True
    else:
        hist_dow = hist["Date"].dt.dayofweek
        closed = hist["Actual"].isna() | (hist["Actual"] >= CLOSED_THRESHOLD)
        frac_closed = closed.groupby([hist["ID"], hist_dow]).mean()
        non_working = set(frac_closed[frac_closed >= CLOSED_DOW_FRACTION].index)

        keys = pd.MultiIndex.from_arrays([df["ID"], dow])
        df["Working"] = ~keys.isin(non_working)

    # Apply explicit per-area overrides (win over inference).
    for (wh, area), workdays in AREA_WORKDAY_OVERRIDES.items():
        if wh != warehouse_id:
            continue
        mask = df["ID"] == area
        if mask.any():
            df.loc[mask, "Working"] = dow[mask].isin(workdays)
    return df


def _fix_encoding(s: str) -> str:
    try:
        return s.encode("latin-1").decode("utf-8")
    except Exception:
        return s


def _qualified_table(warehouse_id: str) -> str | None:
    wh = get_warehouse(warehouse_id)
    table = (wh or {}).get("table")
    uc_schema = os.environ.get("KELLY_UC_SCHEMA", "sbx-logistics.kelly")
    parts = uc_schema.split(".") + [table] if table else []
    if len(parts) != 3 or not all(_IDENTIFIER_PART_RE.fullmatch(p) for p in parts):
        _log.warning("Invalid UC identifiers: schema=%r table=%r", uc_schema, table)
        return None
    return ".".join(f"`{p}`" for p in parts)


def _load_delta(warehouse_id: str) -> pd.DataFrame | None:
    """Load a warehouse's forecast table from Unity Catalog via a SQL warehouse.

    Returns None when unconfigured (no table mapped / no warehouse path) or on
    any failure.
    """
    table = _qualified_table(warehouse_id)
    http_path = _sql_http_path()
    if not table or not http_path:
        return None
    try:
        from databricks import sql as dbsql

        with dbsql.connect(
            http_path=http_path, **_sql_connect_kwargs()
        ) as conn, conn.cursor() as cur:
            # CAST strips the UTC timezone: the rest of the app works with
            # naive dates
            cur.execute(
                f"SELECT CAST(ds AS DATE) AS Date, ID, Actual, Forecast, "
                f"Forecast_Vintage FROM {table}"
            )
            df = cur.fetchall_arrow().to_pandas()
        return df if not df.empty else None
    except Exception:
        _log.exception("Delta load failed for %s", warehouse_id)
        return None
