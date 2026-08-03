import Link from "next/link";
import styles from "./Roadmap.module.css";

/**
 * The roadmap's single entry point, rendered next to the landing CTA.
 * Removing <RoadmapLink /> from src/app/page.tsx takes the feature out of
 * every user's reach without touching anything else.
 */
export function RoadmapLink() {
  return (
    <Link href="/roadmap" className={styles.landingLink}>
      Development roadmap <span aria-hidden="true">→</span>
    </Link>
  );
}
