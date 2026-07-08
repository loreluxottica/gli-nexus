"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** id of the element labelling the dialog (aria-labelledby). */
  labelledBy?: string;
  children: ReactNode;
}

/**
 * Accessible dialog: focus trap + Escape + scroll lock + return focus on close.
 * (The prototype had Escape/initial/return focus but no trap — MASTER §5 #3.)
 */
export function Modal({ open, onClose, labelledBy, children }: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // Render only after mount so the body portal never runs during SSR/first
  // hydration render (server emits null → client must match before portaling).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;

    restoreRef.current = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    const getFocusable = () =>
      card ? Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE)) : [];

    // Initial focus -> first focusable inside the dialog.
    getFocusable()[0]?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const items = getFocusable();
        if (items.length === 0) {
          e.preventDefault();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  // Portal to <body> so the overlay escapes the `.content` stacking context
  // (position:relative; z-index:2) — otherwise the fixed masthead/page-tabs
  // (siblings of .content) paint OVER the modal and clip its top, and the
  // overlay can't own the scroll. Rendered on body it sits above all chrome and
  // scrolls freely.
  if (!open || !mounted) return null;

  return createPortal(
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={cardRef}
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
