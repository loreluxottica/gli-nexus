"""Build content.json from raw.json.

Drops the External Suppliers rows from Sheet 1, and for every remaining row
(and every Export Labs site) precomputes the 12 metric values for each
Geographical Area, plus a 'ALL' aggregate.
"""
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
# Next port mirrors the generated payloads here so `npm run build` stays in sync.
APP_DATA = ROOT / "app-next" / "src" / "data"
raw = json.loads((DATA / "raw.json").read_text(encoding="utf-8"))

sheet1 = raw["sheets"][0]
sheet2 = raw["sheets"][1]


# ---------------------------------------------------------------------------
# Sheet 1 — current layout (kept for: row labels, coverage %, driver, footnote)
# ---------------------------------------------------------------------------
rows1 = sheet1["rows"]

def num_or_none(v):
    if v in ("", "-", None):
        return None
    try:
        return float(v) if ("." in v or "e" in v.lower()) else int(v)
    except (ValueError, TypeError):
        return None

def parse_sheet1_meta(r):
    return {
        "category":     r[3],
        "sub_category": r[4],
        "coverage":     num_or_none(r[5]),
        "driver":       r[6],
    }

current_rows_meta = []
carry_cat = ""
for r in rows1[8:15]:
    if r[3]:
        carry_cat = r[3]
    m = parse_sheet1_meta(r)
    m["category"] = carry_cat
    current_rows_meta.append(m)

# Drop External Suppliers
current_rows_meta = [r for r in current_rows_meta if r["category"] != "External Suppliers"]


# ---------------------------------------------------------------------------
# Sheet 2 — full DB
# ---------------------------------------------------------------------------
db_rows = sheet2["rows"]
DB_IDX  = {c: i for i, c in enumerate(db_rows[0])}

YM_RE = re.compile(r"^(\d{4})-(\d{2})")
def year_month(s):
    m = YM_RE.match(s or "")
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)
def to_float(s):
    try:    return float(s) if s not in ("", None, "-") else 0.0
    except: return 0.0

CUR_YEAR   = 2026
PY_YEAR    = 2025
YTD_MONTHS = (1, 2, 3, 4)
GEOS       = ["APAC", "EMEA", "LATAM", "NA"]
GEO_ALL    = "ALL"

# Accounting dimension (a second way to scope every table, independent from the
# production Geographical Area). Values come straight from the DB column.
ACCT_COL   = "Accounting Area"
ACCT_AREAS = sorted({(r[DB_IDX[ACCT_COL]] or "").strip()
                     for r in db_rows[1:] if (r[DB_IDX[ACCT_COL]] or "").strip()})


def effective_geo(r):
    """Geographical Area to use for a DB record.

    Business rule: Export Labs are all booked under APAC, but the ones shipping
    to an EMEA destination must be counted in EMEA instead. So Export Labs rows
    whose Customer Country is EMEA are reassigned APAC -> EMEA; everything else
    keeps its raw Geographical Area.
    """
    geo = (r[DB_IDX["Geographical Area"]] or "").strip()
    if ((r[DB_IDX["Site Type"]] or "").strip() == "Export Labs"
            and (r[DB_IDX["Customer Country"]] or "").strip() == "EMEA"):
        return "EMEA"
    return geo

# Mapping from (Sheet 1 category, sub-category) -> DB filter.
def sheet1_key_for(product, site_type):
    """Return the Sheet 1 row this DB record belongs to, or None."""
    if product == "Finished Frames":
        return ("Frames", "Finished Frames")
    if product == "GV Frames":
        return ("Frames", "GV Frames*")
    if product == "Stock Lenses" and site_type == "Mass Production | DCs":
        return ("Stock Lenses", "Mass Production | DCs")
    if product == "RX":
        if site_type == "Export Labs":      return ("RX Lenses", "Export Labs")
        if site_type == "Nearshore Labs":   return ("RX Lenses", "Nearshore Labs")
        if site_type == "Local Labs to ECP": return ("RX Lenses", "Local Labs to ECP")
    return None


def new_bucket():
    return {"pieces":    {"rep_cur": 0.0, "rep_py": 0.0, "lm_cur": 0.0, "lm_py": 0.0},
            "shipments": {"rep_cur": 0.0, "rep_py": 0.0, "lm_cur": 0.0, "lm_py": 0.0}}

# Aggregators — one set keyed by Geographical Area, one by Accounting Area.
sheet1_agg            = defaultdict(lambda: defaultdict(new_bucket))  # (cat, sub) -> geo  -> buckets
export_labs_agg       = defaultdict(lambda: defaultdict(new_bucket))  # site       -> geo  -> buckets
sheet1_acct_agg       = defaultdict(lambda: defaultdict(new_bucket))  # (cat, sub) -> acct -> buckets
export_labs_acct_agg  = defaultdict(lambda: defaultdict(new_bucket))  # site       -> acct -> buckets

