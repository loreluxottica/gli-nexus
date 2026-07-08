/**
 * Galileo data contract.
 *
 * Derived from the real prototype payloads:
 *   - data/content.js  -> window.CONTENT  (this file's `Content`)
 *   - data/db.js       -> window.DB        (this file's `DbRow[]`)
 *   - data/world_map.js-> window.WORLD_MAP_SVG (string)
 *
 * Numbers may be `null` (e.g. YoY% when the prior-year base is 0). Treat `null`
 * and `0` distinctly: the prototype renders both as an em-dash but they mean
 * "no base" vs "measured zero" — preserve the distinction in the type layer.
 */

/* ----------------------------------------------------------------- scoping */

/** Geographical Area — the top-level dimension that scopes every page. "ALL" = Global. */
export type GeoArea = "ALL" | "APAC" | "EMEA" | "LATAM" | "NA";

/** Accounting Area — currently sparse (only INTERNATIONAL has data). */
export type AcctArea = "ALL" | "INTERNATIONAL";

/** The three routes. */
export type PageId = "content" | "database" | "coverage";

export type Product = "RX" | "Stock Lenses" | "Finished Frames" | "GV Frames";
export type Market = "REP" | "LM";

/* ------------------------------------------------------------- metric cells */

/** One market's figures within a metric block. `*_yoy` is a ratio (0.09 = +9%); null when no PY base. */
export interface MarketMetrics {
  rep: number;
  rep_py: number;
  rep_yoy: number | null;
  lm: number;
  lm_py: number;
  lm_yoy: number | null;
}

/** A scoped cell: Pieces + Shipments blocks. */
export interface MetricCell {
  pieces: MarketMetrics;
  shipments: MarketMetrics;
}

/** Per-area metric maps. Keys are the scope values; not every area is always present. */
export type GeoDataMap = Partial<Record<GeoArea, MetricCell>>;
export type AcctDataMap = Partial<Record<AcctArea, MetricCell>>;

/* ----------------------------------------------------------- current_view */

export type MetricKey = "rep" | "rep_py" | "rep_yoy" | "lm" | "lm_py" | "lm_yoy";

export interface MetricColumn {
  key: MetricKey;
  label: string;
  desc: string; // column tooltip — must be exposed accessibly, not via title= alone
}

export interface RowColumn {
  key: "category" | "sub_category" | "coverage" | "driver";
  label: string;
}

export interface ContentRow {
  category: string;
  sub_category: string;
  coverage: number | null; // 0..1
  driver: string;
  geo_data: GeoDataMap;
  acct_data: AcctDataMap;
}

/** Just the per-scope metric maps for a row/site — the part that changes with
 *  the selected end month. Row meta (coverage, driver, labels) is structural. */
export interface PeriodCells {
  geo_data: GeoDataMap;
  acct_data: AcctDataMap;
}

/** Cumulative-YTD snapshot for one end month: row cells (in current_view.rows
 *  order) and Export Labs drill cells keyed by site. */
export interface PeriodSnapshot {
  rows: PeriodCells[];
  drills: Record<string, PeriodCells>;
}

export interface PeriodOption {
  n: number;
  label: string; // e.g. "YTD February"
}

export interface CurrentView {
  scope: string;
  year: string;
  period_number: string;
  period_label: string; // e.g. "YTD April"
  metric_blocks: string[]; // ["Pieces", "Shipments"]
  metric_columns: MetricColumn[];
  row_columns: RowColumn[];
  rows: ContentRow[];
  footnote: string;
  dimensions: { key: "geo" | "acct"; label: string; options: string[] }[];
  /** Per-end-month cells (keys "1".."4"); default view = the latest. */
  periods: Record<string, PeriodSnapshot>;
  period_options: PeriodOption[];
}

/* ------------------------------------------------------- content v2 comments */

/**
 * A human annotation on an efficiency KPI (a flow + market). Seeded ones live in
 * content_comments.json (committed = visible to everyone who opens the
 * dashboard); locally-added ones are kept in localStorage until published.
 */
