import type { CurrentView, GeoArea, Market, MetricCell } from "@/data/types";
import { cellTriple, components, hasShipments, type Metric } from "@/lib/contentMetrics";
import { fmtCompact, fmtPctSigned, fmtRatio, sign, trend } from "@/lib/format";
import styles from "./InsightStrip.module.css";

/** Resolve a row's cell for the active area (fall back to ALL). */
function resolveCell(row: CurrentView["rows"][number], area: GeoArea): MetricCell | null {
  const map = row.geo_data;
  const key = Object.prototype.hasOwnProperty.call(map, area) ? area : "ALL";
  return map[key] ?? null;
}

function Card({
  kicker,
  value,
  valueTone,
  glyph,
  sub,
}: {
  kicker: string;
  value: string;
  valueTone?: "pos" | "neg" | "muted";
  glyph?: string;
  sub: React.ReactNode;
}) {
  return (
    <div className={styles.card}>
      <span className={styles.kicker}>{kicker}</span>
      <span className={`${styles.value} ${valueTone ? styles[valueTone] : ""}`}>
        {glyph && <span className={styles.glyph}>{glyph} </span>}
        {value}
      </span>
      <span className={styles.sub}>{sub}</span>
    </div>
  );
}

export function InsightStrip({
  view,
  area,
  market,
  metric,
}: {
  view: CurrentView;
  area: GeoArea;
  market: Market;
  metric: Metric;
}) {
  const isEff = metric === "efficiency";
  const unit = metric === "shipments" ? "shipments" : "pieces";

  // Cards 1 & 2 — REP vs LM (the headline divergence). In efficiency mode these
  // become the aggregate batch size (Σpieces / Σshipments) and its YoY.
  const totals = (mk: Market) => {
    if (isEff) {
      let pc = 0, pp = 0, sc = 0, sp = 0;
      for (const row of view.rows) {
        const c = components(resolveCell(row, area), mk);
        pc += c.pieces.cur; pp += c.pieces.py; sc += c.shipments.cur; sp += c.shipments.py;
      }
      const cur = sc > 0 ? pc / sc : 0;
      const py = sp > 0 ? pp / sp : 0;
      return { cur, py, yoy: cur > 0 && py > 0 ? (cur - py) / py : null };
    }
    let cur = 0, py = 0;
    for (const row of view.rows) {
      const t = cellTriple(resolveCell(row, area), metric, mk);
      cur += t.cur; py += t.py;
    }
    return { cur, py, yoy: py > 0 ? (cur - py) / py : null };
  };
  const rep = totals("REP");
  const lm = totals("LM");
  const totalSub = (t: { cur: number }) =>
    isEff ? `${fmtRatio(t.cur)} pcs/ship` : `${fmtCompact(t.cur)} ${unit}`;

  // Cards 3 & 4 — biggest gainer / decliner for the ACTIVE market. Pieces /
  // shipments rank by absolute change (cur − py); efficiency ranks by the
  // batch-size YoY% (with a shipment floor so a tiny base can't dominate).
  const movers = view.rows
    .map((row) => {
      const cell = resolveCell(row, area);
      if (isEff) {
        const e = cellTriple(cell, "efficiency", market);
        const comp = components(cell, market);
        const ok = hasShipments(cell, market) && comp.shipments.py >= 50 && e.yoy != null;
        return { row, yoy: e.yoy, rankBy: ok ? e.yoy! : null, cur: e.cur };
      }
      const t = cellTriple(cell, metric, market);
      const ok = t.cur > 0 || t.py > 0;
      return { row, yoy: t.yoy, rankBy: ok ? t.cur - t.py : null, cur: t.cur };
    })
    .filter((m): m is { row: CurrentView["rows"][number]; yoy: number | null; rankBy: number; cur: number } => m.rankBy != null);

  const top = movers.reduce<(typeof movers)[number] | null>(
    (best, m) => (m.rankBy > 0 && (!best || m.rankBy > best.rankBy) ? m : best),
    null,
  );
  const watch = movers.reduce<(typeof movers)[number] | null>(
    (worst, m) => (m.rankBy < 0 && (!worst || m.rankBy < worst.rankBy) ? m : worst),
    null,
  );

  const moverSub = (m: (typeof movers)[number]) =>
    isEff ? (
      <>
        {m.row.category}
        <span className={styles.dot}> · </span>
        {fmtRatio(m.cur)} pcs/ship
      </>
    ) : (
      <>
        {m.row.category}
        <span className={styles.dot}> · </span>
        {(m.rankBy >= 0 ? "+" : "−") + fmtCompact(Math.abs(m.rankBy))} {unit}
      </>
    );

  return (
    <section className={styles.strip} aria-label="Key insights">
      <Card
        kicker="Replenishment · REP"
        value={fmtPctSigned(rep.yoy)}
        valueTone={sign(rep.yoy)}
        glyph={trend(rep.yoy)}
        sub={
          <>
            {totalSub(rep)}
            <span className={styles.dot}> · </span>bulk to DCs
          </>
        }
      />
      <Card
        kicker="Last Mile · LM"
        value={fmtPctSigned(lm.yoy)}
        valueTone={sign(lm.yoy)}
        glyph={trend(lm.yoy)}
        sub={
          <>
            {totalSub(lm)}
            <span className={styles.dot}> · </span>to ECP / customer
          </>
        }
      />
      <Card
        kicker={`${isEff ? "Most improved" : "Top engine"} · ${market}`}
        value={top ? fmtPctSigned(top.yoy) : "—"}
        valueTone={top ? "pos" : "muted"}
        glyph={top ? trend(top.yoy) : ""}
        sub={top ? moverSub(top) : isEff ? "No efficiency gain in scope" : "No growth in scope"}
      />
      <Card
        kicker={`Watch · ${market}`}
        value={watch ? fmtPctSigned(watch.yoy) : "—"}
        valueTone={watch ? "neg" : "muted"}
        glyph={watch ? trend(watch.yoy) : ""}
        sub={watch ? moverSub(watch) : isEff ? "No efficiency drop in scope" : "No decline in scope"}
      />
    </section>
  );
}
