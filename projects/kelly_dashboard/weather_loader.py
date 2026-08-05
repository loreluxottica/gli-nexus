from __future__ import annotations
import threading
import requests
import pandas as pd
from kelly_dashboard.warehouses import get_warehouse

_OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

# In-process cache: warehouse_id -> (fetch_date, enriched 8-day frame).
# Only the current forecast is ever displayed, so nothing is persisted; the
# entry is refreshed on the first request of each calendar day.
_cache: dict[str, tuple[str, pd.DataFrame]] = {}
_lock = threading.Lock()

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


def _today() -> str:
    return pd.Timestamp.today().strftime("%Y-%m-%d")


def get_forecast(warehouse_id: str) -> pd.DataFrame | None:
    """Return today's 8-day Open-Meteo forecast, or None if it can't be fetched.

    One API call per plant per day; the result is held in memory only. If the
    API is unreachable, the previous day's frame is served rather than nothing
    (a slightly stale forecast beats an empty strip).
    """
    wh = get_warehouse(warehouse_id)
    if wh is None:
        return None

    today = _today()
    with _lock:
        cached = _cache.get(warehouse_id)
        if cached is not None and cached[0] == today:
            return cached[1]

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
            return cached[1] if cached is not None else None

        daily = data.get("daily", {})
        rows = []
        for i, date in enumerate(daily.get("time", [])):
            rows.append({
                "warehouse_id": warehouse_id,
                "date": date,
                "temp_max": daily.get("temperature_2m_max", [None] * 8)[i],
                "temp_min": daily.get("temperature_2m_min", [None] * 8)[i],
                "precipitation": daily.get("precipitation_sum", [None] * 8)[i],
                "wind_speed": daily.get("wind_speed_10m_max", [None] * 8)[i],
                "weather_code": daily.get("weather_code", [None] * 8)[i],
            })
        if not rows:
            return cached[1] if cached is not None else None

        df = _enrich(pd.DataFrame(rows))
        _cache[warehouse_id] = (today, df)
        return df


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
