import type { Market } from "@/data/types";
import type { Metric } from "@/lib/contentMetrics";
import styles from "./MarketMetricToggle.module.css";

export type { Metric };

/**
 * Two segmented controls: Market (REP / LM) and Metric (Pieces / Shipments).
 * REP (Replenishment, bulk to DCs) and LM (Last Mile, to the ECP/customer) are
 * different units — a REP shipment carries ~380× more pieces than an LM one —
 * so the table shows ONE market at a time on its own scale rather than blending
 * them. Implemented as radiogroups for keyboard/AT support.
 */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.group}>
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

export function MarketMetricToggle({
  market,
  metric,
  onMarket,
  onMetric,
}: {
  market: Market;
  metric: Metric;
  onMarket: (m: Market) => void;
  onMetric: (m: Metric) => void;
}) {
  return (
    <div className={styles.bar} data-tour="v2-toggle">
      <Segmented<Market>
        label="Market"
        value={market}
        onChange={onMarket}
        options={[
          { value: "REP", label: "REP", hint: "Replenishment — bulk flow to DCs/warehouses" },
          { value: "LM", label: "LM", hint: "Last Mile — delivery to the ECP / end customer" },
        ]}
      />
      <Segmented<Metric>
        label="Metric"
        value={metric}
        onChange={onMetric}
        options={[
          { value: "pieces", label: "Pieces", hint: "Volume moved" },
          { value: "shipments", label: "Shipments", hint: "Number of shipments" },
          {
            value: "efficiency",
            label: "Efficiency",
            hint: "Pieces per shipment — batch size; pieces and shipments together",
          },
        ]}
      />
    </div>
  );
}
