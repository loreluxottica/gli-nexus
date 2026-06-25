from __future__ import annotations
import requests
import pandas as pd

_NAGER_URL = "https://date.nager.at/api/v3/PublicHolidays/{year}/{country}"

COUNTRY_MAP = {
    "columbus": "US",
    "atlanta":  "US",
    "dallas":   "US",
    "sedico":   "IT",
    "tijuana":  "MX",
}

_cache: dict[tuple[str, int], list[dict]] = {}


def _fetch_year(country: str, year: int) -> list[dict]:
    key = (country, year)
    if key in _cache:
        return _cache[key]
    try:
        resp = requests.get(_NAGER_URL.format(year=year, country=country), timeout=8)
        resp.raise_for_status()
        data = resp.json()
        _cache[key] = data
        return data
    except Exception:
        _cache[key] = []
        return []


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
        except Exception:
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
