"use client";

import { usePathname } from "next/navigation";
import styles from "./Masthead.module.css";

/**
 * Masthead period marker. On Content the month is chosen in the section's own
 * header selector, so this global chip would be redundant (and could contradict
 * a non-default month) — hide it there and show it only on the other sections,
 * where it marks the dataset's period.
 */
export function PeriodChip({ period }: { period: string }) {
  const pathname = usePathname();
  const onContent = pathname === "/content" || pathname === "/content/";
  if (onContent) return null;
  return <span className={styles.chip}>{period}</span>;
}
