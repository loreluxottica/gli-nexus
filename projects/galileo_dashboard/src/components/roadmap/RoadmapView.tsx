"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  roadmap,
  STATUS_LABEL,
  type BulletIconKind,
  type RoadmapBullet,
  type RoadmapItem,
  type RoadmapStatus,
} from "@/data/roadmap";
import styles from "./Roadmap.module.css";

/**
 * Development roadmap — a Gantt read left to right, with a live TODAY line
 * splitting delivered work from what is still ahead.
 *
 * Division of labour: the CHART answers "when, and how far along" purely
 * visually, so the PANEL never repeats it. The panel carries what a bar
 * cannot say — what the phase delivers, what it adds, and its gates.
 *
 * It opens on the full plan with the running phase selected. "Present" is
 * opt-in: it reveals the phases one at a time under the presenter's control.
 * Arrow keys step, Esc leaves.
 *
 * Fully self-contained: content lives in src/data/roadmap.ts, styles in the
 * sibling CSS module, no shared component or global token is touched.
 */

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// --- Time axis (static data, so resolved once at module load) ---------------
const A0 = Date.parse(`${roadmap.axis.start}T00:00:00Z`);
const A1 = Date.parse(`${roadmap.axis.end}T23:59:59Z`);
const SPAN = A1 - A0;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
/** Position on the axis, in %, clamped to the visible window. */
const pct = (t: number) => clamp(((t - A0) / SPAN) * 100, 0, 100);

/** Share of an active bar already covered, 0-100; null when not applicable. */
const progressOf = (item: RoadmapItem, now: number | null) =>
  item.status === "active" && now !== null
    ? clamp(((now - ms(item.start)) / (ms(item.end) - ms(item.start))) * 100, 0, 100)
    : null;

/** The phase the panel lands on before anyone clicks: whatever is running. */
const DEFAULT_PICK =
  roadmap.items.find((i) => i.status === "active")?.id ?? roadmap.items[0]?.id ?? null;

