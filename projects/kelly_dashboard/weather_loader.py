from __future__ import annotations
import os
import tempfile
import requests
import pandas as pd
from kelly_dashboard.warehouses import get_warehouse

_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Seed cache committed with the repo — read-only fallback when the app runs
# on a filesystem where the source dir is not writable (e.g. Databricks Apps).
_SEED_DIR = os.path.join(_BASE_DIR, "weather_data")
_OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def _resolve_weather_dir() -> str:
    d = os.environ.get("WEATHER_CACHE_DIR", _SEED_DIR)
    try:
        os.makedirs(d, exist_ok=True)
        probe = os.path.join(d, ".write_probe")
        with open(probe, "w"):
            pass
        os.remove(probe)
        return d
    except OSError:
        fallback = os.path.join(tempfile.gettempdir(), "kelly_weather")
        os.makedirs(fallback, exist_ok=True)
        return fallback


_WEATHER_DIR = _resolve_weather_dir()

_WMO_EMOJI = {
    0: ("☀", "Clear"),
    1: ("🌤", "Mainly clear"),
    2: ("⛅", "Partly cloudy"),
    3: ("☁", "Overcast"),
    45: ("🌫", "Fog"),
    48: ("🌫", "Icy fog"),
    51: ("🌦", "Light drizzle"),
    53: ("🌦", "Drizzle"),
    55: ("🌦", "Heavy drizzle"),
    61: ("🌧", "Light rain"),
    63: ("🌧", "Rain"),
    65: ("🌧", "Heavy rain"),
    71: ("❄", "Light snow"),
    73: ("❄", "Snow"),
    75: ("❄", "Heavy snow"),
    77: ("❄", "Snow grains"),
    80: ("🌦", "Rain showers"),
    81: ("🌦", "Showers"),
    82: ("⛈", "Heavy showers"),
    85: ("❄", "Snow showers"),
    86: ("❄", "Heavy snow showers"),
    95: ("⛈", "Thunderstorm"),
    96: ("⛈", "Storm + hail"),
    99: ("⛈", "Heavy storm"),
}


def _csv_path(warehouse_id: str) -> str:
    return os.path.join(_WEATHER_DIR, f"weather_{warehouse_id}.csv")


def _read_cached(warehouse_id: str) -> pd.DataFrame | None:
    """Read the cache CSV, falling back to the committed seed copy."""
    for path in (_csv_path(warehouse_id),
                 os.path.join(_SEED_DIR, f"weather_{warehouse_id}.csv")):
        if os.path.exists(path):
            df = pd.read_csv(path)
            if not df.empty:
                return df
    return None


def _today() -> str:
    return pd.Timestamp.today().strftime("%Y-%m-%d")


def fetch_and_store(warehouse_id: str) -> pd.DataFrame | None:
    """Fetch 8-day forecast from Open-Meteo and append to CSV if not already fetched today."""
    wh = get_warehouse(warehouse_id)
    if wh is None:
        return None

    csv = _csv_path(warehouse_id)
    today = _today()

    # Return cached if already fetched today
    df_existing = _read_cached(warehouse_id)
    if df_existing is not None and today in df_existing["fetch_date"].values:
        latest = df_existing[df_existing["fetch_date"] == df_existing["fetch_date"].max()]
        return _enrich(latest)

    # Fetch from API
    try:
        resp = requests.get(_OPEN_METEO_URL, params={
            "latitude": wh["lat"],
            "longitude": wh["lon"],
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code",
            "timezone": "auto",
            "forecast_days": 8,
        }, timeout=10)
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        # Fall back to latest stored data if API fails
        if df_existing is not None:
            latest = df_existing[df_existing["fetch_date"] == df_existing["fetch_date"].max()]
            return _enrich(latest)
        return None

    daily = data.get("daily", {})
    rows = []
    for i, date in enumerate(daily.get("time", [])):
        rows.append({
            "fetch_date": today,
            "warehouse_id": warehouse_id,
            "date": date,
            "temp_max": daily.get("temperature_2m_max", [None] * 8)[i],
            "temp_min": daily.get("temperature_2m_min", [None] * 8)[i],
            "precipitation": daily.get("precipitation_sum", [None] * 8)[i],
            "wind_speed": daily.get("wind_speed_10m_max", [None] * 8)[i],
            "weather_code": daily.get("weather_code", [None] * 8)[i],
        })

    df_new = pd.DataFrame(rows)

    # Append to CSV; a failed cache write must not lose the fetched data
    try:
        if os.path.exists(csv):
            df_new.to_csv(csv, mode="a", header=False, index=False)
        else:
            df_new.to_csv(csv, index=False)
    except OSError:
        pass

    return _enrich(df_new)


def get_latest_forecast(warehouse_id: str) -> pd.DataFrame | None:
    """Return most recently fetched 8-day forecast from CSV."""
    df = _read_cached(warehouse_id)
    if df is None:
        return None
    latest_date = df["fetch_date"].max()
    return _enrich(df[df["fetch_date"] == latest_date])


def _enrich(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["emoji"] = df["weather_code"].apply(
        lambda c: _WMO_EMOJI.get(int(c) if pd.notna(c) else 0, ("🌡", "Unknown"))[0]
    )
    df["condition"] = df["weather_code"].apply(
        lambda c: _WMO_EMOJI.get(int(c) if pd.notna(c) else 0, ("🌡", "Unknown"))[1]
    )
    return df
