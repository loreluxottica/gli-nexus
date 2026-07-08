import { fmtCompact } from "@/lib/format";
import styles from "./PairedYoYBar.module.css";

/**
 * Two stacked horizontal bars on a shared scale: the current YTD (solid accent)
 * over the same period last year (ghost). Magnitude AND direction read without
 * decoding digits; the compact value sits at the end of each bar. `max` is the
 * largest value across the visible rows so bars are comparable row-to-row.
 */
export function PairedYoYBar({
  cur,
  py,
  max,
  curLabel,
  pyLabel,
  fmt = fmtCompact,
}: {
  cur: number;
  py: number;
  max: number;
  curLabel: string;
  pyLabel: string;
  fmt?: (n: number | null | undefined) => string;
}) {
  const pct = (v: number) => (max > 0 ? Math.max(0, (v / max) * 100) : 0);
  return (
    <div className={styles.pair} aria-hidden="true">
      <div className={styles.track}>
        <div className={styles.barCur} style={{ width: `${pct(cur)}%` }} />
        <span className={styles.val}>{fmt(cur)}</span>
      </div>
      <div className={styles.track}>
        <div className={styles.barPy} style={{ width: `${pct(py)}%` }} />
        <span className={`${styles.val} ${styles.valPy}`}>{fmt(py)}</span>
      </div>
      <span className="sr-only">
        {curLabel} {fmt(cur)}, {pyLabel} {fmt(py)}.
      </span>
    </div>
  );
}
