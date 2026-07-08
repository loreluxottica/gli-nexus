"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { story } from "@/data/story";
import { contentTrends } from "@/data/contentTrends";
import { fmtCompact, fmtPctSigned, sign, trend, yoy } from "@/lib/format";
import styles from "./Story.module.css";

const stops = story.stops;

/** Network-level YTD aggregates for the overview stop, computed live from the
 *  monthly trend series so the pitch never goes stale after a data refresh.
 *  REP and LM stay side by side (different units, never one shared scale);
 *  the headline total is the only place the two piece counts are summed. */
function networkStats() {
  const n = contentTrends.period_number;
  const sum = (a: number[]) => a.slice(0, n).reduce((x, y) => x + y, 0);
  let repCur = 0;
  let repPy = 0;
  let lmCur = 0;
  let lmPy = 0;
  let shipCur = 0;
  let shipPy = 0;
  for (const areas of Object.values(contentTrends.rows)) {
    const node = areas.ALL;
    if (!node) continue;
    repCur += sum(node.REP.pieces.cy);
    repPy += sum(node.REP.pieces.py);
    lmCur += sum(node.LM.pieces.cy);
    lmPy += sum(node.LM.pieces.py);
    shipCur += sum(node.REP.shipments.cy) + sum(node.LM.shipments.cy);
    shipPy += sum(node.REP.shipments.py) + sum(node.LM.shipments.py);
  }
  return {
    period: `YTD ${contentTrends.month_labels[n - 1]} ${contentTrends.current_year}`,
    priorYear: contentTrends.prior_year,
    total: repCur + lmCur,
    tiles: [
      { label: "REP pieces", note: "bulk to DCs", cur: repCur, yoy: yoy(repCur, repPy) },
      { label: "LM pieces", note: "last mile to ECP", cur: lmCur, yoy: yoy(lmCur, lmPy) },
      { label: "Shipments", note: "REP + LM", cur: shipCur, yoy: yoy(shipCur, shipPy) },
    ],
  };
}

/** True when the key press belongs to a form field, not to story navigation. */
const isEditable = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return (
    !!el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable)
  );
};

/**
 * Story mode: the guided pitch. A fixed narration bar steps through the
 * deep-linked stops of story.json; each stop navigates the app into the right
 * state (section, area, market, metric, explorer) and optionally spotlights
 * one element. The page underneath stays fully interactive on purpose, so the
 * presenter can improvise mid-stop and then keep going. ←/→ step, Esc exits
 * leaving the app exactly in the current state.
 */
