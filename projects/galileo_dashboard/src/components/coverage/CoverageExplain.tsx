"use client";

import { Modal } from "@/components/ui/Modal";
import { fmtCompact, fmtInt } from "@/lib/format";
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
    };

/**
 * Kid-simple coverage explainer. Logic only — no source-system jargon.
 *
 * Coverage = estimated volume of sites that feed Galileo
 *            ÷ all estimated volume in the group.
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
              {target.value == null ? "—" : `${Math.round(target.value * 100)}%`}
            </span>
            <span className={styles.resultLabel}>
              {target.kind === "total" ? "total coverage" : "coverage · by volume"}
            </span>
          </div>

          {target.kind === "row" ? (
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
  const coveredVol =
    vol != null && value != null ? Math.round(value * vol) : null;
  const units = 10;
  const filled = value != null ? Math.round(Math.max(0, Math.min(1, value)) * units) : 0;

  return (
    <ol className={styles.steps}>
      <li className={styles.step}>
        <span className={styles.stepNum} aria-hidden="true">
          1
        </span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>Think in piles, not just sites</p>
          <p className={styles.stepText}>
            Each site has a pile of pieces — its <b>estimated volume</b>.
            A huge plant counts for more than a tiny lab.
          </p>
          {tot != null && (
            <p className={styles.note}>
              Here: <b>{fmtInt(tot)}</b> sites
              {vol != null ? (
                <>
                  {" "}
                  · about <b>{fmtCompact(vol)}</b> estimated volume in total
                </>
              ) : null}
              .
            </p>
          )}
        </div>
      </li>

      <li className={styles.step}>
        <span className={styles.stepNum} aria-hidden="true">
          2
        </span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>Is the site already in Galileo?</p>
          <p className={styles.stepText}>
            If a site is already sending data, we count its{" "}
            <b className={styles.yes}>whole pile</b> as covered.
            If it is not yet in Galileo, that pile counts as{" "}
            <b className={styles.no}>zero</b>.
          </p>
          <div className={styles.dotRow} aria-hidden="true">
            {Array.from({ length: units }, (_, i) => (
              <span
                key={i}
                className={i < filled ? styles.dotYes : styles.dotNo}
              />
            ))}
          </div>
          <div className={styles.legend}>
            <span>
              <i className={styles.dotYes} /> volume we already see
            </span>
            <span>
              <i className={styles.dotNo} /> volume still outside
            </span>
          </div>
        </div>
      </li>

      <li className={styles.step}>
        <span className={styles.stepNum} aria-hidden="true">
          3
        </span>
        <div className={styles.stepBody}>
          <p className={styles.stepTitle}>Divide the piles</p>
          <p className={styles.stepText}>
            Coverage is simply: volume we see ÷ all estimated volume.
          </p>
          {coveredVol != null && vol != null && value != null ? (
            <div className={styles.formula}>
              <span className={styles.formulaPart}>{fmtCompact(coveredVol)}</span>
              <span className={styles.formulaOp}>÷</span>
              <span className={styles.formulaPart}>{fmtCompact(vol)}</span>
              <span className={styles.formulaOp}>=</span>
              <span className={styles.formulaResult}>
                {Math.round(value * 100)}%
              </span>
            </div>
          ) : (
            <div className={styles.formula}>
              <span className={styles.formulaPart}>volume we see</span>
              <span className={styles.formulaOp}>÷</span>
              <span className={styles.formulaPart}>all estimated volume</span>
              <span className={styles.formulaOp}>=</span>
              <span className={styles.formulaResult}>
                {value == null ? "—" : `${Math.round(value * 100)}%`}
              </span>
            </div>
          )}
          <p className={styles.note}>
            So a few large sites can move the % more than many small ones.
          </p>
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
            For every line in the table we already know: of that group&apos;s
            estimated volume, how much comes from sites already in Galileo.
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
