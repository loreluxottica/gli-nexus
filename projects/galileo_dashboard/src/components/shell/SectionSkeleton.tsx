import styles from "./SectionSkeleton.module.css";

/** Instant placeholder while a section chunk hydrates (beats a blank main). */
export function SectionSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <section className={`panel ${styles.wrap}`} aria-busy="true" aria-label={label}>
      <div className={styles.head}>
        <div className={`${styles.bar} ${styles.title}`} />
        <div className={`${styles.bar} ${styles.chip}`} />
      </div>
      <div className={`${styles.bar} ${styles.filters}`} />
      <div className={styles.table}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={styles.row}>
            <div className={`${styles.bar} ${styles.cellA}`} />
            <div className={`${styles.bar} ${styles.cellB}`} />
            <div className={`${styles.bar} ${styles.cellC}`} />
          </div>
        ))}
      </div>
    </section>
  );
}
