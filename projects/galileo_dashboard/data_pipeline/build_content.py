"""Build content.json + db.json from raw.json (Databricks extract).

Ported from reference-data-pipeline/build_content.py. Differences:
  * Input sheets are found by NAME (DB / Coverage / Mapping) from the Databricks
    extract, not by workbook position.
  * The old "Sheet 1" (row labels / coverage% / driver / scope / year) has no
    source table, so its hand-curated values live in STRUCTURAL below (seeded
    from the last committed content.json). Everything else is derived from data.
  * The reporting window (current year / prior year / YTD months) is derived
    from the data by default (env-overridable) instead of hard-coded.
  * coverage_galileo preserves the authoritative Galileo Frontend.xlsx Coverage
    columns and formulas. The source Coverage percentage is authoritative at
    Product x Area grain; Estimated Volume remains the aggregation weight.
  * Output goes straight to ../src/data (no app-next mirror).
"""
import json
import os
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
# Both paths are env-overridable so the Flask app can run this pipeline into a
# scratch directory at request time (see ../data_service.py) instead of writing
# into the repo. Unset, they keep the offline behaviour run.py relies on.
DATA = Path(os.environ.get("GALILEO_DATA_DIR") or ROOT / "src" / "data")
RAW = Path(os.environ.get("GALILEO_RAW_JSON") or ROOT / "data_pipeline" / "data" / "raw.json")
raw = json.loads(RAW.read_text(encoding="utf-8"))

_SHEETS = {s["name"]: s for s in raw["sheets"]}


# ---------------------------------------------------------------------------
# Structural metadata (was "Sheet 1"). No source table — hand-curated.
# Seeded from the last committed content.json; keep category/sub_category EXACTLY
# matching sheet1_key_for() outputs (they are the join keys). External Suppliers
# is intentionally excluded (the reference dropped it).
# ---------------------------------------------------------------------------
STRUCT_SCOPE = "GLOBAL"
STRUCTURAL_ROWS = [
    {"category": "Frames",       "sub_category": "Finished Frames",       "coverage": 0.98, "driver": "Pieces"},
    {"category": "Frames",       "sub_category": "GV Frames*",            "coverage": 1,    "driver": "Pieces"},
    {"category": "Stock Lenses", "sub_category": "Mass Production | DCs", "coverage": 0.95, "driver": "Single Lens"},
    {"category": "RX Lenses",    "sub_category": "Export Labs",           "coverage": 1,    "driver": "Jobs"},
    {"category": "RX Lenses",    "sub_category": "Nearshore Labs",        "coverage": 1,    "driver": "Jobs"},
    {"category": "RX Lenses",    "sub_category": "Local Labs to ECP",     "coverage": 0.9,  "driver": "Jobs"},
]
current_rows_meta = [dict(r) for r in STRUCTURAL_ROWS]


# ---------------------------------------------------------------------------
# DB sheet — full shipment fact table
# ---------------------------------------------------------------------------
db_rows = _SHEETS["DB"]["rows"]
DB_IDX  = {c: i for i, c in enumerate(db_rows[0])}

YM_RE = re.compile(r"^(\d{4})-(\d{2})")
def year_month(s):
    m = YM_RE.match(s or "")
    return (int(m.group(1)), int(m.group(2))) if m else (None, None)
def to_float(s):
    try:    return float(s) if s not in ("", None, "-") else 0.0
    except: return 0.0


# Reporting window — derived from the data (env-overridable). PY = CUR - 1.
_years = sorted({year_month(r[DB_IDX["Month/Year"]])[0]
                 for r in db_rows[1:] if year_month(r[DB_IDX["Month/Year"]])[0]})
CUR_YEAR = int(os.environ.get("GALILEO_CUR_YEAR") or (_years[-1] if _years else 0))
PY_YEAR  = CUR_YEAR - 1
_env_months = os.environ.get("GALILEO_YTD_MONTHS")
if _env_months:
    YTD_MONTHS = tuple(int(x) for x in _env_months.split(",") if x.strip())