export function StoryMode() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawIdx = parseInt(params.get("story") || "1", 10);
  const idx = Math.min(stops.length, Math.max(1, Number.isNaN(rawIdx) ? 1 : rawIdx)) - 1;
  const stop = stops[idx];
  const last = idx === stops.length - 1;

  const go = useCallback(
    (i: number) => {
      if (i < 0 || i >= stops.length) return;
      const s = stops[i];
      const sep = s.href.includes("?") ? "&" : "?";
      // push (not replace) so the browser's Back also walks the stops.
      router.push(`${s.href}${sep}story=${i + 1}`, { scroll: false });
    },
    [router],
  );

  const exit = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("story");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router]);

  // ←/→ step, Esc exits. An open Modal swallows Esc first (capture phase), so
  // Esc closes the explorer before it ends the story — deliberate layering.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditable(e.target)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (last) exit();
        else go(idx + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(idx - 1);
      } else if (e.key === "Escape") {
        exit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, last, go, exit]);

  // Spotlight: follow the target with a rAF loop. This survives lazily
  // mounted route content, layout shifts and user scrolling; until the
  // target exists the story shows the bar alone.
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(
    null,
  );
  useEffect(() => {
    setRect(null);
    const sel = stop.target;
    if (!sel || stop.kind === "overview") return;
    let raf = 0;
    let scrolled = false;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tick = () => {
      const el = document.querySelector(sel);
      if (el) {
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: "center", behavior: reduced ? "auto" : "smooth" });
        }
        const r = el.getBoundingClientRect();
        setRect((p) =>
          p &&
          Math.abs(p.top - r.top) < 0.5 &&
          Math.abs(p.left - r.left) < 0.5 &&
          Math.abs(p.width - r.width) < 0.5 &&
          Math.abs(p.height - r.height) < 0.5
            ? p
            : { top: r.top, left: r.left, width: r.width, height: r.height },
        );
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stop, pathname]);

  const stats = stop.kind === "overview" ? networkStats() : null;
  const PAD = 6;

  return (
    <>
      {stats && (
        <div className={styles.overlay} role="dialog" aria-modal="false" aria-label={stop.title}>
          <div className={styles.card}>
            <p className={styles.kicker}>Galileo · {stats.period}</p>
            <h2 className={styles.cardTitle}>{stop.title}</h2>
            <p className={styles.big}>
              {fmtCompact(stats.total)} <span className={styles.bigUnit}>pieces moved</span>
            </p>
            <div className={styles.tiles}>
              {stats.tiles.map((t) => (
                <div key={t.label} className={styles.tile}>
                  <span className={styles.tileLabel}>{t.label}</span>
                  <span className={styles.tileVal}>{fmtCompact(t.cur)}</span>
                  <span className={`${styles.tileChip} ${styles[sign(t.yoy)]}`}>
                    {trend(t.yoy)} {fmtPctSigned(t.yoy)}
                  </span>
                  <span className={styles.tileNote}>{t.note}</span>
                </div>
              ))}
            </div>
            <p className={styles.cardNote}>vs the same period {stats.priorYear}</p>
          </div>
        </div>
      )}

      {!stats && rect && (
        // Dim = four explicit panels around the lit window (a single huge
        // box-shadow spread is unreliably rasterised at this size), plus the
        // accent ring on the window itself. All pointer-events free.
        <div aria-hidden="true">
          <div
            className={styles.dimPanel}
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, rect.top - PAD) }}
          />
          <div
            className={styles.dimPanel}
            style={{ top: rect.top + rect.height + PAD, left: 0, right: 0, bottom: 0 }}
          />
          <div
            className={styles.dimPanel}
            style={{
              top: Math.max(0, rect.top - PAD),
              left: 0,
              width: Math.max(0, rect.left - PAD),
              height: rect.height + PAD * 2,
            }}
          />
          <div
            className={styles.dimPanel}
            style={{
              top: Math.max(0, rect.top - PAD),
              left: rect.left + rect.width + PAD,
              right: 0,
              height: rect.height + PAD * 2,
            }}
          />
          <div
            className={styles.spot}
            style={{
              top: rect.top - PAD,
              left: rect.left - PAD,
              width: rect.width + PAD * 2,
              height: rect.height + PAD * 2,
            }}
          />
        </div>
      )}

      <div className={styles.bar} role="region" aria-label="Story mode">
        <button
          type="button"
          className={styles.navBtn}
          onClick={() => go(idx - 1)}
          disabled={idx === 0}
          aria-label="Previous stop"
        >
          ‹
        </button>
        <div className={styles.text}>
          <strong className={styles.stopTitle}>{stop.title}</strong>
          <span className={styles.stopBody}>{stop.body}</span>
        </div>
        <div className={styles.meta}>
          <span className={styles.dots} aria-hidden="true">
            {stops.map((s, i) => (
              <span key={s.id} className={`${styles.dot} ${i === idx ? styles.dotOn : ""}`} />
            ))}
          </span>
          <span className={styles.count}>
            {idx + 1} / {stops.length}
          </span>
        </div>
        <button
          type="button"
          className={`${styles.navBtn} ${styles.navNext}`}
          onClick={() => (last ? exit() : go(idx + 1))}
          aria-label={last ? "End the story" : "Next stop"}
        >
          {last ? "End" : "›"}
        </button>
        <button type="button" className={styles.closeBtn} onClick={exit} aria-label="Exit story mode">
          ×
        </button>
      </div>
    </>
  );
}
