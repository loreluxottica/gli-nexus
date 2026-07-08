"use client";

import { useMemo, useState, useDeferredValue } from "react";
import type { DbRow } from "@/data/types";
import styles from "./LiveDemos.module.css";

// DbRow tuple indices (see types.ts): 0 month · 1 site · 2 market · 3 product ·
// 4 site type · 5 pieces · 6 shipments · 7 geo (display) · 9 customer · 10 geo (canonical).
const SHOW_MAX = 8;
const QUICK = ["Servioptica", "Dongguan", "Stock Lenses", "EMEA"];

/**
 * Live demo — search the actual database (9,676 records). The heavy payload
 * is dynamically imported only when the presenter asks for it, so the landing
 * stays light; same lazy-chunk pattern as the Database route.
 */
export function LiveDbSearch() {
  const [rows, setRows] = useState<DbRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const dq = useDeferredValue(q);

  const load = () => {
    setLoading(true);
    import("@/data/db.json").then((m) => {
      setRows((m.default ?? m) as unknown as DbRow[]);
      setLoading(false);
    });
  };

  const hits = useMemo(() => {
    if (!rows) return [];
    const s = dq.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      `${r[1]} ${r[2]} ${r[3]} ${r[4]} ${r[9]} ${r[10]}`.toLowerCase().includes(s)
    );
  }, [rows, dq]);

  if (!rows) {
    return (
      <div className={styles.demo}>
        <button
          type="button"
          className={styles.loadBtn}
          onClick={load}
          disabled={loading}
        >
          {loading ? "Loading…" : "Load the live database · 9,676 records"}
        </button>
        <p className={styles.demoNote}>
          The full dataset loads on demand; the page stays light until you ask.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.demo}>
      <div className={styles.searchRow}>
        <input
          type="search"
          className={styles.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search site, market, product, area…"
          aria-label="Search the database"
        />
        <span className={styles.hitCount} role="status">
          {hits.length.toLocaleString("en-US")} records
        </span>
      </div>
      <div className={styles.chips}>
        {QUICK.map((s) => (
          <button
            key={s}
            type="button"
            className={`${styles.chip} ${q === s ? styles.chipActive : ""}`}
            onClick={() => setQ(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <caption className="sr-only">
            First matching database records for the current search.
          </caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Site</th>
              <th scope="col">Market</th>
              <th scope="col">Product</th>
              <th scope="col" className={styles.num}>
                Pieces
              </th>
              <th scope="col">Area</th>
            </tr>
          </thead>
          <tbody>
            {hits.slice(0, SHOW_MAX).map((r, i) => (
              <tr key={`${r[0]}-${r[1]}-${i}`}>
                <td className={styles.mono}>{r[0]}</td>
                <td className={styles.rowCat}>{r[1]}</td>
                <td className={styles.mono}>{r[2]}</td>
                <td>{r[3]}</td>
                <td className={`${styles.num} ${styles.mono}`}>
                  {typeof r[5] === "number" ? r[5].toLocaleString("en-US") : "—"}
                </td>
                <td className={styles.mono}>{r[10] || "—"}</td>
              </tr>
            ))}
            {hits.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  No records match “{q}”.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className={styles.demoNote}>
        Showing {Math.min(SHOW_MAX, hits.length)} of{" "}
        {hits.length.toLocaleString("en-US")} matching records. The full table
        lives in the Database view.
      </p>
    </div>
  );
}