else:
    # YTD = Jan..K where K is the last *material* CUR_YEAR month. The table is
    # pre-populated with placeholder future months (near-zero pieces), so we
    # can't just take "every month present": we take months whose pieces reach
    # a fraction of the busiest month, then the contiguous run from January.
    _cur_pieces = defaultdict(float)
    for r in db_rows[1:]:
        _y, _m = year_month(r[DB_IDX["Month/Year"]])
        if _y == CUR_YEAR and _m:
            _cur_pieces[_m] += to_float(r[DB_IDX["Pieces"]])
    _thresh = 0.1 * max(_cur_pieces.values(), default=0.0)
    _last = 0
    for _m in range(1, 13):
        if _cur_pieces.get(_m, 0.0) >= _thresh and _cur_pieces.get(_m, 0.0) > 0:
            _last = _m
        else:
            break  # stop at first non-material month -> contiguous YTD
    YTD_MONTHS = tuple(range(1, _last + 1))
# Presentation order, mirrored by GEO_AREAS in src/data/geo.ts — keep in sync.
GEOS       = ["EMEA", "NA", "APAC", "LATAM"]
GEO_ALL    = "ALL"
print(f"  window: CUR {CUR_YEAR}  PY {PY_YEAR}  YTD months {YTD_MONTHS}")

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


MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
               "August", "September", "October", "November", "December"]
PERIOD_NUMBER = max(YTD_MONTHS) if YTD_MONTHS else 0
PERIOD_LABEL = f"YTD {MONTH_NAMES[PERIOD_NUMBER - 1]}" if PERIOD_NUMBER else "YTD"

