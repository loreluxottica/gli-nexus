import Link from "next/link";
import styles from "./Roadmap.module.css";

/**
 * The roadmap's single entry point, rendered next to the landing CTA when the
 * GALILEO_ROADMAP_ENABLED build flag is active.
 */
export function RoadmapLink() {
  return (
    <Link href="/roadmap" className={styles.landingLink}>
      Development roadmap <span aria-hidden="true">→</span>
    </Link>
  );
}
