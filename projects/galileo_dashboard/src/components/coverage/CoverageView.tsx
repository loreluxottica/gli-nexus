"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { CoveragePage, GeoArea } from "@/data/types";
import { areaLabel, GEO_DEFAULT, isGeoArea } from "@/data/geo";
import { toneForProduct } from "@/lib/tags";
import { Tag } from "@/components/ui/Tag";
import { Tour, type TourStep } from "@/components/ui/Tour";
import { TutorialButton } from "@/components/ui/TutorialButton";
import { CoverageMap } from "./CoverageMap";
import { CovBlock, type CovEffRowVM } from "./CovBlock";
import { TopSiteCard } from "./TopSiteCard";
import styles from "./Coverage.module.css";

/** Walkthrough of how to read the Coverage & Efficiency view. */
const TOUR_STEPS: TourStep[] = [
  {
    title: "How to read Coverage",
    body: (
      <>
        A work-in-progress view of how well each <strong>area and product</strong>{" "}
        is covered. This tour shows how to read it.
      </>
    ),
  },
  {
    target: '[data-tour="area-tabs"]',
    title: "Global or one area",
    body: (
      <>
        Switch between the global view (all areas) and a single area here, or
        use the map below.
      </>
    ),
  },
  {
    target: '[data-tour="cov-map"]',
    title: "Pick on the map",
    body: (
      <>
        Click or focus a region to scope the page to that area. The selected
        area stays highlighted.
      </>
    ),
  },
  {
    target: '[data-tour="cov-block"]',
    title: "Read the table",
    body: (
      <>
        Left to right: <strong>Tot sites</strong>,{" "}
        <strong>Estimated volume</strong> (current YTD pieces),{" "}
        <strong>Coverage % vol</strong> (covered share), and the{" "}
        <strong>Low / Mid / High</strong> split of sites by automation tier.
      </>
    ),
  },
  {
    title: "Top sites per area",
    body: (
      <>
        Pick a single area (on the tabs or the map) to reveal its{" "}
        <strong>top sites by shipments</strong> below the table.
      </>
    ),
  },
];

export function CoverageView({ page }: { page: CoveragePage }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("area");
  const area = isGeoArea(raw) ? raw : GEO_DEFAULT;
  const isGlobal = area === "ALL";
  const [tourOpen, setTourOpen] = useState(false);

  const selectArea = (next: GeoArea) => {
    const sp = new URLSearchParams(params.toString());
    if (next === GEO_DEFAULT) sp.delete("area");
    else sp.set("area", next);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const topSites = !isGlobal ? page.top_sites_by_area[area as Exclude<GeoArea, "ALL">] ?? [] : [];

  return (
    <>
      <section className={`panel ${styles.hero}`}>
        <header className={styles.heroHead}>
          <h2>
            Coverage &amp; Efficiency{" "}
            <Tag tone="brass" size="sm" uppercase>
              POC
            </Tag>
          </h2>
          <TutorialButton onClick={() => setTourOpen(true)} />
        </header>
        <div className={styles.status}>
          <span className={`${styles.dot} ${isGlobal ? "" : styles.dotActive}`} />
          {isGlobal ? (
            <>Showing <b>all areas</b></>
          ) : (
            <>Scoped to <b>{areaLabel(area)}</b></>
          )}
        </div>
      </section>

      {/* Map stays on every scope; the active area is highlighted, the rest dimmed. */}
      <div data-tour="cov-map">
        <CoverageMap activeArea={area} onSelect={selectArea} />
      </div>

      {isGlobal
        ? page.coverage_efficiency.map((block, bi) => (
            <CovBlock
              key={block.product}
              title={block.product}
              firstColLabel="Area"
              dataTour={bi === 0 ? "cov-block" : undefined}
              dataAttr={{ product: block.product }}
              rows={block.rows.map<CovEffRowVM>((r) => ({
                chipTone: toneForProduct(block.product),
                chipLabel: areaLabel(r.area as GeoArea),
                chipClass: styles.chipArea,
                tot_sites: r.tot_sites,
                estimated_volume: r.estimated_volume,
                coverage_pct: r.coverage_pct,
                low: r.low,
                mid: r.mid,
                high: r.high,
              }))}
            />
          ))
        : (() => {
            const block = page.coverage_by_area.find((b) => b.area === area);
            if (!block) {
              return (
                <section className="panel">
                  <p className={styles.lede}>No coverage data for {areaLabel(area)}.</p>
                </section>
              );
            }
            return (
              <CovBlock
                title={areaLabel(area)}
                firstColLabel="Product"
                dataTour="cov-block"
                dataAttr={{ area }}
                rows={block.rows.map<CovEffRowVM>((r) => ({
                  chipTone: toneForProduct(r.product!),
                  chipLabel: r.product!,
                  chipClass: styles.chipProduct,
                  tot_sites: r.tot_sites,
                  estimated_volume: r.estimated_volume,
                  coverage_pct: r.coverage_pct,
                  low: r.low,
                  mid: r.mid,
                  high: r.high,
                }))}
              />
            );
          })()}

      {!isGlobal && topSites.length > 0 && (
        <section className={`panel ${styles.topSites}`} data-tour="cov-topsites">
          <header className={styles.topHead}>
            <h3>
              Top {topSites.length} sites in <span className={styles.topArea}>{areaLabel(area)}</span>
            </h3>
            <span className={styles.topSub}>by shipments · {page.top_sites_period}</span>
          </header>
          <div className={styles.topGrid}>
            {topSites.slice(0, 3).map((s, i) => (
              <TopSiteCard key={s.site} rank={(i + 1) as 1 | 2 | 3} site={s} area={area} />
            ))}
          </div>
        </section>
      )}

      <Tour
        steps={TOUR_STEPS}
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        label="Coverage tutorial"
      />
    </>
  );
}
