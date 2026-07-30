import type { Metadata } from "next";
import { content } from "@/data/content";
import { Galaxy } from "@/components/landing/Galaxy";
import { EnterLink } from "@/components/landing/EnterLink";
import { RoadmapLink } from "@/components/roadmap/RoadmapLink";
import { fmtInt } from "@/lib/format";
import styles from "./Landing.module.css";

export const metadata: Metadata = {
  title: "Galileo — Global Shipment Visibility Tool",
  description:
    "A strategic view of global shipment flows across products, origin sites, and destination areas.",
};

/**
 * Landing = a single hero over the rotating galaxy. Identity, headline stats
 * (sites mapped + last update), and a way into the Observatory.
 */
export default function Landing() {
  const cv = content.current_view;
  const lastUpdate = `${cv.period_label} ${cv.year}`;
  // Mapping sheet row count — same metric as the static landing handoff.
  const sitesMapped = content.database_page.mapping.length;

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

          <dl className={styles.stats}>
            <div className={styles.stat} style={{ animationDelay: "0.35s" }}>
              <dt>Sites mapped</dt>
              <dd>{fmtInt(sitesMapped)}</dd>
            </div>
            <div className={styles.stat} style={{ animationDelay: "0.45s" }}>
              <dt>Last update</dt>
              <dd className={styles.statPeriod}>{lastUpdate}</dd>
            </div>
          </dl>

          <div className={styles.ctaRow}>
            <EnterLink className={styles.ctaPrimary}>
              Enter the Observatory <span aria-hidden="true">→</span>
            </EnterLink>
            <RoadmapLink />
          </div>
        </div>
      </section>
    </div>
  );
}
