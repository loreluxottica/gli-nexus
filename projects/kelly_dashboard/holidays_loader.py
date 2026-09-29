from __future__ import annotations
import logging
import time
import requests
import pandas as pd

_log = logging.getLogger(__name__)
_NAGER_URL = "https://date.nager.at/api/v3/PublicHolidays/{year}/{country}"
_FAIL_TTL_S = 30

COUNTRY_MAP = {
    "columbus": "US",
    "atlanta":  "US",
    "dallas":   "US",
    "sedico":   "IT",
    "tijuana":  "MX",
}

_cache: dict[tuple[str, int], list[dict]] = {}
_retry_after: dict[tuple[str, int], float] = {}


def _fetch_year(country: str, year: int) -> list[dict]:
    key = (country, year)
    if key in _cache:
        return _cache[key]
    if time.monotonic() < _retry_after.get(key, 0):
        return []
    try:
        resp = requests.get(_NAGER_URL.format(year=year, country=country), timeout=8)
        resp.raise_for_status()
        data = resp.json()
        if not isinstance(data, list) or any(not isinstance(h, dict) for h in data):
            raise ValueError("Expected a list of holiday objects")
    except (requests.RequestException, ValueError) as exc:
        _log.warning("Holiday lookup failed for %s/%s: %s", country, year, exc)
        _retry_after[key] = time.monotonic() + _FAIL_TTL_S
        return []
    _cache[key] = data
    _retry_after.pop(key, None)
    return data


def get_upcoming_holidays(warehouse_id: str, days_ahead: int = 30) -> list[dict]:
    country = COUNTRY_MAP.get(warehouse_id, "US")
    today = pd.Timestamp.today().normalize()
    cutoff = today + pd.Timedelta(days=days_ahead)

    years = {today.year}
    if cutoff.year != today.year:
        years.add(cutoff.year)

    all_holidays: list[dict] = []
    for year in sorted(years):
        all_holidays.extend(_fetch_year(country, year))

    upcoming = []
    for h in all_holidays:
        try:
            d = pd.Timestamp(h["date"])
        except (KeyError, TypeError, ValueError) as exc:
            _log.warning("Skipping invalid holiday date for %s: %s", country, exc)
            continue
        if today <= d <= cutoff:
            upcoming.append({
                "date": d,
                "name": h.get("localName") or h.get("name", ""),
                "name_en": h.get("name", ""),
                "country": country,
            })

    upcoming.sort(key=lambda x: x["date"])
    return upcoming[:8]
