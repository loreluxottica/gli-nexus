"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fmtCompact, fmtPctSigned, sign, trend } from "@/lib/format";
import styles from "./Sparkline.module.css";

/**
 * Mini trend chart: current year (solid accent line + soft area fill, truncated
 * to the YTD period) over the prior year (dashed ghost, full 12 months) on a
 * shared Jan→Dec axis and a shared y-scale. Hovering reveals a guide line and a
 * tooltip with the month and both years' values + YoY, so the trend is readable
 * to the number, not just a shape. The tooltip is portalled to <body> so it is
 * never clipped by the table's scroll container.
 */
export function Sparkline({
  cy,
  py,
  monthLabels,
  label,
  currentYear,
  priorYear,
  width = 140,
  height = 40,
  valueFmt = fmtCompact,
}: {
  cy: number[];
  py: number[];
  monthLabels: string[];
  label: string;
  currentYear?: number;
  priorYear?: number;
  width?: number;
  height?: number;
  valueFmt?: (n: number | null | undefined) => string;
}) {
  const pad = 4;
  const slots = 12; // Jan..Dec
  const gid = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState<{ idx: number; left: number; top: number } | null>(null);
  useEffect(() => setMounted(true), []);

  const ymax = Math.max(1, ...cy, ...py);
  const x = (i: number) => pad + (i * (width - 2 * pad)) / (slots - 1);
  const y = (v: number) => height - pad - (v / ymax) * (height - 2 * pad);
  const linePath = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  const hasData = cy.some((v) => v > 0) || py.some((v) => v > 0);
  const lastI = cy.length - 1;

  if (!hasData) {
    return (
      <span className={styles.empty} aria-hidden="true">
        —
      </span>
    );
  }

  const areaPath =
    cy.length > 1
      ? `${linePath(cy)} L${x(lastI).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z`
      : "";

  const onMove = (e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const rx = e.clientX - rect.left;
    let idx = Math.round(((rx - pad) / (width - 2 * pad)) * (slots - 1));
    idx = Math.min(slots - 1, Math.max(0, idx));
    setHover({ idx, left: rect.left, top: rect.top });
  };

  const hIdx = hover?.idx ?? null;
  const cyV = hIdx != null && hIdx < cy.length ? cy[hIdx] : null;
  const pyV = hIdx != null && hIdx < py.length ? py[hIdx] : null;
  const delta = cyV != null && pyV != null && pyV > 0 ? (cyV - pyV) / pyV : null;
  const showTip = hover != null && (cyV != null || pyV != null);

  return (
    <span
      className={styles.wrap}
      ref={wrapRef}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg
        className={styles.spark}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
      >
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" className={styles.gradTop} />
            <stop offset="100%" className={styles.gradBottom} />
          </linearGradient>
        </defs>

        {/* baseline anchors the vertical scale */}
        <line className={styles.base} x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} />
        {areaPath && <path d={areaPath} fill={`url(#${gid})`} stroke="none" />}
        {/* prior-year ghost, full year */}
        <path className={styles.py} d={linePath(py)} />
        {/* current-year solid, truncated to YTD */}
        {cy.length > 1 && <path className={styles.cy} d={linePath(cy)} />}
        {/* month markers on the current year */}
        {cy.map((v, i) => (
          <circle key={i} className={styles.pt} cx={x(i)} cy={y(v)} r={1.6} />
        ))}
        {lastI >= 0 && <circle className={styles.dot} cx={x(lastI)} cy={y(cy[lastI])} r={2.7} />}

        {/* hover guide + emphasised points */}
        {hIdx != null && (
          <>
            <line className={styles.guide} x1={x(hIdx)} y1={pad} x2={x(hIdx)} y2={height - pad} />
            {pyV != null && <circle className={styles.hpy} cx={x(hIdx)} cy={y(pyV)} r={2.6} />}
            {cyV != null && <circle className={styles.hcy} cx={x(hIdx)} cy={y(cyV)} r={3} />}
          </>
        )}
        <title>{label}</title>
      </svg>

      {mounted &&
        showTip &&
        createPortal(
          <span
            className={styles.tip}
            style={{ left: hover!.left + x(hover!.idx), top: hover!.top - 8 }}
          >
            <span className={styles.tipMonth}>{monthLabels[hover!.idx]}</span>
            {cyV != null && (
              <span className={styles.tipRow}>
                <span className={`${styles.sw} ${styles.swCy}`} />
                <span className={styles.tipYear}>{currentYear ?? "This yr"}</span>
                <span className={styles.tipVal}>{valueFmt(cyV)}</span>
              </span>
            )}
            {pyV != null && (
              <span className={styles.tipRow}>
                <span className={`${styles.sw} ${styles.swPy}`} />
                <span className={styles.tipYear}>{priorYear ?? "Last yr"}</span>
                <span className={styles.tipVal}>{valueFmt(pyV)}</span>
              </span>
            )}
            {delta != null && (
              <span className={`${styles.tipDelta} ${styles[sign(delta)]}`}>
                {trend(delta)} {fmtPctSigned(delta)} YoY
              </span>
            )}
          </span>,
          document.body,
        )}
    </span>
  );
}
