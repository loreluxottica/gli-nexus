"use client";

import dynamic from "next/dynamic";
import { Fragment, useMemo, useState } from "react";
import type {
  AcctArea,
  ContentTrends,
  CurrentView,
  ExportLabSite,
  GeoArea,
  Market,
  MetricCell,
} from "@/data/types";
import { CoverageBar } from "@/components/ui/CoverageBar";
import { fmtCompact, fmtPctSigned, fmtRatio, sign, trend } from "@/lib/format";
import {
  cellTriple,
  components,
  hasShipments,
  seriesFor,
  type Metric,
} from "@/lib/contentMetrics";
import { toneForFlow } from "@/lib/tags";
import { PairedYoYBar } from "./PairedYoYBar";
import { Sparkline } from "./Sparkline";
import styles from "./ContentTableV2.module.css";

/** Only load when Accounting · Frames “?” is opened. */
const InternationalRules = dynamic(
  () => import("./InternationalRules").then((m) => m.InternationalRules),
  { ssr: false },
);

type Dim = "geo" | "acct";
type MetricMap = Partial<Record<string, MetricCell>>;

interface Props {
  view: CurrentView;
  drills: ExportLabSite[];
  trends?: ContentTrends; // geo-only; omitted hides the trend column (acct modal)
  /** Cumulative end month: caps the sparkline's current-year line to the window. */
  months?: number;
  dim: Dim;
  area: GeoArea | AcctArea;
  market: Market;
  metric: Metric;
  /** Open the metric explorer for a main row — any metric: YoY chips (pieces /
   *  shipments) and the ratio bar (efficiency) all lead there. */
  onExplore?: (rowKey: string) => void;
  noFallback?: boolean;
  /** Amber frame — signals the table is showing the accounting perimeter. */
  accent?: boolean;
  caption: string;
}

const getMap = (o: { geo_data: MetricMap; acct_data: MetricMap }, dim: Dim) =>
  dim === "geo" ? o.geo_data : o.acct_data;

const metricLabel = (m: Metric) =>
  m === "pieces" ? "Pieces" : m === "shipments" ? "Shipments" : "Efficiency";

