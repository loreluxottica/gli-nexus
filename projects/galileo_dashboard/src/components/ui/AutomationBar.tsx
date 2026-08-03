import styles from "./AutomationBar.module.css";

export type AutomationLevel = "Low" | "Mid" | "High";

/** Dominant automation tier among the existing site-share values. */
export function getAutomationLevel(
  low: number | null | undefined,
  mid: number | null | undefined,
  high: number | null | undefined,
): AutomationLevel | null {
  if (low == null && mid == null && high == null) return null;

  const l = Math.max(0, Number(low ?? 0));
  const m = Math.max(0, Number(mid ?? 0));
  const h = Math.max(0, Number(high ?? 0));
  return h >= m && h >= l ? "High" : m >= l ? "Mid" : "Low";
}

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
  const label = getAutomationLevel(low, mid, high);
  if (!label) {
    return <span className={styles.muted}>—</span>;
  }
  const tier = label.toLowerCase() as "low" | "mid" | "high";

  return (
    <span
      className={`${styles.word} ${styles[tier]}`}
      aria-label={`Automation level: ${label}`}
    >
      {label}
    </span>
  );
}