# Single pass over DB
for r in db_rows[1:]:
    y, m = year_month(r[DB_IDX["Month/Year"]])
    if m not in YTD_MONTHS or y not in (CUR_YEAR, PY_YEAR):
        continue
    market = r[DB_IDX["Market"]]
    if market not in ("REP", "LM"):
        continue

    product   = r[DB_IDX["Product"]]
    site_type = r[DB_IDX["Site Type"]]
    geo       = effective_geo(r) or "(blank)"
    acct      = (r[DB_IDX[ACCT_COL]] or "").strip() or "(blank)"
    pieces    = to_float(r[DB_IDX["Pieces"]])
    shipments = to_float(r[DB_IDX["Shipments"]])

    period = "cur" if y == CUR_YEAR else "py"
    bucket_key = f"{market.lower()}_{period}"   # rep_cur / rep_py / lm_cur / lm_py

    # Sheet 1 row breakdown — by Geographical Area and by Accounting Area.
    s1key = sheet1_key_for(product, site_type)
    if s1key is not None:
        for g in (GEO_ALL, geo):
            sheet1_agg[s1key][g]["pieces"][bucket_key]    += pieces
            sheet1_agg[s1key][g]["shipments"][bucket_key] += shipments
        for a in (GEO_ALL, acct):
            sheet1_acct_agg[s1key][a]["pieces"][bucket_key]    += pieces
            sheet1_acct_agg[s1key][a]["shipments"][bucket_key] += shipments

    # Export Labs site breakdown — by Geographical Area and by Accounting Area.
    if site_type == "Export Labs":
        site = r[DB_IDX["Site"]] or "(unknown)"
        for g in (GEO_ALL, geo):
            export_labs_agg[site][g]["pieces"][bucket_key]    += pieces
            export_labs_agg[site][g]["shipments"][bucket_key] += shipments
        for a in (GEO_ALL, acct):
            export_labs_acct_agg[site][a]["pieces"][bucket_key]    += pieces
            export_labs_acct_agg[site][a]["shipments"][bucket_key] += shipments


def yoy(cur, py):
    return ((cur - py) / py) if py else None

def buckets_to_metrics(b):
    """{rep_cur, rep_py, lm_cur, lm_py} -> {rep, rep_py, rep_yoy, lm, lm_py, lm_yoy}."""
    return {
        "rep":     round(b["rep_cur"], 2),
        "rep_py":  round(b["rep_py"],  2),
        "rep_yoy": yoy(b["rep_cur"], b["rep_py"]),
        "lm":      round(b["lm_cur"],  2),
        "lm_py":   round(b["lm_py"],   2),
        "lm_yoy":  yoy(b["lm_cur"], b["lm_py"]),
    }

def data_for(agg_for_key, areas):
    out = {}
    for g in [GEO_ALL] + areas:
        buckets = agg_for_key.get(g, new_bucket())
        out[g] = {
            "pieces":    buckets_to_metrics(buckets["pieces"]),
            "shipments": buckets_to_metrics(buckets["shipments"]),
        }
    return out

def geo_data_for(agg_for_key):
    return data_for(agg_for_key, GEOS)


# Build the final per-row payload (replaces previous hardcoded numbers).
current_rows = []
for meta in current_rows_meta:
    key = (meta["category"], meta["sub_category"])
    current_rows.append({
        **meta,
        "geo_data":  geo_data_for(sheet1_agg.get(key, {})),
        "acct_data": data_for(sheet1_acct_agg.get(key, {}), ACCT_AREAS),
    })


current_view = {
    "scope": rows1[1][3],
    "year":  rows1[0][3],
    "period_number": rows1[0][4],
    "period_label": "YTD April",
    "metric_blocks": ["Pieces", "Shipments"],
    "metric_columns": [
        {"key": "rep",     "label": "REP",       "desc": "Market = REP, current YTD"},
        {"key": "rep_py",  "label": "vs PY",     "desc": "Market = REP, prior YTD"},
        {"key": "rep_yoy", "label": "REPL YoY%", "desc": "Market = REP, year-over-year %"},
        {"key": "lm",      "label": "LM",        "desc": "Market = LM, current YTD"},
        {"key": "lm_py",   "label": "vs PY",     "desc": "Market = LM, prior YTD"},
        {"key": "lm_yoy",  "label": "LM YoY%",   "desc": "Market = LM, year-over-year %"},
    ],
    "row_columns": [
        {"key": "category",     "label": "Category"},
        {"key": "sub_category", "label": "Sub-category"},
        {"key": "coverage",     "label": "Coverage %"},
        {"key": "driver",       "label": "Driver (unit)"},
    ],
    "rows": current_rows,
    "footnote": "*On Matching Perimeter",
    "dimensions": [
        {"key": "geo",  "label": "Geographical Area", "options": [GEO_ALL] + GEOS},
        {"key": "acct", "label": "Accounting Area",    "options": [GEO_ALL] + ACCT_AREAS},
    ],
}


# Export Labs drill: list of sites with per-geo and per-accounting metrics.
export_labs_sites = []
for site in (export_labs_agg.keys() | export_labs_acct_agg.keys()):
    payload = {
        "site": site,
        "geo_data":  geo_data_for(export_labs_agg.get(site, {})),
        "acct_data": data_for(export_labs_acct_agg.get(site, {}), ACCT_AREAS),
    }
    export_labs_sites.append(payload)
export_labs_sites.sort(key=lambda s: s["geo_data"][GEO_ALL]["pieces"]["rep"], reverse=True)

