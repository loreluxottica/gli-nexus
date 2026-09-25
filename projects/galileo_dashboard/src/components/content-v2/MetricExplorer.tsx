"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { ContentTrends, CurrentView, GeoArea, Market, MetricCell } from "@/data/types";
import { areaLabel } from "@/data/geo";
import { getSiteAnalysis } from "@/data/siteAnalysis";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CommentPanel } from "./CommentPanel";
import { SiteAnalysis } from "./SiteAnalysis";
import { fmtCompact, fmtDeltaCompact, fmtPctSigned, fmtRatio, sign, trend } from "@/lib/format";
import { cellTriple, components, hasShipments, seriesFor, type Metric } from "@/lib/contentMetrics";
import { contentRowLabel } from "@/lib/products";
import styles from "./MetricExplorer.module.css";

const GEO_AREAS: GeoArea[] = ["EMEA", "NA", "APAC", "LATAM"];

const resolveArea = (map: Record<string, unknown>, area: GeoArea): GeoArea =>
  (Object.prototype.hasOwnProperty.call(map, area) ? area : "ALL") as GeoArea;

/** Smallest 1/2/4/5 × 10ⁿ at or above v, so the half-way gridline stays round. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  return ([1, 2, 4, 5, 10].find((s) => s * mag >= v) ?? 10) * mag;
}

/** Rendered width of an element, so the chart draws in real pixels instead of
 *  stretching a fixed viewBox (which also scaled its text). */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Over-time line chart: current year (solid) over prior year (dashed ghost)
 *  on a shared y-scale with 0 / half / max gridlines, every month labelled and
 *  the latest current-year value written at its point. */
