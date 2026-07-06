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
    if warehouse_id in _cache:
        return _cache[warehouse_id]

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
        _cache[warehouse_id] = df

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


# Identifiers can't be bound as query parameters, so table/column names coming
# from the environment are validated against this pattern before interpolation.
_IDENTIFIER_RE = re.compile(r"[A-Za-z0-9_.`]+")


def _load_delta(warehouse_id: str) -> pd.DataFrame | None:
    """Load from a Unity Catalog table via a Databricks SQL warehouse.

    Returns None (=> caller falls back to mock data) when the connection is
    not configured (KELLY_TABLE / warehouse path unset) or on any failure.
    Auth relies on the service-principal credentials that Databricks Apps
    inject automatically (DATABRICKS_HOST / CLIENT_ID / CLIENT_SECRET).
    """
    table = os.environ.get("KELLY_TABLE")  # e.g. catalog.schema.absenteeism
    http_path = _sql_http_path()
    if not table or not http_path:
        return None
    wh_col = os.environ.get("KELLY_WAREHOUSE_COLUMN", "Warehouse")
    if not _IDENTIFIER_RE.fullmatch(table) or not _IDENTIFIER_RE.fullmatch(wh_col):
        _log.warning("Rejected KELLY_TABLE=%r / KELLY_WAREHOUSE_COLUMN=%r", table, wh_col)
        return None
    try:
        from databricks import sql as dbsql
        from databricks.sdk.core import Config, oauth_service_principal

        cfg = Config()
        with dbsql.connect(
            server_hostname=cfg.host.removeprefix("https://"),
            http_path=http_path,
            credentials_provider=lambda: oauth_service_principal(cfg),
        ) as conn, conn.cursor() as cur:
            cur.execute(
                f"SELECT Date, ID, Actual, Forecast, Forecast_Vintage "
                f"FROM {table} WHERE {wh_col} = :wh",
                {"wh": warehouse_id},
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
