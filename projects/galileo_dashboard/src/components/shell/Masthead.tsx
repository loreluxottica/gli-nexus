"use client";

import Link from "next/link";
import { geoOptions, getContent } from "@/data/content";
import { AreaTabs } from "./AreaTabs";
import { PeriodChip } from "./PeriodChip";
import styles from "./Masthead.module.css";

/**
 * Masthead: period label + geo options from the content payload.
 *
 * Client, because the payload is fetched rather than baked in. It renders under
 * the data gate in (app)/layout.tsx, so the payload is guaranteed present here.
 */
export function Masthead() {
  const cv = getContent().current_view;
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

      <AreaTabs options={geoOptions()} />

      <div className={styles.right}>
        <PeriodChip period={`${cv.period_label} ${cv.year}`} />
      </div>
    </header>
  );
}
