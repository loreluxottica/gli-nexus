import type { ReactNode } from "react";
import type { TagTone } from "@/components/ui/Tag";
import { Tag } from "@/components/ui/Tag";
import { CoverageBar } from "@/components/ui/CoverageBar";
import { fmtInt, fmtPct } from "@/lib/format";
import styles from "./Coverage.module.css";

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

/** A coverage/efficiency block: marker + title + the efficiency table. */
export function CovBlock({
  title,
  firstColLabel,
  dataAttr,
  rows,
  dataTour,
}: {
  title: ReactNode;
  firstColLabel: string;
  dataAttr: { product?: string; area?: string };
  rows: CovEffRowVM[];
  /** Optional tutorial anchor for the first block on the page. */
  dataTour?: string;
}) {
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
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{firstColLabel}</th>
              <th scope="col" className={styles.num}>Tot sites</th>
              <th scope="col" className={styles.num}>Estimated volume</th>
              <th scope="col" className={styles.num}>Coverage % vol</th>
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
                <td className={styles.num}>{fmtInt(r.tot_sites)}</td>
                <td className={styles.num}>{fmtInt(r.estimated_volume)}</td>
                <td className={`${styles.num} ${styles.covCell}`}>
                  <CoverageBar value={r.coverage_pct} />
                </td>
                <TierCell value={r.low} tier="low" />
                <TierCell value={r.mid} tier="mid" />
                <TierCell value={r.high} tier="high" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