function TrendChart({
  cy,
  py,
  monthLabels,
  currentYear,
  priorYear,
  fmt,
  metricName,
}: {
  cy: number[];
  py: number[];
  monthLabels: string[];
  currentYear: number;
  priorYear: number;
  fmt: (n: number | null | undefined) => string;
  metricName: string;
}) {
  const [wrapRef, W] = useWidth<HTMLDivElement>(720);
  const H = 220;
  const padL = 50;
  const padR = 56;
  const padT = 12;
  const padB = 26;
  const plotW = Math.max(1, W - padL - padR);
  const plotH = H - padT - padB;
  const top = niceMax(Math.max(0, ...cy, ...py));
  const x = (i: number) => padL + (i * plotW) / 11;
  const y = (v: number) => padT + plotH - (v / top) * plotH;
  const line = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const lastI = cy.length - 1;
  const everyMonth = plotW / 11 >= 34;

  return (
    <div ref={wrapRef} className={styles.chartWrap}>
      <svg
        className={styles.chart}
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Monthly ${metricName}, ${currentYear} versus ${priorYear}`}
      >
        {[0, top / 2, top].map((t) => (
          <g key={t}>
            <line className={styles.grid} x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} />
            <text className={styles.axis} x={padL - 8} y={y(t) + 3} textAnchor="end">
              {t === 0 ? "0" : fmt(t)}
            </text>
          </g>
        ))}
        {monthLabels.map((m, i) =>
          everyMonth || i % 2 === 0 ? (
            <text key={m} className={styles.axis} x={x(i)} y={H - 8} textAnchor="middle">
              {m}
            </text>
          ) : null,
        )}
        <path className={styles.py} d={line(py)} />
        {cy.length > 1 && <path className={styles.cy} d={line(cy)} />}
        {lastI >= 0 && cy[lastI] > 0 && (
          <>
            <circle className={styles.dot} cx={x(lastI)} cy={y(cy[lastI])} r={3.5} />
            <text className={styles.endLabel} x={x(lastI) + 8} y={y(cy[lastI]) + 4}>
              {fmt(cy[lastI])}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

/** Solid market badge — keeps REP vs LM unmistakable wherever it appears. */
function MktChip({ market, lg }: { market: Market; lg?: boolean }) {
  return (
    <span
      className={[styles.mkt, lg && styles.mktLg, market === "REP" ? styles.mktRep : styles.mktLm]
        .filter(Boolean)
        .join(" ")}
    >
      {market}
    </span>
  );
}

/** One row of "Where the change comes from": area | bar | change | YTD | YoY.
 *  The bar is the change vs last year on a scale shared by every area and it
 *  always sits next to its own printed value. `zero` (0..100) places the zero
 *  line so the track is used in full when every area moved the same way. The
 *  Global total row has no bar. With `onClick` the row is a button that
 *  reveals its top driver sites. */
function ChangeRow({
  label,
  delta,
  deltaText,
  value,
  yoy,
  defined,
  naText,
  zero,
  span,
  total,
  focus,
  onClick,
  expanded,
}: {
  label: string;
  delta: number;
  deltaText: string;
  value: string;
  yoy: number | null;
  defined: boolean;
  naText: string;
  zero: number;
  span: number;
  total?: boolean;
  focus?: boolean;
  onClick?: () => void;
  expanded?: boolean;
}) {
  const width = span > 0 ? (Math.abs(delta) / span) * 100 : 0;
  const deltaCls = delta > 0 ? styles.pos : delta < 0 ? styles.neg : "";
  const inner = (
    <>
      <span className={styles.chgLabel} title={label}>
        {onClick && (
          <span className={`${styles.chev} ${expanded ? styles.chevOpen : ""}`} aria-hidden="true">
            ▸
          </span>
        )}
        {label}
      </span>
      {defined ? (
        <>
          <span className={styles.chgTrack} aria-hidden="true">
            {!total && (
              <>
                <span className={styles.chgZero} style={{ left: `${zero}%` }} />
                {delta !== 0 && (
                  <span
                    className={`${styles.chgBar} ${delta > 0 ? styles.barPos : styles.barNeg}`}
                    style={
                      delta > 0
                        ? { left: `${zero}%`, width: `${width}%` }
                        : { right: `${100 - zero}%`, width: `${width}%` }
                    }
                  />
                )}
              </>
            )}
          </span>
          <span className={`${styles.chgDelta} ${deltaCls}`}>{deltaText}</span>
          <span className={styles.chgVal}>{value}</span>
          <span className={`${styles.effChip} ${styles[sign(yoy)]}`}>
            {trend(yoy)} {fmtPctSigned(yoy)}
          </span>
        </>
      ) : (
        <span className={styles.chgNa}>{naText}</span>
      )}
    </>
  );
  const cls = [styles.chgRow, total && styles.chgTotal, focus && styles.focus]
    .filter(Boolean)
    .join(" ");
  if (onClick) {
    return (
      <button
        type="button"
        className={`${cls} ${styles.chgRowBtn}`}
        onClick={onClick}
        aria-expanded={expanded}
        title="Show the top driver sites"
      >
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/** Metric-aware "why" explorer. Opened from any YoY chip (pieces / shipments)
 *  or from a ratio bar (efficiency): headline + one-line narrative, monthly
 *  trend vs prior year, and the flow across areas. Areas only — plant-level
 *  detail stays behind comment mentions (high-level tool). */
export function MetricExplorer({
  open,
  onClose,
  rowKey,
  view,
  trends,
  market,
  metric,
  area,
  period,
}: {
  open: boolean;
  onClose: () => void;
  rowKey: string | null;
  view: CurrentView;
  trends: ContentTrends;
  market: Market;
  metric: Metric;
  area: GeoArea;
  /** Selected end month — caps the trend line and scopes the driver-site data. */
  period: number;
}) {
  // Site drill: when set, the modal swaps to a single-site analysis (no nested
  // modal). openArea = which cross-area row is expanded to its driver sites.
  // Both reset whenever the KPI changes or the modal is closed/reopened.
  const [siteView, setSiteView] = useState<string | null>(null);
  const [openArea, setOpenArea] = useState<GeoArea | null>(null);
  useEffect(() => {
    setSiteView(null);
    setOpenArea(null);
  }, [rowKey, open]);

  const focusRow = rowKey ? view.rows.find((r) => `${r.category}|${r.sub_category}` === rowKey) : null;
  if (!open || !focusRow || !rowKey) return null;

  const isEff = metric === "efficiency";
  const noun = metric === "pieces" ? "pieces" : metric === "shipments" ? "shipments" : "pieces per shipment";
  const fmtVal = isEff ? fmtRatio : fmtCompact;
  const naText = metric === "pieces" ? "no volume" : "no shipments";

  const usedArea = resolveArea(focusRow.geo_data, area);
  const rowLabel = contentRowLabel(focusRow, usedArea);
  const cell: MetricCell | null = focusRow.geo_data[usedArea] ?? null;
  const triple = cellTriple(cell, metric, market);
  const node = trends.rows[rowKey]?.[usedArea] ?? null;
  const rawSeries = seriesFor(node, metric, market);
  // Cap the current-year line to the selected window (prior year stays full).
  const series = { cy: rawSeries.cy.slice(0, period), py: rawSeries.py };

  // Cross-area: where the change comes from. Every area is weighed by its
  // absolute change vs last year, so a large % swing on a tiny base cannot
  // masquerade as the driver.
  const isDefined = (c: MetricCell | null, t: { cur: number; py: number }) =>
    isEff ? hasShipments(c, market) : t.cur > 0 || t.py > 0;
  // A ratio only changes when both years have one (0 means no shipments);
  // volumes can change from or to zero.
  const changeOf = (t: { cur: number; py: number }) =>
    isEff && (t.cur === 0 || t.py === 0) ? null : t.cur - t.py;
  const fmtDelta = (d: number | null) =>
    d == null
      ? "—"
      : isEff
        ? d === 0
          ? "0"
          : `${d > 0 ? "+" : "−"}${fmtRatio(Math.abs(d))}`
        : fmtDeltaCompact(d);
  const areaList = GEO_AREAS.filter((a) =>
    Object.prototype.hasOwnProperty.call(focusRow.geo_data, a),
  ).map((a) => {
    const c = focusRow.geo_data[a] ?? null;
    const t = cellTriple(c, metric, market);
    const change = changeOf(t);
    return {
      key: a,
      label: areaLabel(a),
      ...t,
      delta: change ?? 0,
      deltaText: fmtDelta(change),
      defined: isDefined(c, t),
    };
  });
  const ranked = [...areaList].sort(
    (a, b) => Number(b.defined) - Number(a.defined) || Math.abs(b.delta) - Math.abs(a.delta),
  );
  const totalCell = focusRow.geo_data["ALL"] ?? null;
  const total = cellTriple(totalCell, metric, market);
  const totalChange = changeOf(total);
  // One scale for every bar: the track spans the largest drop plus the
  // largest gain, and the zero line sits between them.
  const negMax = Math.max(0, ...areaList.filter((a) => a.defined).map((a) => -a.delta));
  const posMax = Math.max(0, ...areaList.filter((a) => a.defined).map((a) => a.delta));
  const span = negMax + posMax;
  const zero = span > 0 ? (negMax / span) * 100 : 50;

  // Top driver plants behind an area's number (on demand — plant detail stays
  // behind a click). Volumes rank by absolute delta, the sites that actually
  // moved the figure; efficiency ranks the largest shippers and shows each
  // one's own batch size.
  const topSites = (a: GeoArea) => {
    const areaMetrics = getSiteAnalysis().flow_site_metrics?.[String(period)]?.[rowKey]?.[a];
    if (!areaMetrics) return [];
    const b = market === "REP" ? 0 : 4;
    return Object.entries(areaMetrics)
      .map(([site, v]) => {
        const p = { cur: v[b], py: v[b + 1] };
        const s = { cur: v[b + 2], py: v[b + 3] };
        if (isEff) {
          const cur = s.cur > 0 ? p.cur / s.cur : 0;
          const py = s.py > 0 ? p.py / s.py : 0;
          return {
            site,
            value: fmtRatio(cur),
            yoy: cur > 0 && py > 0 ? (cur - py) / py : null,
            delta: null as string | null,
            rank: s.cur,
            keep: s.cur > 0 || s.py > 0,
          };
        }
        const t = metric === "pieces" ? p : s;
        return {
          site,
          value: fmtCompact(t.cur),
          yoy: t.py > 0 ? (t.cur - t.py) / t.py : null,
          delta: fmtDeltaCompact(t.cur - t.py),
          rank: Math.abs(t.cur - t.py),
          keep: t.cur > 0 || t.py > 0,
        };
      })
      .filter((r) => r.keep)
      .sort((x, y) => y.rank - x.rank)
      .slice(0, 3);
  };

  // One-line "why". Ratios: pieces growth vs shipments growth (mix-aware).
  // Volumes are additive, so the honest attribution is the largest area
  // moving in the same direction as the total.
  const narrative = (() => {
    if (isEff) {
      const comp = components(cell, market);
      if (triple.yoy == null) return "Not enough shipment history to measure a change here.";
      const up = triple.yoy > 0;
      const dir = up ? "rose" : triple.yoy < 0 ? "fell" : "held";
      const rel = up ? "volume outgrew shipments" : "shipments outgrew volume";
      const result = up ? "carries more" : "carries fewer";
      return `Batch size ${dir} ${fmtPctSigned(triple.yoy)}: ${rel} (pieces ${fmtPctSigned(comp.pieces.yoy)} vs shipments ${fmtPctSigned(comp.shipments.yoy)}), so each ${market} shipment ${result} pieces.`;
    }
    if (triple.cur === 0 && triple.py === 0) return `No ${market} ${noun} recorded in this scope.`;
    if (triple.yoy == null)
      return `New activity: ${fmtCompact(triple.cur)} ${noun} this year with no prior-year baseline in this scope.`;
    const delta = triple.cur - triple.py;
    const dir = triple.yoy > 0 ? "rose" : triple.yoy < 0 ? "fell" : "held flat";
    const base = `${market} ${noun} ${dir} ${fmtPctSigned(triple.yoy)} (${fmtDeltaCompact(delta)}) vs the same period last year`;
    if (usedArea !== "ALL") {
      const all = cellTriple(focusRow.geo_data["ALL"] ?? null, metric, market);
      return all.yoy != null
        ? `In ${areaLabel(usedArea)}, ${base}; across all areas it moved ${fmtPctSigned(all.yoy)}.`
        : `In ${areaLabel(usedArea)}, ${base}.`;
    }
    const top = areaList
      .filter((a) => a.delta !== 0 && Math.sign(a.delta) === Math.sign(delta))
      .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))[0];
    if (!top || delta === 0) return `${base}.`;
    return `${base}; most of the ${delta > 0 ? "gain" : "drop"} sits in ${top.label} (${fmtDeltaCompact(top.delta)}).`;
  })();

  if (siteView) {
    return (
      <Modal open={open} onClose={onClose} labelledBy="eff-title">
        <SiteAnalysis site={siteView} onBack={() => setSiteView(null)} onClose={onClose} />
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="eff-title">
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <MktChip market={market} lg />
          <div className={styles.headText}>
            <h2 id="eff-title" className={styles.title}>
              {rowLabel.category} · {rowLabel.sub_category}
            </h2>
            <span className={styles.scope}>
              {areaLabel(usedArea)} · {isEff ? "pieces per shipment" : `${noun} YTD`}
            </span>
          </div>
        </div>
        <Button variant="icon" aria-label="Close" onClick={onClose}>
          ×
        </Button>
      </header>

      <div className={styles.headline}>
        <div className={styles.bigBlock}>
          <span className={styles.bigVal}>
            {fmtVal(triple.cur)}
            <span className={`${styles.bigChip} ${styles[sign(triple.yoy)]}`}>
              {trend(triple.yoy)} {fmtPctSigned(triple.yoy)}
            </span>
          </span>
          <span className={styles.bigSub}>
            {isEff ? "pcs / shipment" : `${noun} YTD`} · vs {fmtVal(triple.py)} last year
          </span>
        </div>
        <p className={styles.narrative}>{narrative}</p>
      </div>

      <CommentPanel
        flow={rowKey}
        market={market}
        area={usedArea}
        flowLabel={`${rowLabel.category} · ${rowLabel.sub_category}`}
        onSite={setSiteView}
      />

      <section className={styles.section}>
        <h3 className={styles.h3}>
          <span className={styles.h3Title}>
            Over time <MktChip market={market} />
          </span>
          <span className={styles.legend}>
            <span className={`${styles.sw} ${styles.swCur}`} /> {trends.current_year}
            <span className={`${styles.sw} ${styles.swPy}`} /> {trends.prior_year}
          </span>
        </h3>
        {series.cy.some((v) => v > 0) || series.py.some((v) => v > 0) ? (
          <TrendChart
            cy={series.cy}
            py={series.py}
            monthLabels={trends.month_labels}
            currentYear={trends.current_year}
            priorYear={trends.prior_year}
            fmt={fmtVal}
            metricName={isEff ? "pieces per shipment" : `${market} ${noun}`}
          />
        ) : (
          <p className={styles.muted}>
            {isEff ? "No monthly shipment history in this scope." : "No monthly history in this scope."}
          </p>
        )}
      </section>

      <section className={styles.section}>
        <h3 className={styles.h3}>
          <span className={styles.h3Title}>
            Where the change comes from <MktChip market={market} />
          </span>
        </h3>
        {areaList.length ? (
          <>
            <div className={styles.chgHead}>
              <span />
              <span className={`${styles.chgHeadNum} ${styles.chgHeadWide}`}>
                Change vs {trends.prior_year}
              </span>
              <span className={styles.chgHeadNum}>{trends.current_year} YTD</span>
              <span className={styles.chgHeadNum}>YoY</span>
            </div>
            <ChangeRow
              label={areaLabel("ALL")}
              delta={totalChange ?? 0}
              deltaText={fmtDelta(totalChange)}
              value={fmtVal(total.cur)}
              yoy={total.yoy}
              defined={isDefined(totalCell, total)}
              naText={naText}
              zero={zero}
              span={span}
              total
              focus={usedArea === "ALL"}
            />
            {ranked.map((a) => {
              const expanded = openArea === a.key;
              const drivers = expanded ? topSites(a.key) : [];
              return (
                <Fragment key={a.key}>
                  <ChangeRow
                    label={a.label}
                    delta={a.delta}
                    deltaText={a.deltaText}
                    value={fmtVal(a.cur)}
                    yoy={a.yoy}
                    defined={a.defined}
                    naText={naText}
                    zero={zero}
                    span={span}
                    focus={a.key === usedArea}
                    onClick={a.defined ? () => setOpenArea(expanded ? null : a.key) : undefined}
                    expanded={expanded}
                  />
                  {expanded && (
                    <div className={styles.siteDrill}>
                      <p className={styles.siteDrillHead}>
                        {isEff ? "Largest sites by shipments" : "Top driver sites"} · {a.label}
                      </p>
                      {drivers.length ? (
                        drivers.map((d) => (
                          <div key={d.site} className={styles.siteRow}>
                            <button
                              type="button"
                              className={styles.siteBtn}
                              onClick={() => setSiteView(d.site)}
                              title={`Open the ${d.site} site analysis`}
                            >
                              <span aria-hidden="true">📍</span> {d.site}
                            </button>
                            <span className={styles.siteDelta}>{d.delta ?? ""}</span>
                            <span className={styles.siteVal}>{d.value}</span>
                            <span className={`${styles.effChip} ${styles[sign(d.yoy)]}`}>
                              {trend(d.yoy)} {fmtPctSigned(d.yoy)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className={styles.siteNone}>No site detail in this scope.</p>
                      )}
                    </div>
                  )}
                </Fragment>
              );
            })}
            <p className={styles.chgNote}>
              Bar = change vs {trends.prior_year} over the same months, on one scale for every
              area. Click an area for its top driver sites.
            </p>
          </>
        ) : (
          <p className={styles.muted}>No per-area breakdown.</p>
        )}
      </section>
    </Modal>
  );
}