export interface KpiComment {
  id: string;
  /** "Category|Sub-category" rowKey of the flow this comment is about. */
  flow: string;
  market: Market;
  /** GeoArea or "ALL" — the scope the insight refers to. */
  area: string;
  author: string;
  date: string; // yyyy-mm-dd
  text: string;
}

/* -------------------------------------------------------- content v2 site analysis */

export interface SiteMarketMetrics {
  pieces: { cur: number; py: number };
  shipments: { cur: number; py: number };
}

/** Lean single-plant summary, built from db.json by build_site_analysis.py.
 *  Powers the site-mention drill in efficiency comments. */
export interface SiteSummary {
  geo: string;
  areas: string[];
  products: string[];
  site_types: string[];
  rep: SiteMarketMetrics;
  lm: SiteMarketMetrics;
}

export interface SiteAnalysisData {
  year: number;
  prior_year: number;
  period_label: string;
  sites: Record<string, SiteSummary>;
  /** flow ("Category|Sub-category") → area ("ALL"|GeoArea) → plants that feed
   *  it. Drives the comment site picker: only sites belonging to the section
   *  (flow + area) being commented on are taggable. */
  flow_sites: Record<string, Record<string, string[]>>;
  /** period ("1".."4") → flow → area → site → [repPcur, repPpy, repScur,
   *  repSpy, lmPcur, lmPpy, lmScur, lmSpy]. Per-site figures within a flow+area
   *  (effective geo, same attribution as the Content cells), cumulative to the
   *  end month — feeds the period-aware top-driver-sites drill in the explorer. */
  flow_site_metrics: Record<string, Record<string, Record<string, Record<string, number[]>>>>;
}

/* ------------------------------------------------------------- content v2 trends */

/**
 * One monthly series for a (row · area · market · metric). `cy` is the current
 * year truncated to the YTD period (e.g. 4 values, Jan–Apr); `py` is the full
 * prior year (12 values) so the ghost line shows the whole seasonal shape.
 * Built from db.json by scripts/build_content_trends.py.
 */
export interface TrendSeries {
  cy: number[];
  py: number[];
}

export interface TrendMetrics {
  pieces: TrendSeries;
  shipments: TrendSeries;
}

export interface TrendNode {
  REP: TrendMetrics;
  LM: TrendMetrics;
}

/** key = "Category|Sub-category" → area → market → metric → series. */
export interface ContentTrends {
  current_year: number;
  prior_year: number;
  period_number: number;
  month_labels: string[];
  rows: Record<string, Partial<Record<GeoArea, TrendNode>>>;
}

/* ------------------------------------------------------- export labs sites */

/** Named LM flow on a drill site, shown only within its own area. */
export interface LmFlow {
  area: GeoArea;
  label: string; // e.g. "Glassed Direct", "Brille 24"
}

export interface ExportLabSite {
  site: string;
  geo_data: GeoDataMap;
  acct_data: AcctDataMap;
  lm_flow?: LmFlow;
}

/* ------------------------------------------------------------- coverage page */

export type Tier = "low" | "mid" | "high";

export interface CoverageRow {
  /** Present on product-grouped rows. */
  area?: GeoArea;
  /** Present on area-grouped rows. */
  product?: Product;
  tot_sites: number;
  estimated_volume: number;
  coverage_pct: number | null; // 0..1
  low: number | null; // share 0..1
  mid: number | null;
  high: number | null;
}

export interface TopSite {
  site: string;
  shipments: number;
  products: Product[];
  site_types: string[];
  top_product: Product | null;
  top_product_shipments: number | null;
  share_pct: number | null; // 0..1
}

