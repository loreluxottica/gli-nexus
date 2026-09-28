import type { ContentRow, CurrentView, DbRow, GeoArea, Market, MetricCell, SiteAnalysisData } from "@/data/types";
import { isGeoArea } from "../data/geo";
import { yoy } from "./format";

export type SiteMetricKey = "pieces" | "shipments" | "efficiency";
export type SiteSort = "pieces" | "shipments" | "pieces-change" | "shipments-change" | "name";

export interface SiteMetric {
  cur: number | null;
  py: number | null;
  yoy: number | null;
  delta: number | null;
}

export interface FlowSite {
  site: string;
  pieces: SiteMetric;
  shipments: SiteMetric;
  efficiency: SiteMetric;
}

export interface FlowScope {
  flow: string;
  area: GeoArea;
  market: Market;
  period: number;
}

export function resolveFlowScope(
  params: Pick<URLSearchParams, "get">,
  view: CurrentView,
): { scope: FlowScope; row: ContentRow; cell: MetricCell | null } | { error: string } {
  const area = params.get("area") ?? "ALL";
  const market = params.get("market") ?? "REP";
  const rawPeriod = params.get("period");
  const period = rawPeriod == null ? Number(view.period_number) : Number(rawPeriod);
  const flow = params.get("flow") ?? "";
  if (params.get("acct") === "1") return { error: "Site exploration is available for geographical areas, not the International accounting perimeter." };
  if (!isGeoArea(area)) return { error: "The link contains an unknown geographical area." };
  if (market !== "REP" && market !== "LM") return { error: "The link contains an unknown market. Choose REP or LM from Content." };
  if (params.get("year") != null && Number(params.get("year")) !== Number(view.year)) {
    return { error: "The reporting year in this link is no longer available." };
  }
  if (!Number.isInteger(period) || period < 1 ||
      (period !== Number(view.period_number) && !view.period_options.some((option) => option.n === period))) {
    return { error: "The link contains an unavailable reporting period." };
  }
  const index = view.rows.findIndex((row) => `${row.category}|${row.sub_category}` === flow);
  if (index < 0) return { error: "Choose a valid flow from the Content table." };
  const row = view.rows[index];
  const snapshot = view.periods[String(period)];
  if (period !== Number(view.period_number) && !snapshot?.rows[index]) {
    return { error: "The flow totals are unavailable for this reporting period." };
  }
  const geo = period === Number(view.period_number) ? row.geo_data : snapshot.rows[index].geo_data;
  return { scope: { flow, area, market, period }, row, cell: geo[area] ?? null };
}

export interface FlowRecordsScope {
  scope: FlowScope;
  row: ContentRow;
  sites: string[];
  year: number;
}

export function flowRecordsScope(
  params: Pick<URLSearchParams, "get" | "getAll" | "has">,
  view: CurrentView,
): FlowRecordsScope | { error: string } | null {
  if (!params.has("records")) return null;
  if (params.get("records") !== "sites" ||
      ["flow", "period", "year"].some((key) => !params.get(key))) {
    return { error: "This records link is incomplete. Open records again from the site workspace." };
  }
  const resolved = resolveFlowScope(params, view);
  if ("error" in resolved) return resolved;
  const sites = [...new Set(params.getAll("selected"))];
  if (!sites.length || sites.some((site) => !site.trim())) {
    return { error: "This records link has no selected sites. Select sites in the workspace first." };
  }
  const year = Number(view.year);
  if (!Number.isInteger(year)) return { error: "The reporting year is unavailable." };
  return { scope: resolved.scope, row: resolved.row, sites, year };
}

export function flowRecordsHref(query: string, scope: FlowScope, year: number): string {
  const params = new URLSearchParams(query);
  for (const key of [...params.keys()]) if (key.startsWith("db-")) params.delete(key);
  for (const [key, value] of Object.entries(scope)) params.set(key, String(value));
  params.set("records", "sites");
  params.set("year", String(year));
  return `/database?${params}`;
}

export function flowSitesReturnHref(query: string): string {
  const params = new URLSearchParams(query);
  params.delete("records");
  for (const key of [...params.keys()]) if (key.startsWith("db-")) params.delete(key);
  return `/content/sites?${params}`;
}

export const SITE_SORTS: { value: SiteSort; label: string }[] = [
  { value: "pieces", label: "Pieces: highest first" },
  { value: "shipments", label: "Shipments: highest first" },
  { value: "pieces-change", label: "Largest change in pieces" },
  { value: "shipments-change", label: "Largest change in shipments" },
  { value: "name", label: "Site name" },
];

export function isSiteSort(value: string): value is SiteSort {
  return SITE_SORTS.some((option) => option.value === value);
}

function metric(cur: number | null, py: number | null): SiteMetric {
  return {
    cur, py,
    yoy: cur == null || py == null ? null : yoy(cur, py),
    delta: cur == null || py == null ? null : cur - py,
  };
}

function metrics(p: number, pp: number, s: number, sp: number) {
  return {
    pieces: metric(p, pp),
    shipments: metric(s, sp),
    efficiency: metric(s > 0 ? p / s : null, sp > 0 ? pp / sp : null),
  };
}

