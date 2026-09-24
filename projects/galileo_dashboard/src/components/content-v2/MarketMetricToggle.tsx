import type { Market } from "@/data/types";
import styles from "./MarketMetricToggle.module.css";

/**
 * Segmented controls: Market (REP / LM) and, optionally, Perimeter.
 * REP (Replenishment, Intra-Network flows) and LM (Last Mile, to the ECP/customer) are
 * different units — a REP shipment carries ~380× more pieces than an LM one —
 * so the table shows ONE market at a time on its own scale rather than blending
 * them. Implemented as radiogroups for keyboard/AT support.
 */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  dataTour,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  dataTour?: string;
}) {
  return (
    <div className={styles.group} data-tour={dataTour}>
      <span className={styles.label}>{label}</span>
      <div className={styles.track} role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              className={`${styles.seg} ${active ? styles.active : ""}`}
              onClick={() => onChange(o.value)}
              title={o.hint}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type Perimeter = "geo" | "acct";

export function MarketMetricToggle({
  market,
  acct,
  onMarket,
  onAcct,
}: {
  market: Market;
  /** Accounting perimeter active. When `onAcct` is given, a Perimeter segment renders. */
  acct?: boolean;
  onMarket: (m: Market) => void;
  onAcct?: (on: boolean) => void;
}) {
  return (
    <div className={styles.bar} data-tour="v2-toggle">
      <Segmented<Market>
        label="Market"
        value={market}
        onChange={onMarket}
        options={[
          { value: "REP", label: "REP", hint: "Replenishment — Intra-Network flows" },
          { value: "LM", label: "LM", hint: "Last Mile — delivery to the ECP / end customer" },
        ]}
      />
      {onAcct && (
        <Segmented<Perimeter>
          label="Perimeter"
          value={acct ? "acct" : "geo"}
          onChange={(v) => onAcct(v === "acct")}
          dataTour="content-acct"
          options={[
            { value: "geo", label: "Geographical", hint: "Scope by Geographical Area" },
            {
              value: "acct",
              label: "Accounting",
              hint: "International accounting perimeter — the geo area filter does not apply",
            },
          ]}
        />
      )}
    </div>
  );
}