# Named LM flows shipping to EMEA. Thanks to the Export Labs APAC->EMEA rule,
# each site's EMEA bucket isolates exactly its EMEA-destination volume, so the
# LM cells of these sites in the EMEA view are precisely the named flow.
EXPORT_LABS_LM_EMEA_FLOWS = {
    "VRX INDIA": "Glassed Direct",
    "ELTL":      "Brille 24",
}
for s in export_labs_sites:
    label = EXPORT_LABS_LM_EMEA_FLOWS.get(s["site"])
    if label:
        s["lm_flow"] = {"area": "EMEA", "label": label}


# ---------------------------------------------------------------------------
# Per-period (cumulative YTD) snapshots.
# The default view above is YTD April (months 1..4). The Content section lets
# the user pick the end month (Jan..Apr); each choice is the cumulative YTD up
# to that month vs the same window last year. We recompute the same row and
# Export-Labs-site cells for every end month so the whole Content surface
# (table, drill, accounting toggle, explorer) stays internally consistent —
# nothing here mixes windows. Coverage %, driver and site meta stay structural.
# ---------------------------------------------------------------------------
MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
               "August", "September", "October", "November", "December"]
PERIODS = list(YTD_MONTHS)  # (1, 2, 3, 4) — the months present in the data


def aggregate_for(month_nums):
    """Single DB pass restricted to `month_nums` (same in cur & prior year).
    Returns the four aggregators, mirroring the default build above."""
    s1  = defaultdict(lambda: defaultdict(new_bucket))
    el  = defaultdict(lambda: defaultdict(new_bucket))
    s1a = defaultdict(lambda: defaultdict(new_bucket))
    ela = defaultdict(lambda: defaultdict(new_bucket))
    for r in db_rows[1:]:
        y, mo = year_month(r[DB_IDX["Month/Year"]])
        if mo not in month_nums or y not in (CUR_YEAR, PY_YEAR):
            continue
        market = r[DB_IDX["Market"]]
        if market not in ("REP", "LM"):
            continue
        product   = r[DB_IDX["Product"]]
        site_type = r[DB_IDX["Site Type"]]
        geo       = effective_geo(r) or "(blank)"
        acct      = (r[DB_IDX[ACCT_COL]] or "").strip() or "(blank)"
        pieces    = to_float(r[DB_IDX["Pieces"]])
        shipments = to_float(r[DB_IDX["Shipments"]])
        bk = f"{market.lower()}_{'cur' if y == CUR_YEAR else 'py'}"
        s1key = sheet1_key_for(product, site_type)
        if s1key is not None:
            for g in (GEO_ALL, geo):
                s1[s1key][g]["pieces"][bk]    += pieces
                s1[s1key][g]["shipments"][bk] += shipments
            for a in (GEO_ALL, acct):
                s1a[s1key][a]["pieces"][bk]    += pieces
                s1a[s1key][a]["shipments"][bk] += shipments
        if site_type == "Export Labs":
            site = r[DB_IDX["Site"]] or "(unknown)"
            for g in (GEO_ALL, geo):
                el[site][g]["pieces"][bk]    += pieces
                el[site][g]["shipments"][bk] += shipments
            for a in (GEO_ALL, acct):
                ela[site][a]["pieces"][bk]    += pieces
                ela[site][a]["shipments"][bk] += shipments
    return s1, el, s1a, ela


periods_out = {}
for m in PERIODS:
    month_nums = set(range(1, m + 1))
    s1, el, s1a, ela = aggregate_for(month_nums)
    rows_p = []
    for meta in current_rows_meta:
        key = (meta["category"], meta["sub_category"])
        rows_p.append({
            "geo_data":  geo_data_for(s1.get(key, {})),
            "acct_data": data_for(s1a.get(key, {}), ACCT_AREAS),
        })
    drills_p = {}
    for site in (el.keys() | ela.keys()):
        drills_p[site] = {
            "geo_data":  geo_data_for(el.get(site, {})),
            "acct_data": data_for(ela.get(site, {}), ACCT_AREAS),
        }
    periods_out[str(m)] = {"rows": rows_p, "drills": drills_p}

current_view["periods"] = periods_out
current_view["period_options"] = [
    {"n": m, "label": f"YTD {MONTH_NAMES[m - 1]}"} for m in PERIODS
]


# ---------------------------------------------------------------------------
# Coverage page placeholders
# ---------------------------------------------------------------------------
# Real DB-derived count: distinct sites per product (and overall).
# Used by the "Sites covered in Galileo" KPI on the Coverage page.
sites_by_product = {"ALL": set()}
for r in db_rows[1:]:
    product = r[DB_IDX["Product"]]
    site    = r[DB_IDX["Site"]]
    if not site:
        continue
    sites_by_product["ALL"].add(site)
    if product:
        sites_by_product.setdefault(product, set()).add(site)
sites_in_db_by_product = {k: len(v) for k, v in sites_by_product.items()}
product_options = [GEO_ALL] + sorted(k for k in sites_by_product if k != "ALL")

# ---------------------------------------------------------------------------
# Coverage & Efficiency view — built from the per-site "COverage" sheet.
# Keeps the exact same layout used so far (per Product, one row per Area, with
# columns Tot sites / Estimated volume / Coverage % vol / Low / Mid / High).
# Each metric is now derived from the site-level sheet:
#   * Tot sites        : distinct sites in that Product x Area
#   * Coverage % vol    : covered sites (Coverage=1) / total sites
#   * Low / Mid / High  : share of sites in each Automation tier
#                         (denominator = sites that carry a tier)
#   * Estimated volume  : sum of current-YTD Pieces from the main DB for that
#                         Product x Area
# ---------------------------------------------------------------------------
PRODUCTS_ORDER = ["RX", "Stock Lenses", "Finished Frames", "GV Frames"]
AREAS = {"EMEA", "LATAM", "APAC", "NA"}
TIERS = ["Low", "Mid", "High"]

