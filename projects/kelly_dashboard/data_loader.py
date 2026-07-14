from __future__ import annotations
import logging
import os
import re
import zlib
import numpy as np
import pandas as pd
import kelly_dashboard.config as config
from kelly_dashboard.warehouses import get_warehouse

_log = logging.getLogger(__name__)

_cache: dict[str, pd.DataFrame] = {}

# A closed facility-day is recorded as 100% absenteeism (or missing). Days at or
# above this level are treated as non-working (closure), not real absenteeism.
CLOSED_THRESHOLD = 0.99
# A (plant-area, weekday) is classified non-working when at least this share of
# its historical days are closed (NaN or >= CLOSED_THRESHOLD).
CLOSED_DOW_FRACTION = 0.5

# Pool of invented departments + shifts — areas are sampled per warehouse so
# each location shows a different (deterministic) set in the Area selector.
_DEPARTMENTS = [
    "Assembly", "Lens Casting", "Lens Coating", "Surfacing", "Tinting",
    "Edging", "Packaging", "Quality Control", "Logistics", "Inbound Warehouse",
    "Outbound Warehouse", "Maintenance", "Injection Molding", "Frames Assembly",
]
_SHIFTS = ["1st Shift", "2nd Shift", "3rd Shift"]


def _mock_ids_for(warehouse_id: str, rng: np.random.Generator) -> list[str]:
    """Deterministic per-warehouse set of invented areas (8-11)."""
    n_dept = int(rng.integers(6, 9))
    depts = list(rng.choice(_DEPARTMENTS, size=n_dept, replace=False))
    ids: list[str] = []
    for d in depts:
        n_shifts = int(rng.integers(1, 3))  # 1 or 2 shifts per department
        for s in list(rng.choice(_SHIFTS, size=n_shifts, replace=False)):
            ids.append(f"{d} - {s}")
    return ids


def load_data(warehouse_id: str) -> pd.DataFrame | None:
    # Key by day so a long-lived process picks up fresh data after midnight
    cache_key = f"{warehouse_id}:{pd.Timestamp.today():%Y-%m-%d}"
    if cache_key in _cache:
        return _cache[cache_key]

    if config.DATA_SOURCE == "excel":
        df = _load_excel(warehouse_id)
        if df is None:
            df = _generate_mock_data(warehouse_id)
    elif config.DATA_SOURCE == "delta":
        df = _load_delta(warehouse_id)
        if df is None:
            df = _generate_mock_data(warehouse_id)
    else:
        raise ValueError(f"Unknown DATA_SOURCE: {config.DATA_SOURCE}")

    if df is not None:
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


def _load_excel(warehouse_id: str) -> pd.DataFrame | None:
    wh = get_warehouse(warehouse_id)
    if wh is None or wh["file"] is None:
        return None
    base_dir = os.path.dirname(os.path.abspath(__file__))
    path = os.path.join(base_dir, wh["file"])
    if not os.path.exists(path):
        return None
    return pd.read_excel(path, engine="openpyxl")


def _sql_http_path() -> str | None:
    explicit = os.environ.get("KELLY_SQL_HTTP_PATH")
    if explicit:
        return explicit
    wh_id = os.environ.get("DATABRICKS_WAREHOUSE_ID")
    return f"/sql/1.0/warehouses/{wh_id}" if wh_id else None


# Identifiers can't be bound as query parameters, so name parts coming from
# the environment are validated and backtick-quoted before interpolation
# (catalog names like "sbx-logistics" contain hyphens).
_IDENTIFIER_PART_RE = re.compile(r"[A-Za-z0-9_-]+")


def _qualified_table(warehouse_id: str) -> str | None:
    wh = get_warehouse(warehouse_id)
    table = (wh or {}).get("table")
    uc_schema = os.environ.get("KELLY_UC_SCHEMA", "sbx-logistics.kelly")
    parts = uc_schema.split(".") + [table] if table else []
    if len(parts) != 3 or not all(_IDENTIFIER_PART_RE.fullmatch(p) for p in parts):
        _log.warning("Invalid UC identifiers: schema=%r table=%r", uc_schema, table)
        return None
    return ".".join(f"`{p}`" for p in parts)


def _sql_connect_kwargs() -> dict:
    """Auth for databricks-sql-connector across runtimes: Databricks Apps
    (service-principal env creds), local PAT, or local CLI OAuth profile."""
    from databricks.sdk.core import Config, oauth_service_principal

    profile = os.environ.get("DATABRICKS_CONFIG_PROFILE")
    cfg = Config(profile=profile) if profile else Config()
    kwargs = {"server_hostname": cfg.host.removeprefix("https://")}
    if cfg.client_id and cfg.client_secret:
        kwargs["credentials_provider"] = lambda: oauth_service_principal(cfg)
    elif cfg.token:
        kwargs["access_token"] = cfg.token
    else:
        kwargs["credentials_provider"] = lambda: cfg.authenticate
    return kwargs


def _load_delta(warehouse_id: str) -> pd.DataFrame | None:
    """Load a warehouse's forecast table from Unity Catalog via a SQL warehouse.

    Returns None (=> caller falls back to mock data) when unconfigured
    (no table mapped / no warehouse path) or on any failure.
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
            # naive dates (mock/excel parity)
            cur.execute(
                f"SELECT CAST(ds AS DATE) AS Date, ID, Actual, Forecast, "
                f"Forecast_Vintage FROM {table}"
            )
            df = cur.fetchall_arrow().to_pandas()
        return df if not df.empty else None
    except Exception:
        _log.exception("Delta load failed for %s; falling back to mock data", warehouse_id)
        return None


def _generate_mock_data(warehouse_id: str) -> pd.DataFrame:
    # Stable seed (zlib.crc32) so each warehouse keeps the same areas across restarts
    seed = zlib.crc32(warehouse_id.encode("utf-8"))
    rng = np.random.default_rng(seed=seed)

    mock_ids = _mock_ids_for(warehouse_id, rng)

    today = pd.Timestamp.today().normalize()
    start = pd.Timestamp("2023-01-01")
    end_future = today + pd.Timedelta(weeks=6)

    all_dates = pd.date_range(start, end_future, freq="D")
    # Exclude weekends for realism
    all_dates = all_dates[all_dates.dayofweek < 5]

    rows = []
    for id_name in mock_ids:
        base_rate = rng.uniform(0.03, 0.09)
        for date in all_dates:
            actual = fct_vintage = forecast = None

            noise = rng.normal(0, 0.012)
            seasonal = 0.015 * np.sin(2 * np.pi * date.dayofyear / 365)
            rate = max(0.0, base_rate + seasonal + noise)

            if date < today - pd.Timedelta(weeks=4):
                actual = float(rate)
            elif date < today:
                actual = float(rate)
                fct_vintage = float(max(0.0, rate + rng.normal(0, 0.008)))
            else:
                forecast = float(max(0.0, rate + rng.normal(0, 0.006)))

            rows.append({
                "Date": date,
                "ID": id_name,
                "Actual": actual,
                "Forecast_Vintage": fct_vintage,
                "Forecast": forecast,
            })

    return pd.DataFrame(rows)
