"use client";

import dynamic from "next/dynamic";
import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  AcctArea,
  ContentTrends,
  CurrentView,
  ExportLabSite,
  GeoArea,
  Market,
  MetricCell,
} from "@/data/types";
import { fmtCompact, fmtPctSigned, fmtRatio, sign, trend } from "@/lib/format";
import {
  cellTriple,
  hasShipments,
  seriesFor,
  type DataMetric,
} from "@/lib/contentMetrics";
import { contentRowLabel } from "@/lib/products";
import { toneForFlow } from "@/lib/tags";
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
  trends?: ContentTrends; // geo-only; omitted hides the trend columns (acct modal)
  /** Cumulative end month: caps the sparkline's current-year line to the window. */
  months?: number;
  dim: Dim;
  area: GeoArea | AcctArea;
  market: Market;
  /** Open the metric explorer for a main row from its Pieces or Shipments YoY chip. */
  onExplore?: (rowKey: string, metric: DataMetric) => void;
  noFallback?: boolean;
  /** Amber frame — signals the table is showing the accounting perimeter. */
  accent?: boolean;
  caption: string;
}

const VOLUME_METRICS: readonly DataMetric[] = ["pieces", "shipments"];

/** Sparklines fill their column between these widths: readable on a laptop,
 *  never stretched thin on a wide screen. */
const SPARK_MIN = 112;
const SPARK_MAX = 220;

const getMap = (o: { geo_data: MetricMap; acct_data: MetricMap }, dim: Dim) =>
  dim === "geo" ? o.geo_data : o.acct_data;

const metricLabel = (m: DataMetric) => (m === "pieces" ? "Pieces" : "Shipments");

function YoyChip({ yoy }: { yoy: number | null }) {
  return (
    <span className={`${styles.chip} ${styles[sign(yoy)]}`}>
      {trend(yoy) && <span className={styles.trendGlyph}>{trend(yoy)} </span>}
      {fmtPctSigned(yoy)}
    </span>
  );
}

