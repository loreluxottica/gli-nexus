import type { Metadata } from "next";
import { content } from "@/data/content";
import { Galaxy } from "@/components/landing/Galaxy";
import { EnterLink } from "@/components/landing/EnterLink";
import styles from "./Landing.module.css";

export const metadata: Metadata = {
  title: "Galileo — Global Shipment Visibility Tool",
  description:
    "A strategic view of global shipment flows across products, origin sites, and destination areas.",
};

/**
 * Landing = a single hero over the rotating galaxy. The walkthrough that used
 * to live here as a scroll-snap deck has been replaced by per-section
 * tutorials inside the Observatory, so the landing is now just the cover:
 * identity, a one-line value statement, the headline stats, and a way in.
 */
export default function Landing() {
  const cv = content.current_view;
  const records = content.database_page.row_count;
  const sites = content.database_page.mapping.length;
  const period = `${cv.period_label} ${cv.year}`;

  return (
    <div className={styles.page}>
      <Galaxy />

      <header className={styles.topbar}>
        <div className={styles.wordmark}>
          <span className={styles.wordmarkName}>Galileo</span>
          <span className={styles.wordmarkOrg}>EssilorLuxottica</span>
        </div>
        <EnterLink className={styles.topbarLink}>
          Enter the Observatory <span aria-hidden="true">→</span>
        </EnterLink>
      </header>

      <section className={styles.cover}>
        <div className={styles.hero}>
          <h1 className={styles.brand}>
            <span className={styles.brandGalileo}>Galileo</span>
            <span className={styles.brandBy}>by EssilorLuxottica</span>
          </h1>
          <p className={styles.toolLine}>Global Shipment Visibility Tool</p>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt>Shipment records</dt>
              <dd>{records.toLocaleString("en-US")}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Origin sites mapped</dt>
              <dd>{sites}</dd>
            </div>
            <div className={styles.stat}>
              <dt>Last update</dt>
              <dd>{period}</dd>
            </div>
          </dl>
          <div className={styles.ctaRow}>
            <EnterLink
              className={styles.ctaPrimary}
              returningChildren={
                <>
                  Continue where you left off <span aria-hidden="true">→</span>
                </>
              }
            >
              Enter the Observatory <span aria-hidden="true">→</span>
            </EnterLink>
          </div>
        </div>
      </section>
    </div>
  );
}
