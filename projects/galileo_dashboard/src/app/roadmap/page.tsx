import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Galaxy } from "@/components/landing/Galaxy";
import { RoadmapView } from "@/components/roadmap/RoadmapView";
import { ROADMAP_ENABLED } from "@/lib/features";
import styles from "@/components/roadmap/Roadmap.module.css";

export const metadata: Metadata = {
  title: "Galileo — Development roadmap",
  description:
    "Delivered, running and planned work on the Galileo shipment visibility tool.",
};

/**
 * Roadmap chapter — lives outside the (app) route group, so it renders with
 * the landing's night sky instead of the Observatory chrome. Presentation
 * surface only: no app data is read here.
 */
export default function RoadmapPage() {
  if (!ROADMAP_ENABLED) notFound();

  return (
    <div className={styles.page}>
      <Galaxy />

      <header className={styles.topbar}>
        <Link href="/" className={styles.wordmark}>
          <span className={styles.wordmarkName}>Galileo</span>
          <span className={styles.wordmarkOrg}>EssilorLuxottica</span>
        </Link>
        <div className={styles.topbarLinks}>
          <Link href="/" className={styles.topbarLink}>
            <span aria-hidden="true">←</span> Landing
          </Link>
          <Link href="/content" className={styles.topbarLink}>
            Enter the Observatory <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <RoadmapView />
    </div>
  );
}
