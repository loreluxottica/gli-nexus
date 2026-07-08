import type { Metadata } from "next";
import type { GeoArea, Market, Product } from "@/data/types";
import { Tag } from "@/components/ui/Tag";
import { toneForArea, toneForFlow, toneForMarket, toneForProduct } from "@/lib/tags";
import { areaLabel } from "@/data/geo";
import styles from "./styleguide.module.css";

export const metadata: Metadata = { title: "Galileo — Style Guide" };

const PRODUCTS: Product[] = ["RX", "Stock Lenses", "Finished Frames", "GV Frames"];
const AREAS: GeoArea[] = ["APAC", "EMEA", "LATAM", "NA"];
const MARKETS: Market[] = ["REP", "LM"];
const FLOWS = ["Glassed Direct", "Brille 24"];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.row}>
      <div className={styles.rowLabel}>{label}</div>
      <div className={styles.rowItems}>{children}</div>
    </div>
  );
}

export default function StyleGuide() {
  return (
    <section className="panel">
      <h2>Tag — pilot</h2>
      <p>
        One primitive replacing the prototype&rsquo;s seven pill classes
        (<code>.geo-tag</code>, <code>.product-tag</code>, <code>.market-tag</code>,
        <code> .flow-tag</code>, <code>.dim-badge</code>, <code>.intl-chip</code>,
        <code> .wip-pill</code>). Hues come from the categorical tokens; domain values
        map to tones via <code>lib/tags.ts</code>.
      </p>

      <div className={styles.grid}>
        <Row label="Products">
          {PRODUCTS.map((p) => (
            <Tag key={p} tone={toneForProduct(p)}>
              {p}
            </Tag>
          ))}
        </Row>

        <Row label="Geographical areas">
          {AREAS.map((a) => (
            <Tag key={a} tone={toneForArea(a)}>
              {areaLabel(a)}
            </Tag>
          ))}
        </Row>

        <Row label="Markets">
          {MARKETS.map((m) => (
            <Tag key={m} tone={toneForMarket(m)}>
              {m}
            </Tag>
          ))}
        </Row>

        <Row label="LM flows">
          {FLOWS.map((f) => (
            <Tag key={f} tone={toneForFlow(f)} size="sm" uppercase>
              {f}
            </Tag>
          ))}
        </Row>

        <Row label="Status (was .wip-pill)">
          <Tag tone="brass" size="sm" uppercase>
            DB
          </Tag>
          <Tag tone="brass" size="sm" uppercase>
            POC
          </Tag>
        </Row>

        <Row label="Dimension badges (was .dim-badge)">
          <Tag tone="azure" uppercase>
            Geographical Area
          </Tag>
          <Tag tone="brass" uppercase>
            Accounting Area
          </Tag>
        </Row>

        <Row label="Outline (was .intl-chip)">
          <Tag tone="brass" variant="outline" uppercase>
            International
          </Tag>
          <Tag tone="azure" variant="outline">
            Glassed Direct
          </Tag>
        </Row>

        <Row label="Sizes">
          <Tag tone="neutral" size="sm">
            sm
          </Tag>
          <Tag tone="neutral" size="md">
            md
          </Tag>
        </Row>
      </div>
    </section>
  );
}
