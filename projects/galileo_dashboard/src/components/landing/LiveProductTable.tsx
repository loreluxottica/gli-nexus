"use client";

import { useState } from "react";
import styles from "./LiveDemos.module.css";

/** Slim, serializable slice of current_view passed down by the server page. */
export type LiveRow = {
  category: string;
  sub: string;
  byArea: Record<
    string,
    {
      rep: number | null;
      repYoy: number | null;
      lm: number | null;
      lmYoy: number | null;
    }
  >;
};

function fmtCompact(v: number | null): string {
  if (v === null) return "—";
  if (v === 0) return "0";
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (Math.abs(v) >= 1e3) return Math.round(v / 1e3) + "k";
  return String(Math.round(v));
}

function fmtYoy(v: number | null): string {
  if (v === null) return "—";
  return (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
}

function yoyClass(v: number | null): string {
  if (v === null) return "";
  return v >= 0 ? styles.pos : styles.neg;
}

/**
 * Live demo — the real Content figures (Pieces, REP & LM markets), scoped by
 * the same Geographical Area dimension the Observatory uses. Numbers update
 * instantly when the presenter switches area.
 */
export function LiveProductTable({
  areas,
  rows,
}: {
  areas: string[];
  rows: LiveRow[];
}) {
  const [area, setArea] = useState(areas[0]);

  return (
    <div className={styles.demo}>
      <div className={styles.chips} role="tablist" aria-label="Geographical area">
        {areas.map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={area === a}
            className={`${styles.chip} ${area === a ? styles.chipActive : ""}`}
            onClick={() => setArea(a)}
          >
            {a === "ALL" ? "Global" : a}
          </button>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">
            Pieces by product for the selected geographical area, REP and LM
            markets, with year-over-year change.
          </caption>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col" className={styles.num}>
                REP
              </th>
              <th scope="col" className={styles.num}>
                YoY
              </th>
              <th scope="col" className={styles.num}>
                LM
              </th>
              <th scope="col" className={styles.num}>
                YoY
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = r.byArea[area];
              return (
                <tr key={`${r.category}-${r.sub}`}>
                  <td>
                    <span className={styles.rowCat}>{r.category}</span>
                    <span className={styles.rowSub}>{r.sub}</span>
                  </td>
                  <td className={styles.num}>{fmtCompact(d?.rep ?? null)}</td>
                  <td className={`${styles.num} ${yoyClass(d?.repYoy ?? null)}`}>
                    {fmtYoy(d?.repYoy ?? null)}
                  </td>
                  <td className={styles.num}>{fmtCompact(d?.lm ?? null)}</td>
                  <td className={`${styles.num} ${yoyClass(d?.lmYoy ?? null)}`}>
                    {fmtYoy(d?.lmYoy ?? null)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className={styles.demoNote}>
        Live from the dataset — Pieces, {area === "ALL" ? "Global" : area} ·
        YTD April 2026 vs prior year.
      </p>
    </div>
  );
}