# Normalize messy area labels (e.g. "Latam" -> "LATAM").
def norm_area(s):
    return (s or "").strip().upper()

def norm_tier(s):
    t = (s or "").strip().capitalize()
    return t if t in TIERS else None

# Estimated volume per (Product, Area): current-YTD Pieces from the main DB.
est_volume = defaultdict(float)
for r in db_rows[1:]:
    y, m = year_month(r[DB_IDX["Month/Year"]])
    if y != CUR_YEAR or m not in YTD_MONTHS:
        continue
    product = r[DB_IDX["Product"]]
    area    = norm_area(effective_geo(r))
    if not product or area not in AREAS:
        continue
    est_volume[(product, area)] += to_float(r[DB_IDX["Pieces"]])

def build_coverage_efficiency(rows):
    """Aggregate the per-site COverage sheet into per-product / per-area blocks
    matching the existing table layout."""
    hdr = {c.strip(): i for i, c in enumerate(rows[0])}
    iSite, iProd, iCov, iArea, iAuto = (
        hdr["Site"], hdr["Product"], hdr["Coverage"], hdr["Area"], hdr["Automation"],
    )

    # (product, area) -> { site -> {"covered": bool, "tier": str|None} }
    sites = defaultdict(dict)
    for r in rows[1:]:
        site    = r[iSite].strip()
        product = r[iProd].strip()
        area    = norm_area(r[iArea])
        if not site or product not in PRODUCTS_ORDER or area not in AREAS:
            continue
        rec = sites[(product, area)].setdefault(site, {"covered": False, "tier": None})
        if r[iCov].strip() == "1":
            rec["covered"] = True
        tier = norm_tier(r[iAuto])
        if tier and rec["tier"] is None:
            rec["tier"] = tier

    blocks = []
    for product in PRODUCTS_ORDER:
        rows_out = []
        for area in ["EMEA", "LATAM", "APAC", "NA"]:
            site_map = sites.get((product, area))
            if not site_map:
                continue
            tot = len(site_map)
            covered = sum(1 for s in site_map.values() if s["covered"])
            tier_counts = {t: 0 for t in TIERS}
            tier_total = 0
            for s in site_map.values():
                if s["tier"]:
                    tier_counts[s["tier"]] += 1
                    tier_total += 1
            vol = est_volume.get((product, area), 0.0)
            rows_out.append({
                "area":             area,
                "tot_sites":        tot,
                "estimated_volume": int(round(vol)) if vol else None,
                "coverage_pct":     (covered / tot) if tot else None,
                "low":  (tier_counts["Low"]  / tier_total) if tier_total else None,
                "mid":  (tier_counts["Mid"]  / tier_total) if tier_total else None,
                "high": (tier_counts["High"] / tier_total) if tier_total else None,
            })
        if rows_out:
            blocks.append({"product": product, "rows": rows_out})
    return blocks

coverage_sheet = next((s for s in raw["sheets"] if s["name"].strip().lower() == "coverage"), None)
coverage_efficiency = build_coverage_efficiency(coverage_sheet["rows"]) if coverage_sheet else []

# Top sites by shipments per Geographical Area (YTD April 2026, same window
# as the rest of the page). Used by the map ranking panel.
agg_site_area = defaultdict(lambda: {"shipments": 0.0, "products": set(), "site_types": set()})
for r in db_rows[1:]:
    y, m = year_month(r[DB_IDX["Month/Year"]])
    if y != CUR_YEAR or m not in YTD_MONTHS:
        continue
    site = r[DB_IDX["Site"]]
    area = effective_geo(r)
    if not site or not area:
        continue
    ship = to_float(r[DB_IDX["Shipments"]])
    rec = agg_site_area[(area, site)]
    rec["shipments"] += ship
    if r[DB_IDX["Product"]]:    rec["products"].add(r[DB_IDX["Product"]])
    if r[DB_IDX["Site Type"]]:  rec["site_types"].add(r[DB_IDX["Site Type"]])

top_sites_by_area = {}
for (area, site), info in agg_site_area.items():
    if info["shipments"] <= 0:
        continue
    top_sites_by_area.setdefault(area, []).append({
        "site":       site,
        "shipments":  int(round(info["shipments"])),
        "products":   sorted(info["products"]),
        "site_types": sorted(info["site_types"]),
    })
for area in top_sites_by_area:
    top_sites_by_area[area].sort(key=lambda x: x["shipments"], reverse=True)
    top_sites_by_area[area] = top_sites_by_area[area][:3]

# Compute per-site biggest product category + share of that category
# within its Geographical Area (same YTD window).
agg_site_product = defaultdict(float)   # (area, site, product) -> shipments
agg_area_product = defaultdict(float)   # (area, product)       -> shipments
for r in db_rows[1:]:
    y, m = year_month(r[DB_IDX["Month/Year"]])
    if y != CUR_YEAR or m not in YTD_MONTHS:
        continue
    site    = r[DB_IDX["Site"]]
    area    = effective_geo(r)
    product = r[DB_IDX["Product"]]
    if not site or not area or not product:
        continue
    ship = to_float(r[DB_IDX["Shipments"]])
    agg_site_product[(area, site, product)] += ship
    agg_area_product[(area, product)]       += ship