export function ContentTableV2({
  view,
  drills,
  trends,
  months,
  dim,
  area,
  market,
  metric,
  onExplore,
  noFallback = false,
  accent = false,
  caption,
}: Props) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [intlOpen, setIntlOpen] = useState(false);
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const isEff = metric === "efficiency";
  const showTrend = !!trends;
  const fmtBar = isEff ? fmtRatio : fmtCompact;

  const resolve = (map: MetricMap): GeoArea =>
    (noFallback
      ? area
      : Object.prototype.hasOwnProperty.call(map, area)
        ? area
        : "ALL") as GeoArea;

  // Shared bar scale across the visible MAIN rows for the active market+metric.
  const maxVal = useMemo(() => {
    let max = 0;
    for (const row of view.rows) {
      const map = getMap(row, dim);
      const cell = map[resolve(map)] ?? null;
      const { cur, py } = cellTriple(cell, metric, market);
      max = Math.max(max, cur, py);
    }
    return max;
  }, [view.rows, dim, area, market, metric, noFallback]);

  // First Frames row (Accounting) hosts the International-rules affordance.
  const framesFirstIdx = useMemo(
    () => (dim === "acct" ? view.rows.findIndex((r) => r.category === "Frames") : -1),
    [dim, view.rows],
  );

  const catCls = (cat: string) => (cat === "Stock Lenses" ? styles.catType2 : styles.catType1);
  const emptyMsg = isEff
    ? `No ${market} shipments`
    : `No ${market} ${metric === "pieces" ? "volume" : "shipments"}`;
  const colCount = 4 + (showTrend ? 1 : 0);

  const barHint = isEff ? "pcs / shipment" : "this yr vs last";

  // The combined "pieces · shipments" caption shown under the ratio bar so the
  // two figures behind the efficiency number are visible together.
  const combined = (cell: MetricCell | null) => {
    const c = components(cell, market);
    return `${fmtCompact(c.pieces.cur)} pcs · ${fmtCompact(c.shipments.cur)} ship`;
  };

  return (
    <>
    <div className={`${styles.wrap} ${accent ? styles.wrapAcct : ""}`}>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Sub-category</th>
            <th scope="col" className={styles.barCol}>
              {market} · {metricLabel(metric)}
              <span className={styles.thHint}> — {barHint}</span>
            </th>
            <th scope="col" className={styles.yoyCol}>
              YoY %
            </th>
            {showTrend && (
              <th scope="col" className={styles.trendCol}>
                Monthly trend
              </th>
            )}
            <th scope="col" className={styles.covCol}>
              Coverage %
            </th>
          </tr>
        </thead>

        <tbody>
          {view.rows.map((row, ri) => {
            const map = getMap(row, dim);
            const used = resolve(map);
            const cell = map[used] ?? null;
            const { cur, py, yoy } = cellTriple(cell, metric, market);
            const isExportLabs = row.sub_category === "Export Labs";
            const rowKey = `${row.category}|${row.sub_category}`;
            const isOpen = open.has(rowKey);
            const drillId = `${dim}-drill-${ri}`;
            const empty = isEff ? !hasShipments(cell, market) : cur === 0 && py === 0;

            const visibleDrills = isExportLabs
              ? drills.filter((s) => {
                  const m = getMap(s, dim);
                  const f = cellTriple(m[resolve(m)] ?? null, metric, market);
                  return isEff ? hasShipments(m[resolve(m)] ?? null, market) : f.cur > 0 || f.py > 0;
                })
              : [];

            const pairedBar = (
              <PairedYoYBar
                cur={cur}
                py={py}
                max={maxVal}
                fmt={fmtBar}
                curLabel={`${view.year} YTD`}
                pyLabel="prior YTD"
              />
            );
            // Efficiency keeps the pieces · shipments caption under the ratio,
            // but no longer opens the explorer (explore removed from this view).
            const bar = isEff ? (
              <div className={styles.effCell}>
                {pairedBar}
                <span className={styles.effRaw}>{combined(cell)}</span>
              </div>
            ) : (
              pairedBar
            );

            // First Frames row in Accounting mode: clickable “?” for the
            // International plant rules (hidden until asked).
            const showIntlRules = framesFirstIdx === ri;

            return (
              <Fragment key={rowKey}>
                <tr
                  data-tour={ri === 0 ? "v2-rows" : undefined}
                  className={[catCls(row.category), isExportLabs && styles.expandable]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={isExportLabs ? () => toggle(rowKey) : undefined}
                >
                  <td className={styles.cat}>
                    {showIntlRules ? (
                      <button
                        type="button"
                        className={styles.intlHit}
                        onClick={(e) => {
                          e.stopPropagation();
                          setIntlOpen(true);
                        }}
                        aria-haspopup="dialog"
                        aria-label="When is Frames counted as International?"
                        title="When is Frames counted as International?"
                      >
                        <span>{row.category}</span>
                        <span className={styles.intlHint} aria-hidden="true">
                          ?
                        </span>
                      </button>
                    ) : (
                      row.category
                    )}
                  </td>
                  <td>
                    {isExportLabs ? (
                      <button
                        type="button"
                        className={styles.chevBtn}
                        aria-expanded={isOpen}
                        aria-controls={drillId}
                        data-tour="v2-drill"
                      >
                        <span
                          className={`${styles.chev} ${isOpen ? styles.chevOpen : ""}`}
                          aria-hidden="true"
                        >
                          ▸
                        </span>
                        <b>{row.sub_category}</b>
                      </button>
                    ) : (
                      row.sub_category || ""
                    )}
                  </td>
                  <td className={styles.barCol} data-tour={ri === 0 ? "v2-bar" : undefined}>
                    {empty ? <span className={styles.muted}>{emptyMsg}</span> : bar}
                  </td>
                  <td
                    className={`${styles.yoyCol} ${styles.num}`}
                    data-tour={ri === 0 ? "v2-yoy" : undefined}
                  >
                    {(() => {
                      const chip = (
                        <span className={`${styles.chip} ${styles[sign(yoy)]}`}>
                          {trend(yoy) && <span className={styles.trendGlyph}>{trend(yoy)} </span>}
                          {fmtPctSigned(yoy)}
                        </span>
                      );
                      return onExplore && !isEff && !empty ? (
                        <button
                          type="button"
                          className={styles.chipBtn}
                          title="Why? See the change explained"
                          aria-haspopup="dialog"
                          aria-label={`Explain the ${fmtPctSigned(yoy)} year over year change for ${row.category} ${row.sub_category}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onExplore(rowKey);
                          }}
                        >
                          {chip}
                          <span className={styles.chipGo} aria-hidden="true">
                            ↗
                          </span>
                        </button>
                      ) : (
                        chip
                      );
                    })()}
                  </td>
                  {showTrend && (
                    <td className={styles.trendCol} data-tour={ri === 0 ? "v2-trend" : undefined}>
                      {(() => {
                        const node = trends!.rows[rowKey]?.[used] ?? null;
                        const s = seriesFor(node, metric, market);
                        const cy = months != null ? s.cy.slice(0, months) : s.cy;
                        return cy.length || s.py.length ? (
                          <Sparkline
                            cy={cy}
                            py={s.py}
                            monthLabels={trends!.month_labels}
                            valueFmt={fmtBar}
                            currentYear={trends!.current_year}
                            priorYear={trends!.prior_year}
                            label={`${row.category} ${market} ${metricLabel(metric)} monthly trend, ${trends!.current_year} vs ${trends!.prior_year}`}
                          />
                        ) : (
                          <span className={styles.muted}>—</span>
                        );
                      })()}
                    </td>
                  )}
                  <td className={styles.covCol}>
                    <CoverageBar value={row.coverage} compact />
                  </td>
                </tr>

                {isExportLabs && isOpen && visibleDrills.length > 0 &&
                  visibleDrills.map((s, di) => {
                    const m = getMap(s, dim);
                    const usedS = resolve(m);
                    const sc = m[usedS] ?? null;
                    const f = cellTriple(sc, metric, market);
                    const flow =
                      dim === "geo" && market === "LM" && s.lm_flow && s.lm_flow.area === usedS
                        ? s.lm_flow
                        : null;
                    const flowCls = flow
                      ? toneForFlow(flow.label) === "azure"
                        ? styles.flowGlassed
                        : styles.flowBrille
                      : "";
                    return (
                      <tr
                        key={`${rowKey}-${s.site}`}
                        id={di === 0 ? drillId : undefined}
                        className={`${styles.drillRow} ${catCls(row.category)} ${flowCls}`}
                      >
                        <td />
                        <td className={`${styles.drillSite} ${flow ? styles.flowSite : ""}`}>
                          {s.site}
                          {flow && <span className={`${styles.flowPill} ${flowCls}`}>{flow.label}</span>}
                        </td>
                        <td className={styles.barCol}>
                          {(isEff ? !hasShipments(sc, market) : f.cur === 0 && f.py === 0) ? (
                            <span className={styles.muted}>{emptyMsg}</span>
                          ) : (
                            <PairedYoYBar
                              cur={f.cur}
                              py={f.py}
                              max={maxVal}
                              fmt={fmtBar}
                              curLabel={`${view.year} YTD`}
                              pyLabel="prior YTD"
                            />
                          )}
                        </td>
                        <td className={`${styles.yoyCol} ${styles.num}`}>
                          <span className={`${styles.chip} ${styles[sign(f.yoy)]}`}>
                            {trend(f.yoy) && <span className={styles.trendGlyph}>{trend(f.yoy)} </span>}
                            {fmtPctSigned(f.yoy)}
                          </span>
                        </td>
                        {showTrend && <td className={styles.trendCol} />}
                        <td className={styles.covCol} />
                      </tr>
                    );
                  })}

                {isExportLabs && isOpen && visibleDrills.length === 0 && (
                  <tr id={drillId} className={`${styles.drillRow} ${catCls(row.category)}`}>
                    <td colSpan={colCount + 1}>
                      <span className={styles.muted}>
                        No contributing sites with {market} activity in this scope.
                      </span>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
    {intlOpen ? (
      <InternationalRules open onClose={() => setIntlOpen(false)} />
    ) : null}
    </>
  );
}