export interface CoveragePage {
  intro: string;
  wip_status: string;
  product_options: ("ALL" | Product)[];
  area_options: ("ALL" | GeoArea)[];
  coverage_efficiency: { product: Product; rows: CoverageRow[] }[];
  coverage_by_area: { area: GeoArea; rows: CoverageRow[] }[];
  top_sites_by_area: Partial<Record<Exclude<GeoArea, "ALL">, TopSite[]>>;
  top_sites_period: string;
  columns: { key: string; label: string; format: "text" | "int" | "coverage" | "pct"; tier?: Tier }[];
}

/* ------------------------------------------------------------- database page */

export interface DbColumn {
  key: string;
  label: string;
  type: "text" | "int";
}

export interface DbFilter {
  key: string;
  label: string;
  col: number; // index into DbRow
  options: string[];
}

/**
 * One mapping reference row. PRIMARY source is the Excel "Mapping" sheet
 * (per-plant); when that sheet is absent the builder falls back to unique
 * (Product · Site Type) pairs (then site/geo/source/owner are null). It explains
 * where a DB record (plant / flow / product / site type / market) lands on the
 * Content rows (category · sub-category) and the rule/source behind it.
 */
export interface DbMapping {
  /** Clean plant/site name. Null in fallback mode. */
  site: string | null;
  /** Raw site name as it appears in the source system. */
  raw_site: string | null;
  /** Named LM flow (e.g. "Glassed Direct"), if any. */
  flow: string | null;
  market: string | null;
  product: string;
  site_type: string;
  geo: string | null;
  /** Content destination (derived via Product·Site Type, or sheet-provided). */
  content_category: string | null;
  content_sub_category: string | null;
  maps_to: string | null;
  in_perimeter: boolean;
  /** Where the data comes from + who owns it. */
  source: string | null;
  owner: string | null;
  /** Explanatory rule/note. */
  note: string | null;
}

export interface DatabasePage {
  columns: DbColumn[]; // 10 displayed columns (indices 0..9)
  filters: DbFilter[];
  /**
   * IMPORTANT: canonical geo for filtering is index **10**, NOT the displayed
   * geo at index 7 (which can be blank). Use `geo_col` to filter, never col 7.
   */
  geo_col: number; // = 10
  acct_col: number; // = 8
  row_count: number;
  mapping: DbMapping[];
  /** "sheet" = from the Excel Mapping sheet; "derived" = fallback. */
  mapping_source: "sheet" | "derived";
  page_size: number; // 50
}

/**
 * One DB record. 11-element positional tuple:
 *  0 month  1 site  2 market  3 product  4 site_type  5 pieces  6 shipments
 *  7 geo(displayed, may be "")  8 acct  9 customer_country  10 geo(canonical, for filtering)
 */
export type DbRow = [
  string, // 0 month
  string, // 1 site
  Market | string, // 2 market
  Product | string, // 3 product
  string, // 4 site_type
  number, // 5 pieces
  number, // 6 shipments
  string, // 7 geographical area (display)
  string, // 8 accounting area
  string, // 9 customer country
  GeoArea | string, // 10 geographical area (canonical / filter)
];

/* --------------------------------------------------------------------- story */

/** One stop of the guided pitch (Story mode). `href` is the deep link the app
 *  navigates to (path + query, without the story param — added at runtime);
 *  `target` optionally spotlights an element once that page has mounted. */
export interface StoryStop {
  id: string;
  /** "overview" renders the computed network-at-a-glance card instead of a spotlight. */
  kind?: "overview";
  href: string;
  target?: string;
  title: string;
  body: string;
}

export interface StoryData {
  stops: StoryStop[];
}

/* --------------------------------------------------------------- root payload */

export interface Content {
  source_file: string;
  geo_options: GeoArea[];
  accounting_options: AcctArea[];
  current_view: CurrentView;
  export_labs_sites: ExportLabSite[];
  coverage_page: CoveragePage;
  database_page: DatabasePage;
}

/** Globals the prototype exposes; the React data layer will import the JSON directly instead. */
declare global {
  interface Window {
    CONTENT?: Content;
    DB?: DbRow[];
    WORLD_MAP_SVG?: string;
  }
}
