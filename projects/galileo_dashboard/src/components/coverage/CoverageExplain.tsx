"use client";

import { Modal } from "@/components/ui/Modal";
import type { AutomationLevel } from "@/components/ui/AutomationBar";
import { fmtCompact, fmtInt, fmtPct } from "@/lib/format";
import styles from "./CoverageExplain.module.css";

export type CoverageExplainRow = {
  label: string;
  coverage_pct: number | null;
  estimated_volume: number | null;
};

export type CoverageExplainTarget =
  | {
      kind: "row";
      scope: string;
      value: number | null;
      tot_sites: number | null;
      estimated_volume: number | null;
    }
  | {
      kind: "total";
      scope: string;
      value: number | null;
      rows: CoverageExplainRow[];
    }
  | {
      kind: "automation";
      scope: string;
      level: AutomationLevel;
      low: number | null;
      mid: number | null;
      high: number | null;
    };

/**
 * Explains source Product x Area coverage and estimated-volume-weighted totals.
 */
export function CoverageExplain({
  target,
  onClose,
}: {
  target: CoverageExplainTarget | null;
  onClose: () => void;
}) {
  const open = !!target;
  const titleId = "cov-explain-title";

  return (
    <Modal open={open} onClose={onClose} labelledBy={titleId} size="sm">
      {target ? (
        <>
          <header className={styles.head}>
            <div>
              <p className={styles.kicker}>How this number works</p>
              <h2 id={titleId} className={styles.title}>
                {target.scope}
              </h2>
            </div>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              ×
            </button>
          </header>

          <div className={styles.result}>
            <span className={styles.resultValue}>
              {target.kind === "automation"
                ? target.level
                : target.value == null
                  ? "—"
                  : `${Math.round(target.value * 100)}%`}
            </span>
            <span className={styles.resultLabel}>
              {target.kind === "automation"
                ? "automation level"
                : target.kind === "total"
                  ? "total coverage"
                  : "coverage · by volume"}
            </span>
          </div>

          {target.kind === "automation" ? (
            <AutomationExplain
              level={target.level}
              low={target.low}
              mid={target.mid}
              high={target.high}
            />
          ) : target.kind === "row" ? (
            <RowExplain
              value={target.value}
              totSites={target.tot_sites}
              volume={target.estimated_volume}
            />
          ) : (
            <TotalExplain value={target.value} rows={target.rows} />
          )}
        </>
      ) : null}
    </Modal>
  );
}

