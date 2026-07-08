"use client";

import { useEffect, useRef, useState } from "react";
import type { PeriodOption } from "@/data/types";
import styles from "./PeriodSelect.module.css";

/**
 * Period picker for the Content header: a styled trigger pill + a custom
 * popover list, so the options match the app's look instead of the browser's
 * default <select> menu. Keyboard-operable (arrows / Home / End / Enter / Esc)
 * and closes on outside click.
 */
export function PeriodSelect({
  options,
  value,
  year,
  onChange,
}: {
  options: PeriodOption[];
  value: number;
  year: string;
  onChange: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.n === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDoc, true);
    document.addEventListener("keydown", onKey, true);
    // Move focus onto the active option so arrow keys work immediately.
    const active =
      listRef.current?.querySelector<HTMLElement>('[data-active="true"]') ??
      listRef.current?.querySelector<HTMLElement>('[role="option"]');
    active?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDoc, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const onListKey = (e: React.KeyboardEvent) => {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[Math.min(items.length - 1, i + 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[Math.max(0, i - 1)]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const pick = (n: number) => {
    onChange(n);
    setOpen(false);
    btnRef.current?.focus();
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Period — cumulative year to date through the selected month"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.label}>
          {current?.label} {year}
        </span>
        <span className={`${styles.chev} ${open ? styles.chevOpen : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className={styles.menu} role="listbox" aria-label="Period" ref={listRef} onKeyDown={onListKey}>
          {options.map((o) => {
            const active = o.n === value;
            return (
              <button
                key={o.n}
                type="button"
                role="option"
                aria-selected={active}
                data-active={active}
                tabIndex={-1}
                className={`${styles.option} ${active ? styles.optionActive : ""}`}
                onClick={() => pick(o.n)}
              >
                <span className={styles.check} aria-hidden="true">
                  {active ? "✓" : ""}
                </span>
                <span className={styles.optLabel}>
                  {o.label} {year}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
