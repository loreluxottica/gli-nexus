WAREHOUSES = [
    {
        "id": "columbus",
        "label": "Columbus",
        "city": "Columbus, OH",
        "lat": 39.961,
        "lon": -82.999,
        "file": "Kelly_Columbus_v1.3_daily_05-24-2026.xlsx",
    },
    {
        "id": "atlanta",
        "label": "Atlanta",
        "city": "Atlanta, GA",
        "lat": 33.749,
        "lon": -84.388,
        "file": None,
    },
    {
        "id": "dallas",
        "label": "Dallas",
        "city": "Dallas, TX",
        "lat": 32.776,
        "lon": -96.797,
        "file": None,
    },
    {
        "id": "sedico",
        "label": "Sedico",
        "city": "Sedico, Italy",
        "lat": 46.117,
        "lon": 12.100,
        "file": None,
    },
    {
        "id": "tijuana",
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
