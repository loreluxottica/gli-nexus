"""Build a lean per-site summary so a comment can tag a site and the reader can
open an analysis of that single plant.

Ported from reference-data-pipeline/build_site_analysis.py — identical logic,
only the DATA path changed to the Next app's src/data. Consumes the db.json +
content.json produced by build_content.py.

Run after build_content.py:
    python data_pipeline/build_site_analysis.py
"""

import json
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "src", "data")
DB_PATH = os.path.join(DATA, "db.json")
CONTENT_PATH = os.path.join(DATA, "content.json")
OUT_PATH = os.path.join(DATA, "site_analysis.json")

C_MONTH, C_SITE, C_MARKET, C_PRODUCT, C_SITE_TYPE = 0, 1, 2, 3, 4
C_PIECES, C_SHIPMENTS, C_GEO_EFF = 5, 6, 10


def sheet1_key_for(product, site_type):
    """Content row "Category|Sub-category" a db record feeds, or None."""
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
    period = int(cv["period_number"])
    cur_months = {f"{cur_year}-{m:02d}" for m in range(1, period + 1)}
    py_months = {f"{prior_year}-{m:02d}" for m in range(1, period + 1)}

    def new_site():
        return {
            "areas": defaultdict(float),
            "products": set(),
            "site_types": set(),
            "rep": [0.0, 0.0, 0.0, 0.0],
            "lm": [0.0, 0.0, 0.0, 0.0],
        }

    sites = defaultdict(new_site)
    flow_sites = defaultdict(lambda: defaultdict(set))
    fsm = defaultdict(
        lambda: defaultdict(lambda: defaultdict(lambda: defaultdict(lambda: [0.0] * 8)))
    )
    PERIODS = list(range(1, period + 1))

    for r in db:
        ym = r[C_MONTH]
        is_cur = ym in cur_months
        is_py = ym in py_months
        if not (is_cur or is_py):
            continue
        market = r[C_MARKET]
        if market not in ("REP", "LM"):
            continue
        site = r[C_SITE] or "(unknown)"
        s = sites[site]
        pieces = float(r[C_PIECES] or 0)
        shipments = float(r[C_SHIPMENTS] or 0)
        geo = (r[C_GEO_EFF] or "").strip()
        prod = (r[C_PRODUCT] or "").strip()
        stype = (r[C_SITE_TYPE] or "").strip()
        if geo:
            s["areas"][geo] += pieces
        if prod:
            s["products"].add(prod)
        if stype:
            s["site_types"].add(stype)
        bucket = s[market.lower()]
        if is_cur:
            bucket[0] += pieces
            bucket[2] += shipments
        else:
            bucket[1] += pieces
            bucket[3] += shipments

        if (pieces > 0 or shipments > 0) and geo:
            flow = sheet1_key_for(prod, stype)
            if flow is not None:
                flow_sites[flow][geo].add(site)
                flow_sites[flow]["ALL"].add(site)
                base = 0 if market == "REP" else 4
                off = 0 if is_cur else 1
                mn = int(ym[5:7]) if len(ym) >= 7 else 0
                for p in PERIODS:
                    if mn > p:
                        continue
                    for area_key in (geo, "ALL"):
                        m = fsm[p][flow][area_key][site]
                        m[base + off] += pieces
                        m[base + 2 + off] += shipments

    out_sites = {}
    for name, s in sites.items():
        areas_sorted = sorted(s["areas"], key=lambda a: -s["areas"][a])
        out_sites[name] = {
            "geo": areas_sorted[0] if areas_sorted else "",
            "areas": areas_sorted,
            "products": sorted(s["products"]),
            "site_types": sorted(s["site_types"]),
            "rep": {
                "pieces": {"cur": round(s["rep"][0], 2), "py": round(s["rep"][1], 2)},
                "shipments": {"cur": round(s["rep"][2], 2), "py": round(s["rep"][3], 2)},
            },
            "lm": {
                "pieces": {"cur": round(s["lm"][0], 2), "py": round(s["lm"][1], 2)},
                "shipments": {"cur": round(s["lm"][2], 2), "py": round(s["lm"][3], 2)},
            },
        }

    out_flow_sites = {
        flow: {area: sorted(names) for area, names in sorted(areas.items())}
        for flow, areas in sorted(flow_sites.items())
    }

    out_flow_site_metrics = {
        str(p): {
            flow: {
                area: {
                    site: [round(v, 2) for v in vals]
                    for site, vals in sorted(sites_m.items())
                }
                for area, sites_m in sorted(areas_m.items())
            }
            for flow, areas_m in sorted(fsm[p].items())
        }
        for p in PERIODS
    }

    out = {
        "year": cur_year,
        "prior_year": prior_year,
        "period_label": cv["period_label"],
        "sites": dict(sorted(out_sites.items())),
        "flow_sites": out_flow_sites,
        "flow_site_metrics": out_flow_site_metrics,
    }

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"  site_analysis.json written: {len(out_sites)} sites, "
          f"{cur_year} {cv['period_label']} vs {prior_year}, {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
