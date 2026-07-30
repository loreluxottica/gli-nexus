import styles from "./AutomationBar.module.css";

/**
 * Automation level as a single coloured word (Low / Mid / High) — the dominant
 * tier among the site shares. No bar.
 */
export function AutomationBar({
  low,
  mid,
  high,
}: {
  low: number | null | undefined;
  mid: number | null | undefined;
  high: number | null | undefined;
}) {
  const hasAny = low != null || mid != null || high != null;
  if (!hasAny) {
    return <span className={styles.muted}>—</span>;
  }
  const l = Math.max(0, Number(low ?? 0));
  const m = Math.max(0, Number(mid ?? 0));
  const h = Math.max(0, Number(high ?? 0));
  const tier: "low" | "mid" | "high" =
    h >= m && h >= l ? "high" : m >= l ? "mid" : "low";
  const label = tier === "high" ? "High" : tier === "mid" ? "Mid" : "Low";

  return (
    <span
      className={`${styles.word} ${styles[tier]}`}
      aria-label={`Automation level: ${label}`}
    >
      {label}
    </span>
  );
}
