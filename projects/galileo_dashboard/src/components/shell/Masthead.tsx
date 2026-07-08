import Link from "next/link";
import { content, GEO_OPTIONS } from "@/data/content";
import { AreaTabs } from "./AreaTabs";
import { PeriodChip } from "./PeriodChip";
import styles from "./Masthead.module.css";

/**
 * Midnight masthead. Server component: reads the static content for the period
 * label and hands the (small) geo options list to the client AreaTabs. The
 * 35 KB content payload never reaches the client bundle this way.
 */
export function Masthead() {
  const cv = content.current_view;
  return (
    <header className={styles.topbar}>
      {/* Wordmark links back to the landing page. */}
      <Link
        href="/"
        className={styles.brand}
        aria-label="EssilorLuxottica — Galileo Content Observatory. Back to the landing page"
        title="Back to the landing page"
      >
        <span className={styles.brandMark}>Galileo</span>
        <span className={styles.brandRule} aria-hidden="true" />
        <span className={styles.brandMeta}>
          <span className={styles.brandOrg}>EssilorLuxottica</span>
          <span className={styles.brandTag}>Content Observatory</span>
        </span>
      </Link>

      <AreaTabs options={GEO_OPTIONS} />

      <div className={styles.right}>
        <PeriodChip period={`${cv.period_label} ${cv.year}`} />
      </div>
    </header>
  );
}