for area, top_sites in top_sites_by_area.items():
    for s in top_sites:
        per_product = {p: agg_site_product[(area, s["site"], p)]
                       for p in PRODUCTS_ORDER
                       if agg_site_product[(area, s["site"], p)] > 0}
        if not per_product:
            s["top_product"] = None
            s["top_product_shipments"] = 0
            s["share_pct"] = None
            continue
        biggest = max(per_product, key=per_product.get)
        site_in_cat  = per_product[biggest]
        total_in_cat = agg_area_product[(area, biggest)]
        s["top_product"] = biggest
        s["top_product_shipments"] = int(round(site_in_cat))
        s["share_pct"] = (site_in_cat / total_in_cat) if total_in_cat > 0 else None

# Pivot: same data grouped by Area instead of by Product (rows = products).
AREA_ORDER = ["EMEA", "LATAM", "APAC", "NA"]
coverage_by_area = []
for area in AREA_ORDER:
    rows = []
    for block in coverage_efficiency:
        match = next((r for r in block["rows"] if r["area"] == area), None)
        if match is None:
            continue
        rows.append({
            "product":          block["product"],
            "tot_sites":        match["tot_sites"],
            "estimated_volume": match["estimated_volume"],
            "coverage_pct":     match["coverage_pct"],
            "low":              match["low"],
            "mid":              match["mid"],
            "high":             match["high"],
        })
    if rows:
        coverage_by_area.append({"area": area, "rows": rows})

# ---------------------------------------------------------------------------
# (Legacy) synthetic missing/review sites — kept for now but no longer surfaced
# on the Coverage page. The view above is the canonical layout.
# ---------------------------------------------------------------------------
FAKE_COVERAGE_SITES = [
    # ---- Missing (not yet feeding data into Galileo) ----------------------
    {"site": "ACME Manila",             "geo": "APAC",  "market": "REP", "product": "RX",              "site_type": "Local Labs to ECP",     "status": "missing", "reason": "Data feed not configured",        "owner": "S. Lee",       "eta": "—"},
    {"site": "VisionTech Hyderabad",    "geo": "APAC",  "market": "REP", "product": "RX",              "site_type": "Export Labs",           "status": "missing", "reason": "Awaiting IT approval",            "owner": "R. Patel",     "eta": "—"},
    {"site": "FrameWorks Hanoi",        "geo": "APAC",  "market": "REP", "product": "Finished Frames", "site_type": "Primary DC",            "status": "missing", "reason": "Legacy ERP not migrated",         "owner": "T. Nguyen",    "eta": "—"},
    {"site": "Pearle Antwerp",          "geo": "EMEA",  "market": "REP", "product": "Finished Frames", "site_type": "Secondary DC",          "status": "missing", "reason": "ETL job in QA",                   "owner": "J. Vermeer",   "eta": "—"},
    {"site": "SunOptics Madrid",        "geo": "EMEA",  "market": "REP", "product": "Stock Lenses",    "site_type": "Mass Production | DCs", "status": "missing", "reason": "Awaiting data contract",          "owner": "M. García",    "eta": "—"},
    {"site": "EuroFrames Warsaw",       "geo": "EMEA",  "market": "LM",  "product": "GV Frames",       "site_type": "Secondary DC",          "status": "missing", "reason": "Source system change ongoing",    "owner": "K. Nowak",     "eta": "—"},
    {"site": "AfroVision Lagos",        "geo": "EMEA",  "market": "LM",  "product": "RX",              "site_type": "Local Labs to ECP",     "status": "missing", "reason": "Connectivity issues",             "owner": "O. Adeyemi",   "eta": "—"},
    {"site": "OptiMex Guadalajara",     "geo": "LATAM", "market": "REP", "product": "RX",              "site_type": "Nearshore Labs",        "status": "missing", "reason": "Pending master-data alignment",   "owner": "L. Hernández", "eta": "—"},
    {"site": "VisionAndes Quito",       "geo": "LATAM", "market": "LM",  "product": "RX",              "site_type": "Local Labs to ECP",     "status": "missing", "reason": "Scoped, not started",             "owner": "C. Rodríguez", "eta": "—"},
    {"site": "SudVision Rosario",       "geo": "LATAM", "market": "REP", "product": "Stock Lenses",    "site_type": "Secondary DC",          "status": "missing", "reason": "Awaiting business owner",         "owner": "F. López",     "eta": "—"},
    {"site": "NorthLens Toronto",       "geo": "NA",    "market": "REP", "product": "Stock Lenses",    "site_type": "Primary DC",            "status": "missing", "reason": "ERP migration in 2027",           "owner": "D. Smith",     "eta": "—"},
    {"site": "FrameWorks Calgary",      "geo": "NA",    "market": "REP", "product": "GV Frames",       "site_type": "Fulfilment Center",     "status": "missing", "reason": "Out of scope (low volume)",       "owner": "B. Wilson",    "eta": "—"},
    {"site": "LensCraft Houston",       "geo": "NA",    "market": "LM",  "product": "Stock Lenses",    "site_type": "Mass Production | DCs", "status": "missing", "reason": "Source extract failing",          "owner": "M. Brown",     "eta": "—"},

    # ---- Under review / in progress ---------------------------------------
    {"site": "EastOptic Shanghai",      "geo": "APAC",  "market": "REP", "product": "RX",              "site_type": "Export Labs",           "status": "review", "reason": "Integration sprint planned",      "owner": "Z. Wang",      "eta": "2026-09-30"},
    {"site": "Vision Kyoto",            "geo": "APAC",  "market": "REP", "product": "GV Frames",       "site_type": "Secondary DC",          "status": "review", "reason": "Data mapping in QA",              "owner": "H. Tanaka",    "eta": "2026-07-15"},
    {"site": "PacificFrames Auckland",  "geo": "APAC",  "market": "REP", "product": "Finished Frames", "site_type": "Fulfilment Center",     "status": "review", "reason": "Onboarding kickoff",              "owner": "R. Williams",  "eta": "2026-11-30"},
    {"site": "ItalOttica Milano",       "geo": "EMEA",  "market": "REP", "product": "Finished Frames", "site_type": "Primary DC",            "status": "review", "reason": "UAT in progress",                 "owner": "G. Rossi",     "eta": "2026-06-30"},
    {"site": "VisionBeauty Paris",      "geo": "EMEA",  "market": "REP", "product": "GV Frames",       "site_type": "Primary DC",            "status": "review", "reason": "Source feed validated",           "owner": "P. Dubois",    "eta": "2026-08-31"},
    {"site": "SafiraOptics Lisboa",     "geo": "EMEA",  "market": "REP", "product": "Stock Lenses",    "site_type": "Secondary DC",          "status": "review", "reason": "Initial extract reviewed",        "owner": "A. Santos",    "eta": "2026-10-31"},
    {"site": "AlpenOptik Zurich",       "geo": "EMEA",  "market": "REP", "product": "Finished Frames", "site_type": "Primary DC",            "status": "review", "reason": "Schema mapping",                  "owner": "U. Müller",    "eta": "2026-09-30"},
    {"site": "AndinoLens Lima",         "geo": "LATAM", "market": "REP", "product": "RX",              "site_type": "Nearshore Labs",        "status": "review", "reason": "Integration tests passed",        "owner": "M. Vargas",    "eta": "2026-08-31"},
    {"site": "ChileVision Santiago",    "geo": "LATAM", "market": "LM",  "product": "RX",              "site_type": "Local Labs to ECP",     "status": "review", "reason": "Pilot data flowing",              "owner": "P. Muñoz",     "eta": "2026-07-31"},
    {"site": "VisionDallas",            "geo": "NA",    "market": "REP", "product": "Stock Lenses",    "site_type": "Mass Production | DCs", "status": "review", "reason": "Schema alignment",                "owner": "T. Garcia",    "eta": "2026-09-15"},
    {"site": "NorthernSight Vancouver", "geo": "NA",    "market": "REP", "product": "RX",              "site_type": "Export Labs",           "status": "review", "reason": "Connectivity OK, data validation","owner": "S. Park",      "eta": "2026-10-15"},
]