/** Null means no scoped cell, not a measured zero or the Global fallback. */
export function flowTotals(cell: MetricCell | null, market: Market) {
  if (!cell) return null;
  const key = market === "REP" ? "rep" : "lm";
  return metrics(
    cell.pieces[key], cell.pieces[`${key}_py`],
    cell.shipments[key], cell.shipments[`${key}_py`],
  );
}

export function flowSites(
  data: SiteAnalysisData,
  scope: FlowScope,
): { rows: FlowSite[]; error: string | null } {
  const periods = data.flow_site_metrics;
  if (!periods || !Object.prototype.hasOwnProperty.call(periods, String(scope.period))) {
    return { rows: [], error: "Site detail is unavailable for this reporting period." };
  }
  const records = periods[String(scope.period)][scope.flow]?.[scope.area] ?? {};
  const base = scope.market === "REP" ? 0 : 4;
  const rows: FlowSite[] = [];
  for (const [site, values] of Object.entries(records)) {
    if (!Array.isArray(values) || values.length !== 8 ||
        !values.every((value) => typeof value === "number" && Number.isFinite(value))) {
      return { rows: [], error: `Site detail contains invalid figures for "${site}".` };
    }
    const [p, pp, s, sp] = values.slice(base, base + 4);
    if (p === 0 && pp === 0 && s === 0 && sp === 0) continue;
    rows.push({ site, ...metrics(p, pp, s, sp) });
  }
  return { rows, error: null };
}

/** Search never changes the source rows, selection or the flow denominator. */
export function visibleFlowSites(rows: FlowSite[], search: string, sort: SiteSort): FlowSite[] {
  const needle = search.trim().toLocaleLowerCase();
  return rows.filter((row) => row.site.toLocaleLowerCase().includes(needle)).sort((a, b) => {
    if (sort === "name") return a.site.localeCompare(b.site);
    const key = sort.startsWith("shipments") ? "shipments" : "pieces";
    const score = (row: FlowSite) => sort.endsWith("-change")
      ? Math.abs(row[key].delta ?? 0) : row[key].cur ?? 0;
    return score(b) - score(a) || a.site.localeCompare(b.site);
  });
}

export function flowSitesHref(scope: FlowScope & { site?: string; sort?: SiteSort }): string {
  const params = new URLSearchParams({
    flow: scope.flow, area: scope.area, market: scope.market, period: String(scope.period),
  });
  if (scope.site) params.set("site", scope.site);
  if (scope.sort) params.set("sort", scope.sort);
  return `/content/sites?${params}`;
}

export function contentScopeHref(scope: Pick<FlowScope, "area" | "market" | "period">): string {
  return `/content?${new URLSearchParams({
    area: scope.area, market: scope.market, period: String(scope.period),
  })}`;
}

/** Content flow a database record feeds. Same rules as the site-analysis build. */
export function contentFlowKey(product: string, siteType: string): string | null {
  const item = product.trim();
  const kind = siteType.trim();
  if (item === "Finished Frames") return "Frames|Finished Frames";
  if (item === "GV Frames") return "Frames|GV Frames*";
  if (item === "Stock Lenses" && kind === "Mass Production | DCs") return "Stock Lenses|Mass Production | DCs";
  if (item === "RX") {
    if (kind === "Export Labs") return "RX Lenses|Export Labs";
    if (kind === "Nearshore Labs") return "RX Lenses|Nearshore Labs";
    if (kind === "Local Labs to ECP") return "RX Lenses|Local Labs to ECP";
  }
  return null;
}

function ytdMonths(year: number, period: number): Set<string> {
  const months = new Set<string>();
  for (const reportingYear of [year, year - 1]) {
    for (let month = 1; month <= period; month++) months.add(`${reportingYear}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

/** Source rows behind the selected sites. Search and paging are not filters. */
export function scopedSourceRecords(
  rows: readonly DbRow[],
  scope: FlowScope,
  sites: readonly string[],
  year: number,
): DbRow[] {
  const selected = new Set(sites);
  if (!selected.size || !Number.isInteger(year) || !Number.isInteger(scope.period) || scope.period < 1) return [];
  const months = ytdMonths(year, scope.period);
  return rows.filter((row) => {
    if (!months.has(row[0]) || row[2] !== scope.market || !selected.has(row[1] || "(unknown)")) return false;
    const geo = String(row[10] ?? "").trim();
    if (!geo || (scope.area !== "ALL" && geo !== scope.area)) return false;
    if (contentFlowKey(String(row[3] ?? ""), String(row[4] ?? "")) !== scope.flow) return false;
    return Number(row[5] || 0) > 0 || Number(row[6] || 0) > 0;
  });
}

/** Database CSV: displayed columns only, source order, UTF-8 BOM for Excel. */
export function databaseCsv(columns: readonly { label: string }[], rows: readonly DbRow[]): string {
  const esc = (value: unknown) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = columns.map((column) => esc(column.label)).join(",");
  const body = rows.map((row) => columns.map((_, index) => esc(row[index])).join(",")).join("\n");
  return `\uFEFF${header}${body ? `\n${body}` : ""}`;
}