function fmtMonth(iso: string) {
  const d = new Date(ms(iso));
  return `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Short month stamp printed under a milestone flag. */
function monthTag(iso: string) {
  return MONTHS_SHORT[new Date(ms(iso)).getUTCMonth()].toUpperCase();
}

const MONTHS = (() => {
  const end = new Date(ms(roadmap.axis.end));
  const start = new Date(ms(roadmap.axis.start));
  const out: { key: string; label: string; left: number; width: number }[] = [];
  let y = start.getUTCFullYear();
  let m = start.getUTCMonth();
  while (y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth())) {
    const from = Date.UTC(y, m, 1);
    const to = Date.UTC(y, m + 1, 1);
    out.push({
      key: `${y}-${m}`,
      label: MONTHS_SHORT[m],
      left: ((from - A0) / SPAN) * 100,
      width: ((to - from) / SPAN) * 100,
    });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return out;
})();

/** Month spans grouped per calendar year, for the year strip above the months. */
const YEARS = (() => {
  const out: { year: number; left: number; width: number }[] = [];
  for (const m of MONTHS) {
    const year = Number(m.key.split("-")[0]);
    const last = out[out.length - 1];
    if (last && last.year === year) last.width += m.width;
    else out.push({ year, left: m.left, width: m.width });
  }
  return out;
})();

/** Small inline symbols for decorated bullets (no icon dependency). */
function BulletIcon({ kind }: { kind: BulletIconKind }) {
  const common = {
    className: styles.bulletIcon,
    "aria-hidden": true,
    viewBox: "0 0 24 24",
  } as const;
  if (kind === "glasses")
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <circle cx="7" cy="14" r="3.4" />
        <circle cx="17" cy="14" r="3.4" />
        <path d="M10.4 14h3.2" />
        <path d="M3.6 14 2.2 9.5" />
        <path d="M20.4 14l1.4-4.5" />
      </svg>
    );
  if (kind === "lens")
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.7">
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    );
  return (
    <svg {...common} fill="currentColor">
      <path d="M13 2 5.5 13.5h4.7L9 22l8.5-12.5h-4.7L13 2Z" />
    </svg>
  );
}

/**
 * One block of substance.
 *
 * In an `add` group the marker is always a "+", so every addition reads as
 * "+ Wearables" — the plus stays OUTSIDE the pill, and any icon sits inside
 * it next to the label. An emphasised point becomes that pill: the treatment
 * that marks a real new capability rather than a line of detail.
 */
function PointGroup({
  title,
  points,
  add,
}: {
  title: string;
  points: RoadmapBullet[];
  add?: boolean;
}) {
  return (
    <div className={styles.group}>
      <h3 className={styles.colTitle}>{title}</h3>
      <ul className={`${styles.points} ${add ? styles.pointsAdd : ""}`}>
        {points.map((p) => {
          const b = typeof p === "string" ? { text: p, icon: undefined, emphasis: false } : p;
          return (
            <li key={b.text}>
              <span className={styles.marker} aria-hidden="true">
                {add ? "+" : <span className={styles.dot} />}
              </span>
              <span className={`${styles.pointBody} ${b.emphasis ? styles.emphasis : ""}`}>
                {b.icon && <BulletIcon kind={b.icon} />}
                <span className={styles.pointText}>{b.text}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * The detail for one phase. Rendered for EVERY phase, not just the selected
 * one, so the panel can size itself to the tallest of them (see the stack in
 * the panel below); the layer around it controls which is actually visible.
 */
function PhaseDetail({ item }: { item: RoadmapItem }) {
  // The first gate not yet passed gets the NEXT tag.
  const nextGateId = item.milestones?.find((m) => m.status !== "done")?.id ?? null;
  const lane = roadmap.lanes.find((l) => l.id === item.lane)?.title;

  return (
    <>
      {/* Status sits beside the title rather than under it: the head had
          spare width and no spare height. */}
      <header className={styles.panelHead}>
        <div className={styles.panelId}>
          <span className={styles.panelLane}>
            {lane}
            <span className={styles.panelLaneSep} aria-hidden="true">
              /
            </span>
            {item.label}
          </span>
          <h2 className={styles.panelTitle}>{item.headline}</h2>
        </div>
        <p className={styles.stance}>
          <span className={`${styles.stanceStatus} ${styles[item.status]}`}>
            {STATUS_LABEL[item.status]}
          </span>
        </p>
      </header>

      {/* Payoff and gates are SEPARATE columns, not stacked: side by side the
          body is only as tall as the tallest single group. */}
      <div className={`${styles.panelGrid} ${item.milestones ? styles.withGates : ""}`}>
        <div className={styles.substance}>
          {item.delivers && item.delivers.length > 0 && (
            <PointGroup title="What it delivers" points={item.delivers} />
          )}
          {item.adds && item.adds.length > 0 && (
            <PointGroup title="What it adds" points={item.adds} add />
          )}
        </div>

        <div className={styles.aside}>
          <div className={styles.group}>
            <h3 className={styles.colTitle}>Why it matters</h3>
            <p className={styles.impact}>{item.impact}</p>
          </div>
        </div>

        {item.milestones && (
          <div className={styles.aside}>
            <div className={styles.group}>
              <h3 className={styles.colTitle}>Validation gates</h3>
              <ol className={styles.gates}>
                {item.milestones.map((mst) => (
                  <li
                    key={mst.id}
                    className={`${styles[mst.status]} ${
                      mst.id === nextGateId ? styles.next : ""
                    }`}
                  >
                    <span className={styles.gateDot} aria-hidden="true" />
                    <span className={styles.gateLabel}>{mst.label}</span>
                    {mst.id === nextGateId && <span className={styles.nextTag}>next</span>}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function RoadmapView() {
  // Step index while presenting; null = free browsing, which is how the page
  // opens — a cold visitor gets the whole plan, not step 0 of a walkthrough.
  const [step, setStep] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(DEFAULT_PICK);
  // Resolved after mount only: the build-time date must not leak into the
  // static HTML, or the TODAY line would drift and hydration would mismatch.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => setNow(Date.now()), []);

  const items = roadmap.items;
  const currentId = step !== null ? items[step].id : picked;
  const current = items.find((i) => i.id === currentId) ?? null;

  const exit = useCallback(() => {
    setStep((s) => {
      if (s !== null) setPicked(items[s].id);
      return null;
    });
  }, [items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;

      if (e.key === "Escape") {
        if (step !== null) exit();
        else setPicked(null);
        return;
      }

      // The same keys drive both modes, so the plan is fully navigable from
      // the keyboard whether or not you are presenting.
      const last = items.length - 1;
      let target: (from: number) => number;
      if (e.key === "ArrowRight" || e.key === "PageDown") target = (f) => f + 1;
      else if (e.key === "ArrowLeft" || e.key === "PageUp") target = (f) => f - 1;
      else if (e.key === "Home") target = () => 0;
      else if (e.key === "End") target = () => last;
      else return;

      e.preventDefault();
      if (step !== null) {
        setStep((s) => clamp(target(s ?? 0), 0, last));
      } else {
        setPicked((p) => {
          const from = items.findIndex((it) => it.id === p);
          // Nothing selected yet: step onto the first phase rather than nowhere.
          return items[clamp(target(from < 0 ? 0 : from), 0, last)].id;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, items, exit]);

  const byLane = useMemo(() => {
    const map = new Map<string, { item: RoadmapItem; index: number }[]>();
    items.forEach((item, index) => {
      const list = map.get(item.lane) ?? [];
      list.push({ item, index });
      map.set(item.lane, list);
    });
    return map;
  }, [items]);

  const todayPct = now === null ? null : pct(now);
  const todayVisible = now !== null && now >= A0 && now <= A1;
  // Header signal: what is running. Derived from static data, so unlike the
  // TODAY line it renders on the server too.
  const running = items.filter((i) => i.status === "active").map((i) => i.label);

  return (
    <div className={styles.shell}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h1 className={styles.title}>{roadmap.title}</h1>
          {running.length > 0 && (
            <p className={styles.signal}>
              <span className={styles.signalDot} aria-hidden="true" />
              <em>{running.join(" + ")} running now</em>
            </p>
          )}
        </div>

        <div className={styles.headTools}>
          <ul className={styles.legend}>
            {(["done", "active", "planned"] as RoadmapStatus[]).map((s) => (
              <li key={s} className={styles.legendItem}>
                <span className={`${styles.swatch} ${styles[s]}`} aria-hidden="true" />
                {STATUS_LABEL[s]}
              </li>
            ))}
          </ul>
          {/* Position in the walkthrough. Lives here rather than in a floating
              control card: stepping is a keyboard job, so all that is left to
              show is where you are. */}
          {step !== null && (
            <p className={styles.stepNow}>
              <span className={styles.stepIdx}>{step + 1}</span>
              <span className={styles.stepOf}>/ {items.length}</span>
              <span className={styles.kbdHint} aria-hidden="true">
                <kbd>←</kbd>
                <kbd>→</kbd>
              </span>
            </p>
          )}
          <button
            type="button"
            className={styles.present}
            onClick={() => (step === null ? setStep(0) : exit())}
            aria-pressed={step !== null}
          >
            <span aria-hidden="true">{step === null ? "▶" : "■"}</span>
            {step === null ? "Present" : "Full plan"}
          </button>
        </div>
      </header>

      <div className={styles.chart}>
        {/* Month gridlines, year boundaries and today marker, drawn once
            across every lane. */}
        <div className={styles.overlay} aria-hidden="true">
          <div className={styles.grid}>
            {todayVisible && todayPct !== null && (
              <span className={styles.past} style={{ width: `${todayPct}%` }} />
            )}
            {MONTHS.map((m) => (
              <span key={m.key} className={styles.gridline} style={{ left: `${m.left}%` }} />
            ))}
            {YEARS.slice(1).map((y) => (
              <span key={y.year} className={styles.yearline} style={{ left: `${y.left}%` }} />
            ))}
            {todayVisible && todayPct !== null && (
              <span className={styles.today} style={{ left: `${todayPct}%` }}>
                <span className={styles.todayTag}>TODAY</span>
              </span>
            )}
          </div>
        </div>

        <div className={styles.axisRow}>
          <div aria-hidden="true" />
          <div className={styles.track}>
            <div className={styles.yearBand}>
              {YEARS.map((y) => (
                <span
                  key={y.year}
                  className={styles.yearSeg}
                  style={{ left: `${y.left}%`, width: `${y.width}%` }}
                >
                  {y.year}
                </span>
              ))}
            </div>
            <div className={styles.monthBand}>
              {MONTHS.map((m) => (
                <span
                  key={m.key}
                  className={styles.month}
                  style={{ left: `${m.left}%`, width: `${m.width}%` }}
                >
                  {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {roadmap.lanes.map((lane) => {
          const laneItems = byLane.get(lane.id) ?? [];
          // Only a lane with milestone flags needs the taller track: their
          // labels hang below the bar. The others stay compact.
          const hasGates = laneItems.some(({ item }) => item.milestones?.length);

          return (
            <div key={lane.id} className={`${styles.lane} ${hasGates ? styles.hasGates : ""}`}>
              <div className={styles.laneLabel}>
                <span className={styles.laneTitle}>{lane.title}</span>
                {lane.subtitle && <span className={styles.laneSub}>{lane.subtitle}</span>}
              </div>

              <div className={styles.track}>
                {laneItems.map(({ item, index }) => {
                  const left = pct(ms(item.start));
                  const right = pct(ms(item.end));
                  const width = Math.max(right - left, 1.5);
                  const revealed = step === null || index <= step;
                  const isCurrent = item.id === currentId;
                  const progress = progressOf(item, now);

                  return (
                    <div
                      key={item.id}
                      className={`${styles.slot} ${revealed ? styles.shown : styles.hidden} ${
                        step !== null && !isCurrent && revealed ? styles.faded : ""
                      }`}
                    >
                      <button
                        type="button"
                        className={`${styles.bar} ${styles[item.status]} ${
                          isCurrent ? styles.current : ""
                        }`}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        onClick={() => {
                          if (step !== null) setStep(index);
                          else setPicked((p) => (p === item.id ? null : item.id));
                        }}
                        aria-pressed={isCurrent}
                        tabIndex={revealed ? 0 : -1}
                        aria-hidden={!revealed}
                      >
                        {progress !== null && (
                          <span
                            className={styles.progress}
                            style={{ width: `${progress}%` }}
                            aria-hidden="true"
                          />
                        )}
                        <span className={styles.barLabel}>{item.label}</span>
                        {item.open && (
                          <span className={styles.tail} aria-hidden="true">
                            ›››
                          </span>
                        )}
                        <span className={styles.srOnly}>
                          {" "}
                          {STATUS_LABEL[item.status]}, {fmtMonth(item.start)} to{" "}
                          {fmtMonth(item.end)}
                          {progress !== null ? `, ${Math.round(progress)}% complete` : ""}
                        </span>
                      </button>

                      {item.milestones?.map((mst) => {
                        const p = pct(ms(mst.date));
                        const align = p > 88 ? "right" : p < 6 ? "left" : "mid";
                        return (
                          <span
                            key={mst.id}
                            className={`${styles.ms} ${styles[mst.status]}`}
                            style={{ left: `${p}%` }}
                            data-align={align}
                          >
                            <span className={styles.msDot} aria-hidden="true" />
                            <span className={styles.msLabel}>
                              <span className={styles.msName}>{mst.label}</span>
                              <span className={styles.msWhen}>{monthTag(mst.date)}</span>
                            </span>
                          </span>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail panel. Deliberately says nothing the chart already shows: no
          repeated dates, no status chip, no duplicated progress figure.

          EVERY phase is rendered, all into the same grid cell, with only the
          current one visible. The cell therefore measures the tallest phase
          and the box never changes size between steps — the browser works the
          height out, instead of it being a pixel guess that drifts the moment
          the content is edited. */}
      <section className={styles.panel}>
        {/* One concise announcement per selection, instead of making the
            whole panel a live region that re-reads every bullet. */}
        <p className={styles.srOnly} aria-live="polite">
          {current ? `${current.headline}. ${STATUS_LABEL[current.status]}.` : ""}
        </p>

        <div className={styles.panelStack}>
          {items.map((item) => (
            <div
              key={item.id}
              className={styles.panelLayer}
              // Drives visibility in CSS too, so the visual and accessible
              // states cannot drift apart.
              aria-hidden={item.id !== currentId}
            >
              <PhaseDetail item={item} />
            </div>
          ))}

          {!current && (
            <p className={styles.hint}>
              Use <kbd>←</kbd> <kbd>→</kbd> to move through the phases, or press{" "}
              <strong>Present</strong> to walk the plan one step at a time.
            </p>
          )}
        </div>
      </section>

    </div>
  );
}