# Pre-aggregate counts per product (so the page can update KPIs instantly).
def _count(sites, *, status, product):
    return sum(1 for s in sites
               if s["status"] == status and (product == "ALL" or s["product"] == product))

counts_by_product = {"expected": {}, "covered": {}, "missing": {}, "review": {}, "coverage_pct": {}}
for p in product_options:
    cov  = sites_in_db_by_product.get(p, 0)
    miss = _count(FAKE_COVERAGE_SITES, status="missing", product=p)
    rev  = _count(FAKE_COVERAGE_SITES, status="review",  product=p)
    exp  = cov + miss + rev
    counts_by_product["covered"][p]      = cov
    counts_by_product["missing"][p]      = miss
    counts_by_product["review"][p]       = rev
    counts_by_product["expected"][p]     = exp
    counts_by_product["coverage_pct"][p] = (cov / exp) if exp else 0


coverage_page = {
    "intro": (
        "Coverage & efficiency view per product and Geographical Area. "
        "Tot sites and Coverage % vol come from the per-site Coverage sheet "
        "(covered sites over total); Estimated volume is the current-YTD Pieces "
        "from the main DB for that product and area; Low / Mid / High is the "
        "share of sites in each Automation tier."
    ),
    "wip_status": "Built from the per-site Coverage sheet.",
    "product_options":      [GEO_ALL] + PRODUCTS_ORDER,
    "area_options":         [GEO_ALL] + AREA_ORDER,
    "coverage_efficiency":  coverage_efficiency,
    "coverage_by_area":     coverage_by_area,
    "top_sites_by_area":    top_sites_by_area,
    "top_sites_period":     "YTD April 2026",
    "columns": [
        {"key": "area",             "label": "Area",                                  "format": "text"},
        {"key": "tot_sites",        "label": "Tot sites",                             "format": "int"},
        {"key": "estimated_volume", "label": "Estimated volume",                      "format": "int"},
        {"key": "coverage_pct",     "label": "Coverage % vol",                        "format": "coverage"},
        {"key": "low",              "label": "Low",                                   "format": "pct",  "tier": "low"},
        {"key": "mid",              "label": "Mid",                                   "format": "pct",  "tier": "mid"},
        {"key": "high",             "label": "High",                                  "format": "pct",  "tier": "high"},
    ],
}


