import type { GeoArea, Market, MetricCell, SiteAnalysisData } from "@/data/types";
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
