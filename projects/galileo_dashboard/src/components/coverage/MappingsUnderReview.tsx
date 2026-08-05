"use client";

import { useMemo, useState } from "react";
import type { CoveragePage, GeoArea, UnderReviewSite } from "@/data/types";
import { areaLabel } from "@/data/geo";
import { Tag } from "@/components/ui/Tag";
import { toneForArea } from "@/lib/tags";
import { fmtCompact, fmtPct } from "@/lib/format";
import styles from "./Coverage.module.css";

/**
 * Sites explicitly marked UNMAPPED in the Coverage source, grouped by product
 * family. Expanding a product shows each site with its estimated volume and the
 * weight that volume has on current coverage (share of product-family × area
 * total). Sites with no estimated volume are marked "under review".
 */

function groupByArea(sites: UnderReviewSite[]) {
  const map = new Map<string, UnderReviewSite[]>();
  for (const s of sites) {
    const list = map.get(s.area) ?? [];
    list.push(s);
    map.set(s.area, list);
  }
  const order = ["EMEA", "NA", "APAC", "LATAM"];
  return order
    .filter((a) => map.has(a))
    .map((a) => ({ area: a, sites: map.get(a)! }));
}

function SiteRow({ site }: { site: UnderReviewSite }) {
  const hasVol = site.estimated_volume != null && site.estimated_volume > 0;
  return (
    <li className={styles.murSiteRow}>
      <span className={styles.murSiteMain}>
        <span className={styles.murSiteName}>{site.site}</span>
        {site.site_type ? (
          <span className={styles.murSiteType}>{site.site_type}</span>
        ) : null}
      </span>
      {hasVol ? (
        <span className={styles.murSiteMetrics}>
          <span className={styles.murSiteVol} title="Estimated volume">
            {fmtCompact(site.estimated_volume)}
          </span>
          <span
            className={styles.murSiteWeight}
            title="Share of estimated volume in this product × area — how hard this site pulls on coverage"
          >
            {fmtPct(site.weight_pct, 1)} weight
          </span>
        </span>
      ) : (
        <span className={styles.murSiteReview}>under review</span>
      )}
    </li>
  );
}

export function MappingsUnderReview({ page, area }: { page: CoveragePage; area: GeoArea }) {
  const isGlobal = area === "ALL";
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const blocks = useMemo(
    () =>
      page.mappings_under_review.map((b) => {
        const sites = isGlobal ? b.sites : b.sites.filter((s) => s.area === area);
        return {
          product: b.product,
          sites,
          unmapped: sites.length,
        };
      }),
    [page.mappings_under_review, isGlobal, area],
  );
  const total = useMemo(
    () => blocks.reduce((s, b) => s + b.unmapped, 0),
    [blocks],
  );

  const toggle = (product: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(product) ? next.delete(product) : next.add(product);
      return next;
    });

  return (
    <section className={`panel ${styles.mur}`}>
      <header className={styles.murHead}>
        <div>
          <h3 className={styles.murTitle}>Sites not mapped</h3>
          <p className={styles.murLede}>
            Estimated volume and its weight on current coverage
            {isGlobal ? "" : ` · ${areaLabel(area)}`}
          </p>
        </div>
        <span className={styles.murCount}>
          <b>{total}</b> site{total === 1 ? "" : "s"}
        </span>
      </header>

      <div className={styles.murList}>
        {blocks.map((b) => {
          const isOpen = open.has(b.product) && b.unmapped > 0;
          const empty = b.unmapped === 0;
          const panelId = `snm-${b.product.replace(/\s+/g, "-")}`;
          return (
            <div key={b.product} className={styles.murItem} data-open={isOpen}>
              <button
                type="button"
                className={styles.murRow}
                aria-expanded={isOpen}
                aria-controls={panelId}
                disabled={empty}
                onClick={() => toggle(b.product)}
              >
                <span
                  className={`${styles.murChev} ${isOpen ? styles.murChevOpen : ""} ${
                    empty ? styles.murChevHidden : ""
                  }`}
                  aria-hidden="true"
                >
                  ▸
                </span>
                <span className={styles.murProduct}>{b.product}</span>
                {empty ? (
                  <span className={`${styles.murBadge} ${styles.murBadgeOk}`}>All mapped</span>
                ) : (
                  <span className={styles.murBadge}>{b.unmapped} not mapped</span>
                )}
              </button>

              {isOpen && (
                <div id={panelId} className={styles.murPanel}>
                  <div className={styles.murColHead} aria-hidden="true">
                    <span>Site</span>
                    <span>Est. volume · weight</span>
                  </div>
                  {isGlobal ? (
                    <div className={styles.murGroups}>
                      {groupByArea(b.sites).map((g) => (
                        <div key={g.area} className={styles.murGroup}>
                          <div className={styles.murGroupHead}>
                            <Tag tone={toneForArea(g.area)} size="sm">
                              {g.area}
                            </Tag>
                            <span className={styles.murGroupCount}>{g.sites.length}</span>
                          </div>
                          <ul className={styles.murSiteList}>
                            {g.sites.map((s) => (
                              <SiteRow key={`${b.product}-${s.site}`} site={s} />
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <ul className={styles.murSiteList}>
                      {b.sites.map((s) => (
                        <SiteRow key={`${b.product}-${s.site}`} site={s} />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