# ---------------------------------------------------------------------------
# Database page — browsable DB + mapping (per area).
# Emitted compactly (array-of-arrays) into a separate db.js so content.js stays
# small. The app filters/searches client-side and scopes by the selected area.
# ---------------------------------------------------------------------------
DB_PAGE_COLS = [
    {"key": "month",      "label": "Month",             "type": "text"},
    {"key": "site",       "label": "Site",              "type": "text"},
    {"key": "market",     "label": "Market",            "type": "text"},
    {"key": "product",    "label": "Product",           "type": "text"},
    {"key": "site_type",  "label": "Site Type",         "type": "text"},
    {"key": "pieces",     "label": "Pieces",            "type": "int"},
    {"key": "shipments",  "label": "Shipments",         "type": "int"},
    {"key": "geo",        "label": "Geographical Area", "type": "text"},
    {"key": "acct",       "label": "Accounting Area",   "type": "text"},
    {"key": "customer",   "label": "Customer Country",  "type": "text"},
]

def _ym_label(s):
    y, m = year_month(s)
    return f"{y:04d}-{m:02d}" if y else (s or "")

def _int(s):
    try:    return int(round(float(s)))
    except: return 0

db_records = []
for r in db_rows[1:]:
    if not any(c.strip() for c in r):
        continue
    db_records.append([
        _ym_label(r[DB_IDX["Month/Year"]]),
        r[DB_IDX["Site"]],
        r[DB_IDX["Market"]],
        r[DB_IDX["Product"]],
        r[DB_IDX["Site Type"]],
        _int(r[DB_IDX["Pieces"]]),
        _int(r[DB_IDX["Shipments"]]),
        (r[DB_IDX["Geographical Area"]] or "").strip(),   # raw source value (col 7)
        (r[DB_IDX[ACCT_COL]] or "").strip(),
        (r[DB_IDX["Customer Country"]] or "").strip(),
        effective_geo(r),                                  # hidden: area used for filtering (col 10)
    ])

# ---------------------------------------------------------------------------
# Mapping reference. PRIMARY source = the Excel "Mapping" sheet (per-plant);
# FALLBACK = derive unique (Product, Site Type) pairs from the DB. Either way
# the Content destination (category · sub-category) comes from sheet1_key_for.
# ---------------------------------------------------------------------------
def _norm_hdr(h):
    return re.sub(r"[^a-z0-9]+", " ", (h or "").lower()).strip()

def _resolve_col(hmap, *aliases):
    for a in aliases:
        if a in hmap:
            return hmap[a]
    return None

# Named LM flows by site code (mirrors EXPORT_LABS_LM_EMEA_FLOWS, defined later
# in this module for the drill — duplicated here as a small literal to avoid
# reordering, kept in sync intentionally).
_FLOW_BY_SITE = {"VRX INDIA": "Glassed Direct", "ELTL": "Brille 24"}

def _content_dest(product, site_type):
    s1 = sheet1_key_for(product, site_type)
    if s1:
        return s1[0], s1[1], f"{s1[0]} · {s1[1]}", True
    return None, None, None, False

def build_mapping_from_sheet(sheet):
    rows = sheet["rows"]
    if not rows:
        return None
    hmap = {_norm_hdr(c): i for i, c in enumerate(rows[0])}
    iSite   = _resolve_col(hmap, "sites", "site", "plant")
    iRaw    = _resolve_col(hmap, "raw sites names", "raw site name", "raw site")
    iMarket = _resolve_col(hmap, "market")
    iProd   = _resolve_col(hmap, "product")
    iType   = _resolve_col(hmap, "site type", "sitetype")
    iGeo    = _resolve_col(hmap, "area", "geographical area", "geo")
    iSource = _resolve_col(hmap, "source")
    iOwner  = _resolve_col(hmap, "owner")
    iFlow   = _resolve_col(hmap, "flow")
    iNote   = _resolve_col(hmap, "notes", "note", "rule", "logic", "comment")
    # Optional content columns if the sheet ever provides them directly.
    iCat    = _resolve_col(hmap, "content category")
    iSub    = _resolve_col(hmap, "content sub category", "content subcategory")
    iMaps   = _resolve_col(hmap, "maps to", "destination")
    if iProd is None or iType is None:
        return None  # not a usable mapping sheet

    def g(r, i):
        return (r[i].strip() if (i is not None and i < len(r)) else "")

    out = []
    for r in rows[1:]:
        product   = g(r, iProd)
        site_type = g(r, iType)
        if not product and not g(r, iSite):
            continue
        cat, sub, maps_to, in_perim = _content_dest(product, site_type)
        # Let explicit sheet columns override the derived destination.
        if iCat is not None and g(r, iCat):
            cat = g(r, iCat)
        if iSub is not None and g(r, iSub):
            sub = g(r, iSub)
        if iMaps is not None and g(r, iMaps):
            maps_to = g(r, iMaps)
            in_perim = True
        site = g(r, iSite)
        raw_site = g(r, iRaw)
        flow = (_FLOW_BY_SITE.get(site.upper()) or _FLOW_BY_SITE.get(raw_site.upper())
                or g(r, iFlow) or None)
        # Build an explanatory note (rule) from Source/Owner when present.
        note = g(r, iNote)
        if not note:
            bits = []
            if iSource is not None and g(r, iSource): bits.append(f"Source: {g(r, iSource)}")
            if iOwner is not None and g(r, iOwner):   bits.append(f"Owner: {g(r, iOwner)}")
            note = " · ".join(bits)
        out.append({
            "site":                 site or None,
            "raw_site":             raw_site or None,
            "flow":                 flow,
            "market":               g(r, iMarket) or None,
            "product":              product,
            "site_type":            site_type,
            "geo":                  g(r, iGeo) or None,
            "content_category":     cat,
            "content_sub_category": sub,
            "maps_to":              maps_to,
            "in_perimeter":         in_perim,
            "source":               g(r, iSource) or None,
            "owner":                g(r, iOwner) or None,
            "note":                 note or None,
        })
    return out or None

