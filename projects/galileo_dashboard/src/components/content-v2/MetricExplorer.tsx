"use client";

import { Fragment, useEffect, useState } from "react";
import type { ContentTrends, CurrentView, GeoArea, Market, MetricCell } from "@/data/types";
import { areaLabel } from "@/data/geo";
import { siteAnalysis } from "@/data/siteAnalysis";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { CommentPanel } from "./CommentPanel";
import { SiteAnalysis } from "./SiteAnalysis";
import { fmtCompact, fmtDeltaCompact, fmtPctSigned, fmtRatio, sign, trend } from "@/lib/format";
import { cellTriple, components, hasShipments, seriesFor, type Metric } from "@/lib/contentMetrics";
import styles from "./MetricExplorer.module.css";

const GEO_AREAS: GeoArea[] = ["APAC", "EMEA", "LATAM", "NA"];

const resolveArea = (map: Record<string, unknown>, area: GeoArea): GeoArea =>
  (Object.prototype.hasOwnProperty.call(map, area) ? area : "ALL") as GeoArea;

/** Larger over-time line chart: current year (solid) over prior year (ghost),
 *  shared y-scale, with a y-max tick and month labels. */
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
  const W = 720;
  const H = 150;
  const padL = 46;
  const padR = 12;
  const padT = 14;
  const padB = 24;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const ymax = Math.max(1, ...cy, ...py);
  const x = (i: number) => padL + (i * plotW) / 11;
  const y = (v: number) => padT + plotH - (v / ymax) * plotH;
  const line = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const lastI = cy.length - 1;

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Monthly ${metricName}, ${currentYear} versus ${priorYear}`}
    >
      {/* y axis: max + zero */}
      <line className={styles.grid} x1={padL} y1={padT} x2={W - padR} y2={padT} />
      <line className={styles.grid} x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} />
      <text className={styles.axis} x={padL - 6} y={padT + 4} textAnchor="end">
        {fmt(ymax)}
      </text>
      <text className={styles.axis} x={padL - 6} y={padT + plotH} textAnchor="end">
        0
      </text>
      {/* month labels (every other) */}
      {monthLabels.map((m, i) =>
        i % 2 === 0 ? (
          <text key={m} className={styles.axis} x={x(i)} y={H - 6} textAnchor="middle">
            {m}
          </text>
        ) : null,
      )}
      <path className={styles.py} d={line(py)} />
      {cy.length > 1 && <path className={styles.cy} d={line(cy)} />}
      {lastI >= 0 && cy[lastI] > 0 && <circle className={styles.dot} cx={x(lastI)} cy={y(cy[lastI])} r={3} />}
    </svg>
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

/** One comparison row in the cross-area list. The diverging bar grows from a
 *  centre line; `mag` (0..1) is the row's weight on the list's own scale:
 *  |YoY| for ratios, absolute contribution |cur − py| for volumes. With
 *  `onClick` the row is a button that reveals its top driver sites. */
function EffRow({
  label,
  value,
  yoy,
  defined,
  pos,
  mag,
  naText,
  focus,
  onClick,
  expanded,
}: {
  label: string;
  value: string;
  yoy: number | null;
  defined: boolean;
  pos: boolean;
  mag: number;
  naText: string;
  focus?: boolean;
  onClick?: () => void;
  expanded?: boolean;
}) {
  const width = Math.min(50, mag * 50);
  const inner = (
    <>
      <span className={styles.effLabel} title={label}>
        {onClick && (
          <span className={`${styles.chev} ${expanded ? styles.chevOpen : ""}`} aria-hidden="true">
            ▸
          </span>
        )}
        {label}
      </span>
      {defined ? (
        <>
          <span className={styles.effBarTrack}>
            <span
              className={`${styles.effBar} ${pos ? styles.barPos : styles.barNeg}`}
              style={pos ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
            />
          </span>
          <span className={styles.effRatio}>{value}</span>
          <span className={`${styles.effChip} ${styles[sign(yoy)]}`}>
            {trend(yoy)} {fmtPctSigned(yoy)}
          </span>
        </>
      ) : (
        <span className={styles.effNa}>{naText}</span>
      )}
    </>
  );
  const cls = `${styles.effRow} ${focus ? styles.focus : ""}`;
  if (onClick) {
    return (
      <button
        type="button"
        className={`${cls} ${styles.effRowBtn}`}
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

/** Aligned column header for a comparison list. */
function EffHead({ valueLabel }: { valueLabel: string }) {
  return (
    <div className={styles.effHeadRow}>
      <span />
      <span />
      <span className={styles.effHeadNum}>{valueLabel}</span>
      <span className={styles.effHeadNum}>YoY</span>
    </div>
  );
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
  const cell: MetricCell | null = focusRow.geo_data[usedArea] ?? null;
  const triple = cellTriple(cell, metric, market);
  const node = trends.rows[rowKey]?.[usedArea] ?? null;
  const rawSeries = seriesFor(node, metric, market);
  // Cap the current-year line to the selected window (prior year stays full).
  const series = { cy: rawSeries.cy.slice(0, period), py: rawSeries.py };

  // Cross-area: this flow across geographies. Bar weight = |YoY| for ratios,
  // absolute contribution for volumes, so a large % swing on a tiny base
  // cannot masquerade as the driver.
  const areaList = GEO_AREAS.filter((a) =>
    Object.prototype.hasOwnProperty.call(focusRow.geo_data, a),
  ).map((a) => {
    const c = focusRow.geo_data[a] ?? null;
    const t = cellTriple(c, metric, market);
    return {
      key: a,
      label: areaLabel(a),
      ...t,
      delta: t.cur - t.py,
      defined: isEff ? hasShipments(c, market) : t.cur > 0 || t.py > 0,
    };
  });
  const weight = (a: { yoy: number | null; delta: number }) =>
    isEff ? (a.yoy != null ? Math.abs(a.yoy) : 0) : Math.abs(a.delta);
  const maxW = Math.max(0, ...areaList.map(weight));

  // Top driver plants behind an area's number (on demand — plant detail stays
  // behind a click). Volumes rank by absolute delta, the sites that actually
  // moved the figure; efficiency ranks the largest shippers and shows each
  // one's own batch size.
  const topSites = (a: GeoArea) => {
    const areaMetrics = siteAnalysis.flow_site_metrics?.[String(period)]?.[rowKey]?.[a];
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
              {focusRow.category} · {focusRow.sub_category}
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
        flowLabel={`${focusRow.category} · ${focusRow.sub_category}`}
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
            Across areas <MktChip market={market} />
          </span>
        </h3>
        {areaList.length ? (
          <>
            <EffHead valueLabel={isEff ? "pcs/ship" : noun} />
            {areaList.map((a) => {
              const expanded = openArea === a.key;
              const drivers = expanded ? topSites(a.key) : [];
              return (
                <Fragment key={a.key}>
                  <EffRow
                    label={a.label}
                    value={fmtVal(a.cur)}
                    yoy={a.yoy}
                    defined={a.defined}
                    pos={isEff ? (a.yoy ?? 0) >= 0 : a.delta >= 0}
                    mag={maxW > 0 ? weight(a) / maxW : 0}
                    naText={naText}
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
          </>
        ) : (
          <p className={styles.muted}>No per-area breakdown.</p>
        )}
      </section>
    </Modal>
  );
}
