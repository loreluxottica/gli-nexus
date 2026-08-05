"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import styles from "./Tour.module.css";

/** One highlighted region. `selector` may match many elements; the highlight is
 *  the union of their boxes (so a whole table column block can be lit). */
export interface TourRegion {
  selector: string;
  tone?: "a" | "b";
}

export interface TourStep {
  /** Single-element spotlight (transparent cutout + accent ring). */
  target?: string;
  /** Multi-region highlight with colored tints. Takes precedence over target. */
  regions?: TourRegion[];
  title: string;
  body: ReactNode;
}

interface TourProps {
  steps: TourStep[];
  open: boolean;
  onClose: () => void;
  /** Accessible name for the whole tour, e.g. "Content tutorial". */
  label: string;
}

/** Breathing room (px) left around a highlighted element. */
const PAD = 8;

/** Two distinct light tints for multi-region steps (blue / amber). */
const TONES: Record<"a" | "b", { fill: string; stroke: string }> = {
  a: { fill: "rgba(37,83,233,0.13)", stroke: "#2553E9" },
  b: { fill: "rgba(201,146,14,0.16)", stroke: "#C9920E" },
};

type Box = { left: number; top: number; width: number; height: number; tone?: "a" | "b" };
type Rect = { left: number; top: number; width: number; height: number };
/** Where the tooltip's pointer sits, and which way it points at the anchor. */
type Caret = { left: number; top: number; dir: "up" | "down" };

const unionRect = (els: Element[]): Box | null => {
  let l = Infinity,
    t = Infinity,
    r = -Infinity,
    b = -Infinity,
    found = false;
  for (const el of els) {
    const rc = el.getBoundingClientRect();
    if (rc.width === 0 && rc.height === 0) continue;
    found = true;
    l = Math.min(l, rc.left);
    t = Math.min(t, rc.top);
    r = Math.max(r, rc.right);
    b = Math.max(b, rc.bottom);
  }
  return found ? { left: l, top: t, width: r - l, height: b - t } : null;
};

const defsOf = (s: TourStep): TourRegion[] =>
  s.regions ?? (s.target ? [{ selector: s.target }] : []);

/**
 * Guided spotlight tour. Three highlight modes per step:
 *   - `regions`: multiple colored bands (SVG mask dims the page, punches a hole
 *     per band and tints each) — used to contrast e.g. Pieces vs Shipments.
 *   - `target`: one transparent cutout with an accent ring (box-shadow dim).
 *   - neither: a centered card over a solid dim.
 * Steps whose target is absent from the page (a column hidden by the current
 * metric, a drill-down row this area does not have) are dropped when the tour
 * opens, so a visitor is never shown a card pointing at nothing — and the step
 * count stays honest. Targets are scrolled into view; highlights track
 * scroll/resize. Keyboard: Esc closes, ←/→ navigate, Tab is trapped in the
 * tooltip. The scrim catches clicks but the page is NOT scroll-locked (the tour
 * scrolls targets into view).
 */