export function ContentTableV2({
  view,
  drills,
  trends,
  months,
  dim,
  area,
  market,
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

  const showTrend = !!trends;

  // Columns are fixed, so one trend header gives every sparkline its width.
  // Measured before paint, then kept in step with window resizes.
  const trendHeadRef = useRef<HTMLTableCellElement>(null);
  const [sparkW, setSparkW] = useState(SPARK_MIN);
  useLayoutEffect(() => {
    const el = trendHeadRef.current;
    if (!el) return;
    const fit = () => {
      const cs = getComputedStyle(el);
      const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      setSparkW(Math.min(SPARK_MAX, Math.max(SPARK_MIN, Math.floor(inner))));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [showTrend]);

  const resolve = (map: MetricMap): GeoArea =>
    (noFallback
      ? area
      : Object.prototype.hasOwnProperty.call(map, area)
        ? area
        : "ALL") as GeoArea;

  // First Frames row (Accounting) hosts the International-rules affordance.
  const framesFirstIdx = useMemo(
    () => (dim === "acct" ? view.rows.findIndex((r) => r.category === "Frames") : -1),
    [dim, view.rows],
  );

  const catCls = (cat: string) => (cat === "Stock Lenses" ? styles.catType2 : styles.catType1);
  const emptyMsg = (m: DataMetric) => `No ${market} ${m === "pieces" ? "volume" : "shipments"}`;
  const isEmpty = (cell: MetricCell | null, m: DataMetric) => {
    const t = cellTriple(cell, m, market);
    return t.cur === 0 && t.py === 0;
  };
  const volCols = showTrend ? 2 : 1;
  const colCount = 2 + VOLUME_METRICS.length * volCols + 1;

  /** Year-to-date figure with its YoY chip underneath. The prior year stays
   *  reachable: hover title, screen-reader text, sparkline and explorer. */
  const valueStack = (
    cur: number,
    py: number,
    fmt: (n: number) => string,
    unit: string,
    chip: ReactNode,
  ) => (
    <span className={styles.valStack}>
      <span className={styles.valNum} title={`Prior YTD ${fmt(py)}`} aria-hidden="true">
        {fmt(cur)}
      </span>
      <span className="sr-only">
        {view.year} YTD {fmt(cur)} {unit}, prior YTD {fmt(py)}.
      </span>
      {chip}
    </span>
  );

  const volumeCell = (
    cell: MetricCell | null,
    m: DataMetric,
    explore?: { rowKey: string; label: string; tour: boolean },
  ) => {
    if (isEmpty(cell, m))
      return <span className={`${styles.muted} ${styles.valEmpty}`}>{emptyMsg(m)}</span>;
    const t = cellTriple(cell, m, market);
    const chip =
      explore && onExplore ? (
        <button
          type="button"
          className={styles.chipBtn}
          title="Why? See the change explained"
          aria-haspopup="dialog"
          aria-label={`Explain the ${fmtPctSigned(t.yoy)} year over year change in ${m} for ${explore.label}`}
          data-tour={explore.tour ? "v2-yoy" : undefined}
          onClick={(e) => {
            e.stopPropagation();
            onExplore(explore.rowKey, m);
          }}
        >
          <YoyChip yoy={t.yoy} />
          <span className={styles.chipGo} aria-hidden="true">
            ↗
          </span>
        </button>
      ) : (
        <YoyChip yoy={t.yoy} />
      );
    return valueStack(t.cur, t.py, fmtCompact, m, chip);
  };

  const effCell = (cell: MetricCell | null, tour: boolean) => {
    const e = cellTriple(cell, "efficiency", market);
    return (
      <td
        className={`${styles.valCol} ${styles.grpStart}`}
        data-tour={tour ? "v2-eff" : undefined}
      >
        {hasShipments(cell, market) ? (
          valueStack(e.cur, e.py, fmtRatio, "pieces per shipment", <YoyChip yoy={e.yoy} />)
        ) : (
          <span className={`${styles.muted} ${styles.valEmpty}`}>—</span>
        )}
      </td>
    );
  };

  return (
    <>
    <div className={`${styles.wrap} ${accent ? styles.wrapAcct : ""}`}>
      <table className={`${styles.table} ${showTrend ? styles.withTrend : ""}`}>
        <caption className="sr-only">{caption}</caption>
        {/* Fixed widths: the layout never depends on the figures, so switching
            market or area cannot move the columns. Row labels fit the longest
            name; the trend columns (or, without trends, the figures) share
            the rest. */}
        <colgroup>
          <col className={styles.colCat} />
          <col className={styles.colSub} />
          {VOLUME_METRICS.map((m) => (
            <Fragment key={m}>
              <col className={showTrend ? styles.colVal : undefined} />
              {showTrend && <col />}
            </Fragment>
          ))}
          <col className={showTrend ? styles.colVal : undefined} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" rowSpan={2}>
              Category
            </th>
            <th scope="col" rowSpan={2}>
              Sub-category
            </th>
            {VOLUME_METRICS.map((m) => (
              <th
                key={m}
                scope="colgroup"
                colSpan={volCols}
                className={`${styles.grpHead} ${styles.grpStart}`}
              >
                {market} · {metricLabel(m)}
              </th>
            ))}
            <th scope="col" className={`${styles.grpHead} ${styles.grpStart}`}>
              {market} ·{" "}
              <abbr className={styles.grpAbbr} title="Pieces per shipment — batch size">
                Pcs / ship
              </abbr>
            </th>
          </tr>
          <tr>
            {VOLUME_METRICS.map((m) => (
              <Fragment key={m}>
                <th scope="col" className={`${styles.valCol} ${styles.grpStart}`}>
                  YTD · YoY
                </th>
                {showTrend && (
                  <th
                    scope="col"
                    className={styles.trendCol}
                    ref={m === VOLUME_METRICS[0] ? trendHeadRef : undefined}
                  >
                    Monthly trend
                  </th>
                )}
              </Fragment>
            ))}
            <th scope="col" className={`${styles.valCol} ${styles.grpStart}`}>
              Ratio · YoY
            </th>
          </tr>
        </thead>

        <tbody>
          {view.rows.map((row, ri) => {
            const map = getMap(row, dim);
            const used = resolve(map);
            const cell = map[used] ?? null;
            const isExportLabs = row.sub_category === "Export Labs";
            const rowKey = `${row.category}|${row.sub_category}`;
            const label = dim === "geo" ? contentRowLabel(row, used) : row;
            const isOpen = open.has(rowKey);
            const drillId = `${dim}-drill-${ri}`;

            const visibleDrills = isExportLabs
              ? drills.filter((s) => {
                  const m = getMap(s, dim);
                  const sc = m[resolve(m)] ?? null;
                  return VOLUME_METRICS.some((metric) => !isEmpty(sc, metric));
                })
              : [];

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
                        <span>{label.category}</span>
                        <span className={styles.intlHint} aria-hidden="true">
                          ?
                        </span>
                      </button>
                    ) : (
                      label.category
                    )}
                  </td>
                  <td className={styles.sub}>
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
                        <b>{label.sub_category}</b>
                      </button>
                    ) : (
                      label.sub_category || ""
                    )}
                  </td>
                  {VOLUME_METRICS.map((m) => {
                    const tour = ri === 0 && m === "pieces";
                    return (
                      <Fragment key={m}>
                        <td
                          className={`${styles.valCol} ${styles.grpStart}`}
                          data-tour={tour ? "v2-bar" : undefined}
                        >
                          {volumeCell(cell, m, {
                            rowKey,
                            label: `${label.category} ${label.sub_category}`,
                            tour,
                          })}
                        </td>
                        {showTrend && (
                          <td
                            className={styles.trendCol}
                            data-tour={tour ? "v2-trend" : undefined}
                          >
                            {(() => {
                              const node = trends!.rows[rowKey]?.[used] ?? null;
                              const s = seriesFor(node, m, market);
                              const cy = months != null ? s.cy.slice(0, months) : s.cy;
                              return cy.length || s.py.length ? (
                                <Sparkline
                                  cy={cy}
                                  py={s.py}
                                  width={sparkW}
                                  monthLabels={trends!.month_labels}
                                  currentYear={trends!.current_year}
                                  priorYear={trends!.prior_year}
                                  label={`${label.category} ${market} ${metricLabel(m)} monthly trend, ${trends!.current_year} vs ${trends!.prior_year}`}
                                />
                              ) : (
                                <span className={`${styles.muted} ${styles.valEmpty}`}>—</span>
                              );
                            })()}
                          </td>
                        )}
                      </Fragment>
                    );
                  })}
                  {effCell(cell, ri === 0)}
                </tr>

                {isExportLabs && isOpen && visibleDrills.length > 0 &&
                  visibleDrills.map((s, di) => {
                    const m = getMap(s, dim);
                    const usedS = resolve(m);
                    const sc = m[usedS] ?? null;
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
                        {VOLUME_METRICS.map((metric) => (
                          <Fragment key={metric}>
                            <td className={`${styles.valCol} ${styles.grpStart}`}>
                              {volumeCell(sc, metric)}
                            </td>
                            {showTrend && <td className={styles.trendCol} />}
                          </Fragment>
                        ))}
                        {effCell(sc, false)}
                      </tr>
                    );
                  })}

                {isExportLabs && isOpen && visibleDrills.length === 0 && (
                  <tr id={drillId} className={`${styles.drillRow} ${catCls(row.category)}`}>
                    <td colSpan={colCount}>
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
