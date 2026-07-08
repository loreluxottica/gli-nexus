"use client";

import { useEffect, useState } from "react";
import styles from "./FirstRunHint.module.css";

const KEY = "galileo:seen-tour";

/**
 * One-time onboarding nudge. Shows a slim banner inviting a first-time visitor
 * to take the guided tour; once started or dismissed it never shows again
 * (localStorage flag). Rendered client-side only, so it never flashes during
 * SSR / the static export.
 */
export function FirstRunHint({ onStart }: { onStart: () => void }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      /* storage unavailable — just don't nudge */
    }
  }, []);

  const seen = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className={styles.hint} role="note">
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.text}>
        New here? A 30-second tour shows how to read the trends, markets and efficiency.
      </span>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.start}
          onClick={() => {
            onStart();
            seen();
          }}
        >
          Start tour
        </button>
        <button type="button" className={styles.dismiss} onClick={seen}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
