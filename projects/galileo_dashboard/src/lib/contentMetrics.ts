import type { MarketMetrics, MetricCell, Market, TrendNode } from "@/data/types";

/**
 * Shared metric logic for Content V2. `DataMetric` is what the underlying data
 * actually stores (pieces / shipments); `Metric` is the view mode the toggle
 * offers, which adds "efficiency" = pieces ÷ shipments (batch size, the unit
 * that exposes where logistics consolidated or fragmented year over year).
 *
 * REP and LM are kept strictly separate everywhere — a ratio is only ever
 * pieces and shipments of the SAME market.
 */
export type DataMetric = "pieces" | "shipments";
export type Metric = DataMetric | "efficiency";

export interface Triple {
  cur: number;
  py: number;
  yoy: number | null;
}

const mk = (market: Market): "rep" | "lm" => (market === "REP" ? "rep" : "lm");
const pair = (b: MarketMetrics, k: "rep" | "lm") => ({
  cur: b[k],
  py: b[`${k}_py` as const],
});
const ratio = (cur: number, py: number) => (py > 0 ? (cur - py) / py : null);

/** True when the market has any shipment activity (so a ratio is meaningful). */
export function hasShipments(cell: MetricCell | null, market: Market): boolean {
  if (!cell) return false;
  const s = pair(cell.shipments, mk(market));
  return s.cur > 0 || s.py > 0;
}

/** cur / py / yoy for a cell under a market and view metric. Efficiency =
 *  pieces ÷ shipments; an undefined ratio (no shipments) yields 0 / null. */
export function cellTriple(cell: MetricCell | null, metric: Metric, market: Market): Triple {
  if (!cell) return { cur: 0, py: 0, yoy: null };
  const k = mk(market);
  if (metric === "efficiency") {
    const p = pair(cell.pieces, k);
    const s = pair(cell.shipments, k);
    const cur = s.cur > 0 ? p.cur / s.cur : 0;
    const py = s.py > 0 ? p.py / s.py : 0;
    const yoy = cur > 0 && py > 0 ? (cur - py) / py : null;
    return { cur, py, yoy };
  }
  const b = pair(cell[metric], k);
  return { cur: b.cur, py: b.py, yoy: ratio(b.cur, b.py) };
}

/** Monthly cy/py arrays for the sparkline. Efficiency = per-month pieces ÷
 *  shipments (a 0-shipment month yields 0, treated as no-data by Sparkline). */
export function seriesFor(
  node: TrendNode | null | undefined,
  metric: Metric,
  market: Market,
): { cy: number[]; py: number[] } {
  if (!node) return { cy: [], py: [] };
  const m = node[market];
  if (metric === "efficiency") {
    const div = (p: number[], s: number[]) => p.map((pv, i) => (s[i] > 0 ? pv / s[i] : 0));
    return { cy: div(m.pieces.cy, m.shipments.cy), py: div(m.pieces.py, m.shipments.py) };
  }
  return { cy: m[metric].cy, py: m[metric].py };
}

/** Underlying pieces & shipments YoY for a market — used to explain a ratio
 *  move ("each shipment carries more because pieces grew faster than ships"). */
export function components(cell: MetricCell | null, market: Market) {
  const k = mk(market);
  const p = cell ? pair(cell.pieces, k) : { cur: 0, py: 0 };
  const s = cell ? pair(cell.shipments, k) : { cur: 0, py: 0 };
  return {
    pieces: { ...p, yoy: ratio(p.cur, p.py) },
    shipments: { ...s, yoy: ratio(s.cur, s.py) },
  };
}
