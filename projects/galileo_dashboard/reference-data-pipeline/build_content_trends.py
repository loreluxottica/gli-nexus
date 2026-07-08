"""Build the monthly trend series that powers Content V2 sparklines.

The Content table (current_view in content.json) only carries a single
year-over-year comparison: YTD<period> current year vs the same YTD last year.
Content V2 also shows a per-row monthly trend line — the current year tracking
last year's full seasonal shape — so we need the underlying MONTHLY series, not
just the two YTD totals.

That series is fully derivable from db.json (already the committed monthly source
of truth, 9.7k rows) using the SAME row mapping the main builder uses
(sheet1_key_for) and the SAME effective geo. db.json column 10 already holds the
effective Geographical Area (the Export Labs APAC->EMEA reassignment baked in),
so we group on it directly and also accumulate an "ALL" bucket (sum of areas),
exactly like build_content.py's `for g in (GEO_ALL, geo)`.

Output: app-next/src/data/content_trends.json — a compact payload (~20-30 KB)
safe to bundle on the Content V2 route. The heavy db.json stays out of that
route (it is lazy-loaded only on /database).

Run after build_content.py:
    python scripts/build_content_trends.py
"""

import json
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "app-next", "src", "data")
DB_PATH = os.path.join(DATA, "db.json")
CONTENT_PATH = os.path.join(DATA, "content.json")
OUT_PATH = os.path.join(DATA, "content_trends.json")

GEO_ALL = "ALL"
MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# db.json positional columns (mirror of types.ts DbRow).
C_MONTH, C_MARKET, C_PRODUCT, C_SITE_TYPE = 0, 2, 3, 4
C_PIECES, C_SHIPMENTS, C_GEO_EFF = 5, 6, 10


def sheet1_key_for(product, site_type):
    """Return the Content row "Category|Sub-category" key, or None.

    Identical mapping to build_content.py.sheet1_key_for, joined with "|" to
    match the key the React side builds from a ContentRow.
    """
    if product == "Finished Frames":
        return "Frames|Finished Frames"
    if product == "GV Frames":
        return "Frames|GV Frames*"
    if product == "Stock Lenses" and site_type == "Mass Production | DCs":
        return "Stock Lenses|Mass Production | DCs"
    if product == "RX":
        if site_type == "Export Labs":
            return "RX Lenses|Export Labs"
        if site_type == "Nearshore Labs":
            return "RX Lenses|Nearshore Labs"
        if site_type == "Local Labs to ECP":
            return "RX Lenses|Local Labs to ECP"
    return None


def main():
    with open(DB_PATH, encoding="utf-8") as f:
        db = json.load(f)
    with open(CONTENT_PATH, encoding="utf-8") as f:
        content = json.load(f)

    cv = content["current_view"]
    cur_year = int(cv["year"])
    prior_year = cur_year - 1
    period_number = int(cv["period_number"])  # last YTD month with data (e.g. 4 = April)
    areas = cv["dimensions"][0]["options"]     # ["ALL","APAC","EMEA","LATAM","NA"]

    # key -> area -> market -> metric -> {year -> [12 monthly floats]}
    def month_vec():
        return [0.0] * 12

    def new_node():
        return {
            "REP": {"pieces": defaultdict(month_vec), "shipments": defaultdict(month_vec)},
            "LM": {"pieces": defaultdict(month_vec), "shipments": defaultdict(month_vec)},
        }

    agg = defaultdict(lambda: defaultdict(new_node))  # key -> area -> node

    for r in db:
        market = r[C_MARKET]
        if market not in ("REP", "LM"):
            continue
        ym = r[C_MONTH]  # "YYYY-MM"
        try:
            y, m = int(ym[:4]), int(ym[5:7])
        except (ValueError, IndexError):
            continue
        if y not in (cur_year, prior_year):
            continue
        key = sheet1_key_for(r[C_PRODUCT], r[C_SITE_TYPE])
        if key is None:
            continue
        geo = (r[C_GEO_EFF] or "").strip() or "(blank)"
        pieces = float(r[C_PIECES] or 0)
        shipments = float(r[C_SHIPMENTS] or 0)
        mi = m - 1
        for g in (GEO_ALL, geo):
            node = agg[key][g][market]
            node["pieces"][y][mi] += pieces
            node["shipments"][y][mi] += shipments

    # Serialize: current year truncated to the YTD period (no trailing zero
    # months that would drag the line to the floor); prior year kept full so the
    # ghost shows the whole seasonal shape.
    def series(node, metric):
        cy = node[metric].get(cur_year, month_vec())[:period_number]
        py = node[metric].get(prior_year, month_vec())
        return {
            "cy": [round(v, 2) for v in cy],
            "py": [round(v, 2) for v in py],
        }

    rows_out = {}
    for key, by_area in agg.items():
        area_out = {}
        for area in areas:
            node = by_area.get(area)
            if node is None:
                continue
            area_out[area] = {
                "REP": {
                    "pieces": series(node["REP"], "pieces"),
                    "shipments": series(node["REP"], "shipments"),
                },
                "LM": {
                    "pieces": series(node["LM"], "pieces"),
                    "shipments": series(node["LM"], "shipments"),
                },
            }
        rows_out[key] = area_out

    out = {
        "current_year": cur_year,
        "prior_year": prior_year,
        "period_number": period_number,
        "month_labels": MONTH_LABELS,
        "rows": rows_out,
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"  content_trends.json written: {len(rows_out)} rows, "
          f"{cur_year} YTD {period_number} vs {prior_year} full year, {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
