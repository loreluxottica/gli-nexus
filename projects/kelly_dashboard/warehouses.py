WAREHOUSES = [
    {
        "id": "columbus",
        "table": "kelly_col_forecast",
        "label": "Columbus",
        "city": "Columbus, OH",
        "lat": 39.961,
        "lon": -82.999,
        "file": "Kelly_Columbus_v1.3_daily_05-24-2026.xlsx",
    },
    {
        "id": "atlanta",
        "table": "kelly_atl_forecast",
        "label": "Atlanta",
        "city": "Atlanta, GA",
        "lat": 33.749,
        "lon": -84.388,
        "file": None,
    },
    {
        "id": "dallas",
        "table": "kelly_da_forecast",
        "label": "Dallas",
        "city": "Dallas, TX",
        "lat": 32.776,
        "lon": -96.797,
        "file": None,
    },
    {
        "id": "sedico",
        "table": "kelly_it_forecast",
        "label": "Sedico",
        "city": "Sedico, Italy",
        "lat": 46.117,
        "lon": 12.100,
        "file": None,
    },
    {
        "id": "tijuana",
        "table": "kelly_mx_forecast",
        "label": "Tijuana",
        "city": "Tijuana, MX",
        "lat": 32.514,
        "lon": -117.038,
        "file": None,
    },
]

WAREHOUSE_MAP = {w["id"]: w for w in WAREHOUSES}


def get_warehouse(warehouse_id: str) -> dict:
    return WAREHOUSE_MAP.get(warehouse_id)