function AutomationExplain({
  level,
  low,
  mid,
  high,
}: {
  level: AutomationLevel;
  low: number | null;
  mid: number | null;
  high: number | null;
}) {
  const tiers = [
    ["Low", low],
    ["Mid", mid],
    ["High", high],
  ] as const;

  return (
    <ol className={styles.steps}>
      <li className={styles.step}>
        <span className={styles.stepNum} aria-hidden="true">
          1
        </span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>Compare the three site shares</p>
          <p className={styles.stepText}>
            Each percentage is the share of distinct sites classified as Low,
            Mid, or High automation.
          </p>
          <ul className={styles.mixList}>
            {tiers.map(([label, value]) => (
              <li key={label} className={styles.mixRow}>
                <span className={styles.mixLabel}>{label}</span>
                <span className={styles.mixDetail}>{fmtPct(value, 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      </li>
      <li className={styles.step}>
        <span className={styles.stepNum} aria-hidden="true">
          2
        </span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>Use the largest share</p>
          <p className={styles.stepText}>
            The automation level is <b>{level}</b> because that tier has the
            largest share in this row.
          </p>
        </div>
      </li>
    </ol>
  );
}

function RowExplain({
  value,
  totSites,
  volume,
}: {
  value: number | null;
  totSites: number | null;
  volume: number | null;
}) {
  const tot = totSites != null && totSites > 0 ? totSites : null;
  const vol = volume != null && volume > 0 ? volume : null;

  return (
    <ol className={styles.steps}>
      <li className={styles.step}>
        <span className={styles.stepNum} aria-hidden="true">
          1
        </span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>Read the source percentage</p>
          <p className={styles.stepText}>
            This value comes directly from the <b>Coverage</b> column in
            Coverage Galileo.csv for this product and area.
          </p>
          <div className={styles.formula}>
            <span className={styles.formulaPart}>source Coverage</span>
            <span className={styles.formulaOp}>=</span>
            <span className={styles.formulaResult}>
              {value == null ? "—" : `${Math.round(value * 100)}%`}
            </span>
          </div>
        </div>
      </li>

      <li className={styles.step}>
        <span className={styles.stepNum} aria-hidden="true">
          2
        </span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>Do not promote partial volume to 100%</p>
          <p className={styles.stepText}>
            A positive Galileo Volume no longer makes a row fully covered. The
            dashboard preserves the percentage supplied by the source instead
            of deriving a second value from a yes/no rule.
          </p>
        </div>
      </li>

      <li className={styles.step}>
        <span className={styles.stepNum} aria-hidden="true">
          3
        </span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>Keep the volume as context</p>
          <p className={styles.stepText}>
            Estimated volume still describes the size of this group and is used
            to weight totals that combine several rows.
          </p>
          {(tot != null || vol != null) && (
            <p className={styles.note}>
              Here: {tot != null ? <><b>{fmtInt(tot)}</b> sites</> : null}
              {tot != null && vol != null ? " · " : null}
              {vol != null ? <><b>{fmtCompact(vol)}</b> estimated volume</> : null}.
            </p>
          )}
        </div>
      </li>
    </ol>
  );
}

function TotalExplain({
  value,
  rows,
}: {
  value: number | null;
  rows: CoverageExplainRow[];
}) {
  const usable = rows.filter(
    (r) =>
      r.coverage_pct != null &&
      r.estimated_volume != null &&
      r.estimated_volume > 0,
  );

  return (
    <ol className={styles.steps}>
      <li className={styles.step}>
        <span className={styles.stepNum} aria-hidden="true">
          1
        </span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>Each row has its own coverage</p>
          <p className={styles.stepText}>
            Every line starts from the source Coverage percentage for that
            product and area, together with its estimated-volume weight.
          </p>
        </div>
      </li>

      <li className={styles.step}>
        <span className={styles.stepNum} aria-hidden="true">
          2
        </span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>Put all the piles on one table</p>
          <p className={styles.stepText}>
            For the product total we do <b>not</b> average the row percentages
            (that would treat a tiny area like a huge one). We add the pieces
            first, then look at the share we can see.
          </p>
          {usable.length > 0 && (
            <ul className={styles.mixList}>
              {usable.map((r) => {
                const vol = r.estimated_volume!;
                const cov = r.coverage_pct!;
                const seen = Math.round(cov * vol);
                return (
                  <li key={r.label} className={styles.mixRow}>
                    <span className={styles.mixLabel}>{r.label}</span>
                    <span className={styles.mixDetail}>
                      <span className={styles.mixSeen}>{fmtCompact(seen)}</span>
                      <span className={styles.mixOf}> seen of </span>
                      <span className={styles.mixTot}>{fmtCompact(vol)}</span>
                      <span className={styles.mixPct}>
                        {" "}
                        ({Math.round(cov * 100)}%)
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className={styles.note}>
            Example: 9 of 10 pieces from a big area beat 1 of 2 from a small
            one — the total stays close to the big area.
          </p>
        </div>
      </li>

      <li className={styles.step}>
        <span className={styles.stepNum} aria-hidden="true">
          3
        </span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>One division, one number</p>
          <p className={styles.stepText}>
            Add every pile we see, add every pile overall, then divide.
          </p>
          <div className={styles.formula}>
            <span className={styles.formulaPart}>all volume we see</span>
            <span className={styles.formulaOp}>÷</span>
            <span className={styles.formulaPart}>all estimated volume</span>
            <span className={styles.formulaOp}>=</span>
            <span className={styles.formulaResult}>
              {value == null ? "—" : `${Math.round(value * 100)}%`}
            </span>
          </div>
        </div>
      </li>
    </ol>
  );
}