def build_mapping_fallback():
    seen_pairs = {}
    for r in db_rows[1:]:
        product   = (r[DB_IDX["Product"]] or "").strip()
        site_type = (r[DB_IDX["Site Type"]] or "").strip()
        if not product:
            continue
        key = (product, site_type)
        if key in seen_pairs:
            continue
        cat, sub, maps_to, in_perim = _content_dest(product, site_type)
        seen_pairs[key] = {
            "site": None, "raw_site": None, "flow": None, "market": None,
            "product": product, "site_type": site_type, "geo": None,
            "content_category": cat, "content_sub_category": sub,
            "maps_to": maps_to, "in_perimeter": in_perim,
            "source": None, "owner": None,
            "note": "Derived from (Product · Site Type); no Mapping sheet present.",
        }
    return sorted(seen_pairs.values(),
                  key=lambda x: (not x["in_perimeter"], x["product"], x["site_type"]))

mapping_sheet = next((s for s in raw["sheets"] if "mapping" in s["name"].strip().lower()), None)
db_mapping = build_mapping_from_sheet(mapping_sheet) if mapping_sheet else None
if db_mapping:
    mapping_source = "sheet"
    # Keep the Excel sheet's own row order — the UI mirrors the workbook 1:1.
else:
    db_mapping = build_mapping_fallback()
    mapping_source = "derived"

# Distinct filter options for the Database grid.
def _distinct(i):
    return sorted({row[i] for row in db_records if row[i]})
database_page = {
    "columns":      DB_PAGE_COLS,
    "filters": [
        {"key": "market",    "label": "Market",     "col": 2, "options": _distinct(2)},
        {"key": "product",   "label": "Product",    "col": 3, "options": _distinct(3)},
        {"key": "site_type", "label": "Site Type",  "col": 4, "options": _distinct(4)},
    ],
    "geo_col":      10,   # effective area (Export Labs->EMEA rule applied) for filtering
    "acct_col":     8,
    "row_count":    len(db_records),
    "mapping":      db_mapping,
    "mapping_source": mapping_source,
    "page_size":    50,
}


# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------
content = {
    "source_file":        raw["source_file"],
    "geo_options":        [GEO_ALL] + GEOS,
    "accounting_options": [GEO_ALL] + ACCT_AREAS,
    "current_view":       current_view,
    "export_labs_sites":  export_labs_sites,
    "coverage_page":      coverage_page,
    "database_page":      database_page,
}

content_str = json.dumps(content, ensure_ascii=False)
db_str = json.dumps(db_records, ensure_ascii=False)

out_json = DATA / "content.json"
out_json.write_text(content_str, encoding="utf-8")
out_js = DATA / "content.js"
out_js.write_text("window.CONTENT = " + content_str + ";\n", encoding="utf-8")

# DB rows in a separate, compact file (prototype) + plain JSON array (Next port).
out_db = DATA / "db.js"
out_db.write_text("window.DB = " + db_str + ";\n", encoding="utf-8")
(DATA / "db.json").write_text(db_str, encoding="utf-8")
print(f"Wrote {out_db}  ({out_db.stat().st_size:,} bytes, {len(db_records):,} rows)")

# Keep the Next port's data in sync (content.json + db.json) when it exists.
if APP_DATA.exists():
    (APP_DATA / "content.json").write_text(content_str, encoding="utf-8")
    (APP_DATA / "db.json").write_text(db_str, encoding="utf-8")
    print(f"Synced -> {APP_DATA/'content.json'} and {APP_DATA/'db.json'}")
else:
    print(f"(app-next data dir not found at {APP_DATA}; skipped Next sync)")

print(f"Wrote {out_json}  ({out_json.stat().st_size:,} bytes)")
print(f"Wrote {out_js}")
print(f"  mapping source            : {mapping_source} ({len(db_mapping)} rows)")
print(f"  current_view rows         : {len(current_rows)}")
print(f"  Export Labs sites in drill: {len(export_labs_sites)}")

# Sanity vs Sheet 1 (ALL geo)
ALL = GEO_ALL
for meta in current_rows:
    p = meta["geo_data"][ALL]["pieces"]
    s = meta["geo_data"][ALL]["shipments"]
    print(f"  [{meta['category']:>14} / {meta['sub_category']:<24}]  Pieces REP {p['rep']:>15,.0f}   LM {p['lm']:>13,.0f}   Ship REP {s['rep']:>10,.0f}")
