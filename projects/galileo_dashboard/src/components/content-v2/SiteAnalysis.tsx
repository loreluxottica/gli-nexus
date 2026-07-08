"use client";

import type { SiteMarketMetrics } from "@/data/types";
import { siteAnalysis } from "@/data/siteAnalysis";
import { Button } from "@/components/ui/Button";
import { fmtCompact, fmtPctSigned, fmtRatio, sign, trend } from "@/lib/format";
import styles from "./SiteAnalysis.module.css";

const yoy = (cur: number, py: number) => (py > 0 ? (cur - py) / py : null);
const ratio = (p: number, s: number) => (s > 0 ? p / s : null);

function Chip({ yoyVal }: { yoyVal: number | null }) {
  return (
    <span className={`${styles.chip} ${styles[sign(yoyVal)]}`}>
      {trend(yoyVal)} {fmtPctSigned(yoyVal)}
    </span>
  );
}

function Tile({
  label,
  value,
  yoyVal,
}: {
  label: string;
  value: string;
  yoyVal: number | null;
}) {
  return (
    <div className={styles.tile}>
      <span className={styles.tileLabel}>{label}</span>
      <span className={styles.tileVal}>{value}</span>
      <Chip yoyVal={yoyVal} />
    </div>
  );
}

function marketRow(name: string, m: SiteMarketMetrics) {
  const pCur = m.pieces.cur;
  const sCur = m.shipments.cur;
  const eCur = ratio(pCur, sCur);
  const ePy = ratio(m.pieces.py, m.shipments.py);
  return {
    name,
    has: pCur > 0 || m.pieces.py > 0,
    pieces: { v: fmtCompact(pCur), yoy: yoy(pCur, m.pieces.py) },
    ships: { v: fmtCompact(sCur), yoy: yoy(sCur, m.shipments.py) },
    eff: { v: fmtRatio(eCur), yoy: eCur != null && ePy != null && ePy > 0 ? (eCur - ePy) / ePy : null },
  };
}

export function SiteAnalysis({
  site,
  onBack,
  onClose,
}: {
  site: string;
  onBack: () => void;
  onClose: () => void;
}) {
  const s = siteAnalysis.sites[site];

  return (
    <>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack}>
          ← Back to KPI
        </button>
        <Button variant="icon" aria-label="Close" onClick={onClose}>
          ×
        </Button>
      </header>

      {!s ? (
        <p className={styles.empty}>No data for site &ldquo;{site}&rdquo;.</p>
      ) : (
        (() => {
          const tot = {
            pCur: s.rep.pieces.cur + s.lm.pieces.cur,
            pPy: s.rep.pieces.py + s.lm.pieces.py,
            sCur: s.rep.shipments.cur + s.lm.shipments.cur,
            sPy: s.rep.shipments.py + s.lm.shipments.py,
          };
          const effCur = ratio(tot.pCur, tot.sCur);
          const effPy = ratio(tot.pPy, tot.sPy);
          const rows = [marketRow("REP", s.rep), marketRow("LM", s.lm)].filter((r) => r.has);

          return (
            <>
              <h2 className={styles.title}>
                {site}
                <span className={styles.geo}>{s.geo}</span>
              </h2>
              <p className={styles.subtitle}>
                Site analysis · {siteAnalysis.period_label} {siteAnalysis.year} vs{" "}
                {siteAnalysis.prior_year}
              </p>

              <div className={styles.tags}>
                {s.products.map((p) => (
                  <span key={p} className={styles.tag}>
                    {p}
                  </span>
                ))}
                {s.site_types.map((t) => (
                  <span key={t} className={`${styles.tag} ${styles.tagType}`}>
                    {t}
                  </span>
                ))}
                {s.areas.length > 1 && (
                  <span className={`${styles.tag} ${styles.tagType}`}>
                    {s.areas.join(" · ")}
                  </span>
                )}
              </div>

              <div className={styles.tiles}>
                <Tile label="Volume (pieces)" value={fmtCompact(tot.pCur)} yoyVal={yoy(tot.pCur, tot.pPy)} />
                <Tile label="Shipments" value={fmtCompact(tot.sCur)} yoyVal={yoy(tot.sCur, tot.sPy)} />
                <Tile
                  label="Batch size (pcs/ship)"
                  value={fmtRatio(effCur)}
                  yoyVal={effCur != null && effPy != null && effPy > 0 ? (effCur - effPy) / effPy : null}
                />
              </div>

              <h3 className={styles.h3}>By market</h3>
              <div className={styles.table}>
                <div className={`${styles.row} ${styles.rowHead}`}>
                  <span>Market</span>
                  <span className={styles.colNum}>Pieces</span>
                  <span className={styles.colNum}>Shipments</span>
                  <span className={styles.colNum}>Pcs/ship</span>
                </div>
                {rows.map((r) => (
                  <div key={r.name} className={styles.row}>
                    <span className={styles.mkt}>{r.name}</span>
                    <span className={styles.colNum}>
                      {r.pieces.v} <Chip yoyVal={r.pieces.yoy} />
                    </span>
                    <span className={styles.colNum}>
                      {r.ships.v} <Chip yoyVal={r.ships.yoy} />
                    </span>
                    <span className={styles.colNum}>
                      {r.eff.v} <Chip yoyVal={r.eff.yoy} />
                    </span>
                  </div>
                ))}
              </div>
            </>
          );
        })()
      )}
    </>
  );
}