current_view = {
    "scope": STRUCT_SCOPE,
    "year":  str(CUR_YEAR),
    "period_number": str(PERIOD_NUMBER),
    "period_label": PERIOD_LABEL,
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
for site in sorted(export_labs_agg.keys() | export_labs_acct_agg.keys()):
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
# ---------------------------------------------------------------------------
PERIODS = list(YTD_MONTHS)


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
    # sorted(): the set union has no stable order, so without this the JSON keys
    # come out shuffled on every run and the payload's ETag churns even when the
    # data has not changed.
    for site in sorted(el.keys() | ela.keys()):
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
# Coverage page
# ---------------------------------------------------------------------------
# Distinct sites per product (and overall) — "Sites covered in Galileo" KPI.
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

PRODUCTS_ORDER = ["Finished Frames", "GV Frames", "RX", "Stock Lenses"]
AREAS = {"EMEA", "LATAM", "APAC", "NA"}
TIERS = ["Low", "Mid", "High"]

# Coverage & Efficiency consumes the authoritative Product x Area percentage
# already published in the Coverage column of Coverage Galileo.csv. The same
# value is expected on every row in a group; the builder validates that contract
# instead of deriving a second percentage from Galileo/Estimated Volume.
# Estimated Volume still sums every CSV row, while Tot sites and Automation
# shares count distinct site names.

def norm_area(s):
    return (s or "").strip().upper()

def norm_tier(s):
    t = (s or "").strip().capitalize()
    return t if t in TIERS else None

def parse_pct(s):
    """'94%' -> 0.94 ; '1' -> 1.0 ; '' / None -> None."""
    if s is None:
        return None
    t = str(s).strip().replace("%", "")
    if t == "":
        return None
    try:
        v = float(t)
    except ValueError:
        return None
    return v / 100.0 if "%" in str(s) else (v if v <= 1 else v / 100.0)

def build_coverage_efficiency(rows):
    """Consume the source Coverage percentage at Product x Area grain.

    Estimated volume sums rows, so duplicate site names both count. Tot sites
    and Automation tiers count distinct site names.
    """
    hdr = {c.strip(): i for i, c in enumerate(rows[0]) if c and str(c).strip()}
    required = {
        "Site", "Product", "Site Type", "Galileo Volume", "Coverage",
        "Estimated Volume", "Area", "Automation",
    }
    missing = sorted(required - hdr.keys())
    if missing:
        raise ValueError(
            "coverage_galileo is missing required columns: " + ", ".join(missing)
        )
    iSite = hdr["Site"]
    iProd = hdr["Product"]
    iArea = hdr["Area"]
    iAuto = hdr["Automation"]
    iEst = hdr["Estimated Volume"]
    iGal = hdr["Galileo Volume"]
    iCov = hdr["Coverage"]

    groups = defaultdict(lambda: {
        "rows": [],
        "sites": {},
        "coverage_values": [],
    })
    for r in rows[1:]:
        site = (r[iSite] or "").strip()
        product = (r[iProd] or "").strip()
        area    = norm_area(r[iArea])
        if not site or product not in PRODUCTS_ORDER or area not in AREAS:
            continue
        est = to_float(r[iEst])
        gal = to_float(r[iGal])
        cov_raw = r[iCov]
        coverage = parse_pct(cov_raw)
        if str(cov_raw or "").strip() and coverage is None:
            raise ValueError(
                f"invalid Coverage value for {product} / {area}: {cov_raw!r}"
            )
        if coverage is not None and not 0 <= coverage <= 1:
            raise ValueError(
                f"Coverage value outside 0-100% for {product} / {area}: {cov_raw!r}"
            )
        tier = norm_tier(r[iAuto])
        group = groups[(product, area)]
        group["rows"].append({"est": est, "galileo": gal})
        if coverage is not None:
            group["coverage_values"].append(coverage)
        site_rec = group["sites"].setdefault(site, {"tier": None, "galileo": 0.0})
        site_rec["galileo"] = max(site_rec["galileo"], gal)
        if tier and site_rec["tier"] is None:
            site_rec["tier"] = tier

    blocks = []
    for product in PRODUCTS_ORDER:
        rows_out = []
        for area in GEOS:
            group = groups.get((product, area))
            if not group or not group["rows"]:
                continue
            estimated_total = 0.0
            for row in group["rows"]:
                estimated_total += row["est"]
            coverage_values = group["coverage_values"]
            coverage_pct = coverage_values[0] if coverage_values else None
            if coverage_pct is not None and any(
                abs(value - coverage_pct) > 1e-6
                for value in coverage_values[1:]
            ):
                values = ", ".join(f"{value:.6g}" for value in sorted(set(coverage_values)))
                raise ValueError(
                    f"inconsistent Coverage values for {product} / {area}: {values}"
                )
            tier_counts = {t: 0 for t in TIERS}
            tier_total = 0
            for site in group["sites"].values():
                if site["tier"]:
                    tier_counts[site["tier"]] += 1
                    tier_total += 1
            rows_out.append({
                "area":             area,
                "tot_sites":        len(group["sites"]),
                "estimated_volume": int(round(estimated_total)) if estimated_total else None,
                "coverage_pct":     coverage_pct,
                "low":  (tier_counts["Low"]  / tier_total) if tier_total else None,
                "mid":  (tier_counts["Mid"]  / tier_total) if tier_total else None,
                "high": (tier_counts["High"] / tier_total) if tier_total else None,
            })
        if rows_out:
            blocks.append({"product": product, "rows": rows_out})
    return blocks

coverage_sheet = _SHEETS.get("Coverage")
coverage_efficiency = build_coverage_efficiency(coverage_sheet["rows"]) if coverage_sheet else []

# ---------------------------------------------------------------------------
# Sites not mapped — census sites that don't feed Galileo yet, grouped by
# product family. Powers the "Sites not mapped" panel on the Coverage page
# (components/coverage/MappingsUnderReview.tsx).
#
# The production contract detects "not mapped" from the Galileo Volume column
# (E == 0) and weighs each site by its Estimated Volume (G) share of the product
# x area total. Compatibility with old inputs degrades in order:
#     Galileo Volume  ->  Mapping flag  ->  Coverage % == 0
# and falls back to null volumes, which the UI renders as "under review".
# The key is ALWAYS emitted (possibly []) — CoveragePage.mappings_under_review
# is non-optional in src/data/types.ts.
# ---------------------------------------------------------------------------
PRODUCT_FAMILY = {
    "RX": "RX",
    "Stock Lenses": "Stock Lenses",
    "Finished Frames": "Frames",
    "GV Frames": "Frames",
}
FAMILY_ORDER = ["Frames", "RX", "Stock Lenses"]


def build_mappings_under_review(rows):
    hdr = {c.strip(): i for i, c in enumerate(rows[0]) if c and str(c).strip()}
    iSite, iProd, iArea = hdr.get("Site"), hdr.get("Product"), hdr.get("Area")
    if iSite is None or iProd is None or iArea is None:
        return []
    iType = hdr.get("Site Type")
    iGal  = hdr.get("Galileo Volume")
    iEst  = hdr.get("Estimated Volume")
    iMap  = hdr.get("Mapping")          # explicit flag, older workbooks
    iCov  = hdr.get("Coverage")
    if iGal is None and iMap is None and iCov is None:
        print("  mappings_under_review: no Galileo Volume / Mapping / Coverage "
              "column in the coverage table — emitting []")
        return []

    fam_area_vol = defaultdict(float)   # (family, area) -> total estimated volume
    fam_sites = defaultdict(dict)       # family -> site -> rec

    for r in rows[1:]:
        site    = (r[iSite] or "").strip()
        product = (r[iProd] or "").strip()
        area    = norm_area(r[iArea])
        if not site or product not in PRODUCTS_ORDER or area not in AREAS:
            continue
        fam = PRODUCT_FAMILY[product]
        est = to_float(r[iEst]) if iEst is not None else 0.0
        fam_area_vol[(fam, area)] += est

        if iGal is not None:
            not_mapped = to_float(r[iGal]) <= 0
        elif iMap is not None:
            flag = (r[iMap] or "").strip().upper()
            not_mapped = flag in ("", "NOT MAPPED", "NOT_MAPPED", "UNMAPPED", "NO")
        else:
            pct = parse_pct(r[iCov])
            not_mapped = pct is not None and pct <= 0

        site_type = (r[iType] or "").strip() if iType is not None else ""
        rec = fam_sites[fam].setdefault(site, {
            "not_mapped": True, "area": area,
            "site_type": site_type, "estimated_volume": 0.0,
        })
        # Any row feeding Galileo makes the whole site count as mapped.
        if not not_mapped:
            rec["not_mapped"] = False
        rec["estimated_volume"] += est
        if rec["not_mapped"]:
            rec["area"] = area
            if site_type:
                rec["site_type"] = site_type

    blocks = []
    for fam in FAMILY_ORDER:
        smap = fam_sites.get(fam, {})
        under = []
        for s, rec in smap.items():
            if not rec["not_mapped"]:
                continue
            est = rec["estimated_volume"]
            denom = fam_area_vol.get((fam, rec["area"]), 0.0)
            has_vol = est > 0 and denom > 0
            under.append({
                "site":             s,
                "area":             rec["area"],
                "site_type":        rec["site_type"],
                "estimated_volume": int(round(est)) if has_vol else None,
                "weight_pct":       (est / denom) if has_vol else None,
            })
        # Biggest coverage drag first; sites without volume ("under review") last.
        under.sort(key=lambda x: (
            0 if x["weight_pct"] is not None else 1,
            -(x["weight_pct"] or 0),
            x["area"],
            x["site"],
        ))
        blocks.append({
            "product":      fam,
            "under_review": len(under),
            "total":        len(smap),
            "sites":        under,
        })
    return blocks


mappings_under_review = (
    build_mappings_under_review(coverage_sheet["rows"]) if coverage_sheet else []
)

# Top sites by shipments per Geographical Area (current YTD window).
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

# Per-site biggest product category + share within its Geographical Area.
agg_site_product = defaultdict(float)
agg_area_product = defaultdict(float)
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

# Pivot: same data grouped by Area (rows = products).
AREA_ORDER = GEOS  # EMEA -> NA -> APAC -> LATAM
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


coverage_page = {
    "intro": (
        "Coverage & efficiency view per product and Geographical Area. "
        "Tot sites and Coverage % vol come from Coverage Galileo.csv; the "
        "source Coverage percentage is authoritative for each product and area, "
        "while Estimated volume is its reference weight; Low / Mid / High is "
        "the share of distinct sites in each Automation tier."
    ),
    "wip_status": "Built from Coverage Galileo.csv via coverage_galileo.",
    "product_options":      [GEO_ALL] + PRODUCTS_ORDER,
    "area_options":         [GEO_ALL] + AREA_ORDER,
    "coverage_efficiency":  coverage_efficiency,
    "coverage_by_area":     coverage_by_area,
    "mappings_under_review": mappings_under_review,
    "top_sites_by_area":    top_sites_by_area,
    "top_sites_period":     f"{PERIOD_LABEL} {CUR_YEAR}",
    "columns": [
        {"key": "area",             "label": "Area",              "format": "text"},
        {"key": "tot_sites",        "label": "Tot sites",         "format": "int"},
        {"key": "estimated_volume", "label": "Estimated volume",  "format": "int"},
        {"key": "coverage_pct",     "label": "Coverage % vol",    "format": "coverage"},
        {"key": "low",              "label": "Low",               "format": "pct",  "tier": "low"},
        {"key": "mid",              "label": "Mid",               "format": "pct",  "tier": "mid"},
        {"key": "high",             "label": "High",              "format": "pct",  "tier": "high"},
    ],
}


# ---------------------------------------------------------------------------
# Database page — browsable DB + mapping.
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
# Mapping reference. PRIMARY = mapping_galileo; FALLBACK = derive from DB.
# ---------------------------------------------------------------------------
def _norm_hdr(h):
    return re.sub(r"[^a-z0-9]+", " ", (h or "").lower()).strip()

def _resolve_col(hmap, *aliases):
    for a in aliases:
        if a in hmap:
            return hmap[a]
    return None

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
    iCat    = _resolve_col(hmap, "content category")
    iSub    = _resolve_col(hmap, "content sub category", "content subcategory")
    iMaps   = _resolve_col(hmap, "maps to", "destination")
    if iProd is None or iType is None:
        return None

    def g(r, i):
        return (r[i].strip() if (i is not None and i < len(r)) else "")

    out = []
    for r in rows[1:]:
        product   = g(r, iProd)
        site_type = g(r, iType)
        if not product and not g(r, iSite):
            continue
        cat, sub, maps_to, in_perim = _content_dest(product, site_type)
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
            "note": "Derived from (Product · Site Type); no Mapping table present.",
        }
    return sorted(seen_pairs.values(),
                  key=lambda x: (not x["in_perimeter"], x["product"], x["site_type"]))

