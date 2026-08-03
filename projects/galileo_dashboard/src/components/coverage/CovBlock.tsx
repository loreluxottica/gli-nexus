"use client";

import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import type { TagTone } from "@/components/ui/Tag";
import { Tag } from "@/components/ui/Tag";
import { CoverageBar } from "@/components/ui/CoverageBar";
import { AutomationBar } from "@/components/ui/AutomationBar";
import { fmtInt, fmtPct } from "@/lib/format";
import type { CoverageExplainTarget } from "./CoverageExplain";
import styles from "./Coverage.module.css";

const CoverageExplain = dynamic(
  () => import("./CoverageExplain").then((m) => m.CoverageExplain),
  { ssr: false },
);

/** Header-level total coverage: big % readout, not the table's bar treatment. */
function TotalCoverage({
  value,
  onOpen,
}: {
  value: number | null | undefined;
  onOpen: () => void;
}) {
  if (value === null || value === undefined) {
    return (
      <span className={styles.blockCov}>
        <span className={styles.blockCovMuted}>—</span>
      </span>
    );
  }
  const pct = Math.round(Math.max(0, Math.min(1, Number(value))) * 100);
  return (
    <button
      type="button"
      className={`${styles.blockCov} ${styles.covHit}`}
      onClick={onOpen}
      aria-label={`Total coverage ${pct}%. How this number works`}
    >
      <span className={styles.blockCovValue}>{pct}%</span>
      <span className={styles.blockCovLabel}>coverage</span>
      <span className={styles.covHint} aria-hidden="true">
        ?
      </span>
    </button>
  );
}

export interface CovEffRowVM {
  chipTone: TagTone;
  chipLabel: string;
  chipClass?: string;
  tot_sites: number | null;
  estimated_volume: number | null;
  coverage_pct: number | null;
  low: number | null;
  mid: number | null;
  high: number | null;
}

type Tier = "low" | "mid" | "high";

function TierCell({ value, tier }: { value: number | null; tier: Tier }) {
  const base = `${styles.num} ${styles.tier} ${styles[tier]}`;
  if (value === null || value === undefined) {
    return <td className={`${base} ${styles.tierMuted}`}>—</td>;
  }
  const zero = value === 0;
  return <td className={`${base} ${zero ? styles.tierZero : ""}`}>{fmtPct(value, 0)}</td>;
}

/** A coverage/efficiency block: marker + title (+ optional total coverage) + table. */
export function CovBlock({
  title,
  totalCoverage,
  firstColLabel,
  dataAttr,
  rows,
  dataTour,
}: {
  title: ReactNode;
  /** Volume-weighted total coverage shown next to the product/area title. */
  totalCoverage?: number | null;
  firstColLabel: string;
  dataAttr: { product?: string; area?: string };
  rows: CovEffRowVM[];
  /** Optional tutorial anchor for the first block on the page. */
  dataTour?: string;
}) {
  const [explain, setExplain] = useState<CoverageExplainTarget | null>(null);
  const scopeLabel = typeof title === "string" ? title : "Coverage";

  return (
    <section
      className={`panel ${styles.covBlock}`}
      data-product={dataAttr.product}
      data-area={dataAttr.area}
      data-tour={dataTour}
    >
      <header className={styles.blockHead}>
        <span className={styles.marker} aria-hidden="true" />
        <h3>{title}</h3>
        {totalCoverage !== undefined && (
          <TotalCoverage
            value={totalCoverage}
            onOpen={() =>
              setExplain({
                kind: "total",
                scope: scopeLabel,
                value: totalCoverage,
                rows: rows.map((r) => ({
                  label: r.chipLabel,
                  coverage_pct: r.coverage_pct,
                  estimated_volume: r.estimated_volume,
                })),
              })
            }
          />
        )}
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{firstColLabel}</th>
              <th scope="col" className={styles.centerHead}>Tot sites</th>
              <th scope="col" className={styles.centerHead}>Estimated volume</th>
              <th scope="col" className={styles.covHead}>Coverage % vol</th>
              <th scope="col" className={styles.autoHead}>Automation level</th>
              <th scope="col" className={`${styles.num} ${styles.lmhHead} ${styles.headLow}`}>Low</th>
              <th scope="col" className={`${styles.num} ${styles.lmhHead} ${styles.headMid}`}>Mid</th>
              <th scope="col" className={`${styles.num} ${styles.lmhHead} ${styles.headHigh}`}>High</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.chipLabel}-${i}`}>
                <td className={styles.firstCell}>
                  <Tag tone={r.chipTone} className={r.chipClass}>
                    {r.chipLabel}
                  </Tag>
                </td>
                <td className={styles.centerNum}>{fmtInt(r.tot_sites)}</td>
                <td className={styles.centerNum}>{fmtInt(r.estimated_volume)}</td>
                <td className={styles.covCell}>
                  {r.coverage_pct == null ? (
                    <span className={styles.covUnit}>
                      <CoverageBar value={r.coverage_pct} />
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={`${styles.covHit} ${styles.covUnit}`}
                      onClick={() =>
                        setExplain({
                          kind: "row",
                          scope: `${scopeLabel} · ${r.chipLabel}`,
                          value: r.coverage_pct,
                          tot_sites: r.tot_sites,
                          estimated_volume: r.estimated_volume,
                        })
                      }
                      aria-label={`Coverage ${Math.round(r.coverage_pct * 100)}%. How this number works`}
                    >
                      <CoverageBar value={r.coverage_pct} />
                      <span className={styles.covHint} aria-hidden="true">
                        ?
                      </span>
                    </button>
                  )}
                </td>
                <td className={styles.autoCell}>
                  <AutomationBar low={r.low} mid={r.mid} high={r.high} />
                </td>
                <TierCell value={r.low} tier="low" />
                <TierCell value={r.mid} tier="mid" />
                <TierCell value={r.high} tier="high" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {explain ? (
        <CoverageExplain target={explain} onClose={() => setExplain(null)} />
      ) : null}
    </section>
  );
}
