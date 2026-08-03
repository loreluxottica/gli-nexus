"use client";

import { getContent } from "@/data/content";
import { GalileoData } from "@/data/GalileoData";
import { fmtInt } from "@/lib/format";
import styles from "@/app/Landing.module.css";

/**
 * The two headline figures on the landing hero.
 *
 * Split out as a client component so the page itself can stay a server
 * component and keep exporting `metadata` — only these numbers depend on the
 * fetched payload. While it loads the hero keeps its shape, with em-dashes in
 * place of the values, so nothing jumps when they arrive.
 */
function Stats() {
  const content = getContent();
  const cv = content.current_view;
  return (
    <Figures
      sitesMapped={fmtInt(content.database_page.mapping.length)}
      lastUpdate={`${cv.period_label} ${cv.year}`}
    />
  );
}

function Figures({ sitesMapped, lastUpdate }: { sitesMapped: string; lastUpdate: string }) {
  return (
    <dl className={styles.stats}>
      <div className={styles.stat} style={{ animationDelay: "0.35s" }}>
        <dt>Sites mapped</dt>
        <dd>{sitesMapped}</dd>
      </div>
      <div className={styles.stat} style={{ animationDelay: "0.45s" }}>
        <dt>Last update</dt>
        <dd className={styles.statPeriod}>{lastUpdate}</dd>
      </div>
    </dl>
  );
}

export function LandingStats() {
  return (
    <GalileoData fallback={<Figures sitesMapped="—" lastUpdate="—" />}>
      <Stats />
    </GalileoData>
  );
}