mapping_sheet = _SHEETS.get("Mapping")
db_mapping = build_mapping_from_sheet(mapping_sheet) if mapping_sheet else None
if db_mapping:
    mapping_source = "sheet"
else:
    db_mapping = build_mapping_fallback()
    mapping_source = "derived"

def _distinct(i):
    return sorted({row[i] for row in db_records if row[i]})
database_page = {
    "columns":      DB_PAGE_COLS,
    "filters": [
        {"key": "market",    "label": "Market",     "col": 2, "options": _distinct(2)},
        {"key": "product",   "label": "Product",    "col": 3, "options": _distinct(3)},
        {"key": "site_type", "label": "Site Type",  "col": 4, "options": _distinct(4)},
    ],
    "geo_col":      10,
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

DATA.mkdir(parents=True, exist_ok=True)
(DATA / "content.json").write_text(content_str, encoding="utf-8")
(DATA / "db.json").write_text(db_str, encoding="utf-8")

print(f"Wrote {DATA/'content.json'}  ({len(content_str):,} bytes)")
print(f"Wrote {DATA/'db.json'}  ({len(db_str):,} bytes, {len(db_records):,} rows)")
print(f"  mapping source            : {mapping_source} ({len(db_mapping)} rows)")
print(f"  current_view rows         : {len(current_rows)}")
print(f"  Export Labs sites in drill: {len(export_labs_sites)}")

# Sanity vs the ALL geo column.
ALL = GEO_ALL
for meta in current_rows:
    p = meta["geo_data"][ALL]["pieces"]
    s = meta["geo_data"][ALL]["shipments"]
    print(f"  [{meta['category']:>14} / {meta['sub_category']:<24}]  "
          f"Pieces REP {p['rep']:>15,.0f}   LM {p['lm']:>13,.0f}   Ship REP {s['rep']:>10,.0f}")
