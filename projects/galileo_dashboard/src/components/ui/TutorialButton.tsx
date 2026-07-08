import styles from "./TutorialButton.module.css";

/** Prominent "Tutorial" launcher placed in each Observatory section header —
 *  the primary way a visitor learns the section, so it is styled to be seen
 *  (solid accent pill + a brief attention pulse on mount). */
export function TutorialButton({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`${styles.btn} ${className ?? ""}`}
      onClick={onClick}
      aria-haspopup="dialog"
    >
      <span className={styles.iconWrap} aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
          <path
            d="M9.4 9.3a2.6 2.6 0 1 1 3.8 2.5c-.8.45-1.2 1-1.2 1.9v.3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="17" r="1.15" fill="currentColor" />
        </svg>
      </span>
      <span className={styles.label}>
        Tutorial
        <span className={styles.sub}>30-sec guided tour</span>
      </span>
    </button>
  );
}
