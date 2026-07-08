import type { GeoArea, TopSite } from "@/data/types";
import { Tag } from "@/components/ui/Tag";
import { toneForProduct } from "@/lib/tags";
import { fmtInt, fmtPct } from "@/lib/format";
import { areaLabel } from "@/data/geo";
import styles from "./Coverage.module.css";

/** Ranked site callout (1–3) for the scoped area. */
export function TopSiteCard({
  rank,
  site,
  area,
}: {
  rank: 1 | 2 | 3;
  site: TopSite;
  area: GeoArea;
}) {
  const hasShare =
    site.top_product != null && site.share_pct != null && site.share_pct !== undefined;

  return (
    <article className={`${styles.card} ${styles[`rank${rank}`]}`}>
      <div className={styles.rankNum}>#{rank}</div>
      <div>
        <div className={styles.site}>{site.site}</div>
        <div className={styles.ship}>
          <b>{fmtInt(site.shipments)}</b>
          <span className={styles.unit}>shipments</span>
        </div>
        <div className={styles.products}>
          {site.products.map((p) => (
            <Tag key={p} tone={toneForProduct(p)} size="sm" className={styles.prodTag}>
              {p}
            </Tag>
          ))}
        </div>

        {hasShare && (
          <div className={styles.share}>
            <div className={styles.shareHead}>
              <span className={styles.sharePct}>{fmtPct(site.share_pct)}</span>
              <span className={styles.shareLabel}>
                of{" "}
                <Tag tone={toneForProduct(site.top_product!)} size="sm" className={styles.prodTag}>
                  {site.top_product}
                </Tag>{" "}
                in {areaLabel(area)}
              </span>
            </div>
            <div className={styles.shareBar}>
              <span style={{ width: `${Math.min(100, (site.share_pct as number) * 100).toFixed(1)}%` }} />
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
