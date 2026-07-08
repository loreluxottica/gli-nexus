import styles from "./CoverageBar.module.css";

/** Coverage % as a small bar + label. aria-label so it isn't bar-only for SR.
 *  `compact` narrows the bar/label for dense tables (Content). */
export function CoverageBar({
  value,
  compact = false,
}: {
  value: number | null | undefined;
  compact?: boolean;
}) {
  if (value === null || value === undefined) {
    return <span className={styles.muted}>—</span>;
  }
  const pct = Math.max(0, Math.min(1, Number(value)));
  const w = Math.round(pct * 100);
  return (
    <span
      className={`${styles.wrap} ${compact ? styles.compact : ""}`}
      role="img"
      aria-label={`Coverage ${w}%`}
    >
      <span className={styles.bar}>
        <span className={styles.fill} style={{ width: `${w}%` }} />
      </span>
      <span className={styles.text}>{w}%</span>
    </span>
  );
}
