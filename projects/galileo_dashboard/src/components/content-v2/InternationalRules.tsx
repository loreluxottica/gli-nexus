"use client";

import { Modal } from "@/components/ui/Modal";
import { INTERNATIONAL_RULES } from "@/data/internationalConditions";
import styles from "./InternationalRules.module.css";

/**
 * Quiet dial-style explainer: when Frames Replenishment is International.
 * No market-ID codes; CN03 cases folded under one plant.
 */
export function InternationalRules({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const titleId = "intl-rules-title";

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} size="sm">
      {open ? (
        <div className={styles.root}>
          <header className={styles.head}>
            <div>
              <p className={styles.kicker}>Accounting · Frames</p>
              <h2 id={titleId} className={styles.title}>
                International rules
              </h2>
            </div>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          <p className={styles.gate}>
            Only <em>Replenishment</em> Frames. Then the plant must match a line
            below.
          </p>

          <ul className={styles.list}>
            {INTERNATIONAL_RULES.map((rule) => {
              const plants = [...rule.plants].sort((a, b) => a.localeCompare(b));
              return (
                <li key={plants.join("-")} className={styles.row}>
                  <div
                    className={
                      plants.length > 1 ? `${styles.plant} ${styles.plantGroup}` : styles.plant
                    }
                  >
                    {plants.map((code) => (
                      <span key={code} className={styles.plantCode}>
                        {code}
                      </span>
                    ))}
                  </div>
                  <ul className={styles.cases}>
                    {rule.cases.map((c) => (
                      <li key={c.when}>{c.when}</li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>

          <p className={styles.foot}>Anything else is outside International.</p>
        </div>
      ) : null}
    </Modal>
  );
}