export function Tour({ steps, open, onClose, label }: TourProps) {
  const [index, setIndex] = useState(0);
  const [live, setLive] = useState<TourStep[]>(steps);
  const [single, setSingle] = useState<Box | null>(null);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const [vp, setVp] = useState({ w: 0, h: 0 });
  const [tipStyle, setTipStyle] = useState<CSSProperties>({ opacity: 0 });
  const [caret, setCaret] = useState<Caret | null>(null);
  const [mounted, setMounted] = useState(false);

  const tipRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const maskId = useId();

  useEffect(() => setMounted(true), []);

  const step = live[index];
  const isFirst = index === 0;
  const isLast = index === live.length - 1;

  const next = useCallback(
    () => setIndex((i) => Math.min(live.length - 1, i + 1)),
    [live.length]
  );
  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const close = useCallback(() => {
    const restore = restoreRef.current;
    restoreRef.current = null;
    onCloseRef.current();
    // The parent conditionally unmounts Tour as soon as onClose runs. Restore
    // focus after that commit instead of waiting for an open=false render that
    // never occurs.
    requestAnimationFrame(() => {
      if (restore?.isConnected) restore.focus({ preventScroll: true });
    });
  }, []);

  // Measure highlight boxes + tooltip anchor for the current step.
  const measure = useCallback(() => {
    if (!step) return;
    const defs = defsOf(step);
    if (defs.length === 0) {
      setSingle(null);
      setBoxes([]);
      setAnchor(null);
      return;
    }
    const result: Box[] = [];
    for (const def of defs) {
      const u = unionRect(Array.from(document.querySelectorAll(def.selector)));
      if (u) result.push({ ...u, tone: def.tone });
    }
    if (result.length === 0) {
      setSingle(null);
      setBoxes([]);
      setAnchor(null);
      return;
    }
    const al = Math.min(...result.map((x) => x.left));
    const at = Math.min(...result.map((x) => x.top));
    const ar = Math.max(...result.map((x) => x.left + x.width));
    const ab = Math.max(...result.map((x) => x.top + x.height));
    setAnchor({ left: al, top: at, width: ar - al, height: ab - at });
    if (step.regions) {
      setBoxes(result);
      setSingle(null);
    } else {
      setSingle(result[0]);
      setBoxes([]);
    }
  }, [step]);

  // Reset to the first step on open (before paint) and drop steps whose target
  // is not on the page right now. The positioning effect makes the tooltip
  // visible — do NOT hide it here, or a centered first step would stay invisible.
  useLayoutEffect(() => {
    if (!open) return;
    const usable = steps.filter((s) => {
      const defs = defsOf(s);
      return defs.length === 0 || defs.some((d) => document.querySelector(d.selector));
    });
    setLive(usable.length > 0 ? usable : steps);
    setIndex(0);
    setVp({ w: window.innerWidth, h: window.innerHeight });
    restoreRef.current = document.activeElement as HTMLElement | null;
  }, [open, steps]);

  // Scroll the current target into view, then measure (immediately + once the
  // smooth scroll settles).
  useEffect(() => {
    if (!open || !step) return;
    const defs = defsOf(step);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (defs.length > 0) {
      const el = document.querySelector(defs[0].selector);
      el?.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "center",
        inline: "center",
      });
    }
    measure();
    const t = window.setTimeout(measure, reduce ? 0 : 320);
    return () => window.clearTimeout(t);
  }, [open, step, measure]);

  // Keep highlights aligned while the page scrolls or resizes.
  useEffect(() => {
    if (!open) return;
    let ticking = false;
    const onMove = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        setVp({ w: window.innerWidth, h: window.innerHeight });
        measure();
      });
    };
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, measure]);

  // Position the tooltip near the anchor (or centered when there's no target),
  // and aim its pointer at the middle of the highlight.
  useLayoutEffect(() => {
    if (!open || !mounted) return;
    const tip = tipRef.current;
    if (!tip) return;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 14;
    const margin = 12;
    if (!anchor) {
      setTipStyle({
        left: Math.round((vw - tw) / 2),
        top: Math.round((vh - th) / 2),
        opacity: 1,
      });
      setCaret(null);
      return;
    }
    // Prefer below the highlight, fall back above; if neither fits, pin inside
    // the viewport and drop the pointer (it would no longer tell the truth).
    let dir: Caret["dir"] | null = "up";
    let top = anchor.top + anchor.height + gap;
    if (top + th > vh - margin) {
      const above = anchor.top - gap - th;
      if (above >= margin) {
        top = above;
        dir = "down";
      } else {
        top = Math.max(margin, vh - th - margin);
        dir = null;
      }
    }
    let left = anchor.left + anchor.width / 2 - tw / 2;
    left = Math.max(margin, Math.min(left, vw - tw - margin));
    setTipStyle({ left: Math.round(left), top: Math.round(top), opacity: 1 });

    const cx = anchor.left + anchor.width / 2;
    // Only point when the highlight is actually above/below the card — a caret
    // clamped to the far edge would aim at empty space.
    if (dir && cx >= left - 4 && cx <= left + tw + 4) {
      setCaret({
        left: Math.round(Math.min(Math.max(cx, left + 20), left + tw - 20)) - 6,
        top: Math.round(dir === "up" ? top - 6 : top + th - 6),
        dir,
      });
    } else {
      setCaret(null);
    }
  }, [anchor, open, index, mounted]);

  // Land keyboard focus on the primary action each step.
  useEffect(() => {
    if (open && mounted) nextRef.current?.focus();
  }, [open, index, mounted]);

  // Keyboard: Esc closes, arrows navigate, Tab trapped inside the tooltip.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        isLast ? close() : next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      } else if (e.key === "Tab") {
        const tip = tipRef.current;
        if (!tip) return;
        const items = Array.from(
          tip.querySelectorAll<HTMLElement>("button:not([disabled])")
        );
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, isLast, next, prev, close]);

  // Restore focus to the trigger when the tour closes.
  useEffect(() => {
    if (!open && restoreRef.current) {
      restoreRef.current.focus();
      restoreRef.current = null;
    }
  }, [open]);

  const pct = useMemo(
    () => (live.length ? ((index + 1) / live.length) * 100 : 0),
    [index, live.length]
  );

  if (!open || !mounted || !step) return null;

  const pad = (b: Box) => ({
    x: Math.round(b.left - PAD),
    y: Math.round(b.top - PAD),
    w: Math.round(b.width + PAD * 2),
    h: Math.round(b.height + PAD * 2),
  });

  const hasHighlight = !!anchor;

  return createPortal(
    <div className={styles.root} role="dialog" aria-modal="true" aria-label={label}>
      <div className={`${styles.scrim} ${hasHighlight ? "" : styles.scrimSolid}`} />

      {single && (
        <div
          className={styles.spotlight}
          style={{
            left: single.left - PAD,
            top: single.top - PAD,
            width: single.width + PAD * 2,
            height: single.height + PAD * 2,
          }}
          aria-hidden="true"
        />
      )}

      {boxes.length > 0 && vp.w > 0 && (
        <svg className={styles.svg} width={vp.w} height={vp.h} aria-hidden="true">
          <defs>
            <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={vp.w} height={vp.h}>
              <rect x="0" y="0" width={vp.w} height={vp.h} fill="white" />
              {boxes.map((b, i) => {
                const p = pad(b);
                return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx="5" fill="black" />;
              })}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width={vp.w}
            height={vp.h}
            fill="rgba(15,26,40,0.62)"
            mask={`url(#${maskId})`}
          />
          {boxes.map((b, i) => {
            const p = pad(b);
            const tone = TONES[b.tone ?? "a"];
            return (
              <rect
                key={i}
                x={p.x}
                y={p.y}
                width={p.w}
                height={p.h}
                rx="5"
                fill={tone.fill}
                stroke={tone.stroke}
                strokeWidth="2"
              />
            );
          })}
        </svg>
      )}

      <div ref={tipRef} className={styles.tip} style={tipStyle}>
        <div className={styles.tipHead}>
          <span className={styles.eyebrow}>{label}</span>
          <span className={styles.counter}>
            <b>{index + 1}</b>
            <span aria-hidden="true"> / </span>
            <span className={styles.srOnly}>of </span>
            {live.length}
          </span>
          <button
            type="button"
            className={styles.close}
            onClick={close}
            aria-label="Close tutorial"
          >
            ×
          </button>
        </div>

        <div className={styles.progress} aria-hidden="true">
          <span className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>

        <h3 className={styles.tipTitle}>{step.title}</h3>
        <div className={styles.tipBody}>{step.body}</div>

        {isFirst ? (
          <p className={styles.keys}>
            <kbd>←</kbd> <kbd>→</kbd> to move · <kbd>Esc</kbd> to leave
          </p>
        ) : null}

        <div className={styles.tipFoot}>
          {isLast ? (
            <span />
          ) : (
            <button type="button" className={styles.skip} onClick={close}>
              Skip tour
            </button>
          )}
          <div className={styles.actions}>
            {!isFirst && (
              <button type="button" className={styles.back} onClick={prev}>
                Back
              </button>
            )}
            <button
              ref={nextRef}
              type="button"
              className={styles.nextBtn}
              onClick={isLast ? close : next}
            >
              {isLast ? "Done" : "Next →"}
            </button>
          </div>
        </div>
      </div>

      {caret && (
        <div
          className={`${styles.caret} ${caret.dir === "up" ? styles.caretUp : styles.caretDown}`}
          style={{ left: caret.left, top: caret.top }}
          aria-hidden="true"
        />
      )}
    </div>,
    document.body
  );
}
