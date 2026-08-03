"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { CoveragePage, CoverageRow, GeoArea, Product } from "@/data/types";
import { areaLabel, GEO_DEFAULT, isGeoArea } from "@/data/geo";
import { toneForProduct } from "@/lib/tags";
import { productLabel, productSortIndex, weightedCoverage } from "@/lib/products";
import type { TourStep } from "@/components/ui/Tour";
import { TutorialButton } from "@/components/ui/TutorialButton";
import { CovBlock, type CovEffRowVM } from "./CovBlock";
import { MappingsUnderReview } from "./MappingsUnderReview";
import styles from "./Coverage.module.css";

const Tour = dynamic(() => import("@/components/ui/Tour").then((m) => m.Tour), {
  ssr: false,
});
/** SVG map only — keep the rest of Coverage in the main chunk for snappy tabs. */
const CoverageMap = dynamic(
  () => import("./CoverageMap").then((m) => m.CoverageMap),
  {
    ssr: false,
    loading: () => <div className={styles.mapSkeleton} aria-hidden="true" />,
  },
);

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
        <strong>Estimated volume</strong> (expected volume weight),{" "}
        <strong>Coverage % vol</strong> (volume we see ÷ total volume),{" "}
        <strong>Automation level</strong> (Low / Mid / High), and the
        numeric tier split.
      </>
    ),
  },
];

function toAreaRows(product: Product, rows: CoverageRow[]): CovEffRowVM[] {
  return rows.map((r) => ({
    chipTone: toneForProduct(product),
    chipLabel: areaLabel(r.area as GeoArea),
    chipClass: styles.chipArea,
    tot_sites: r.tot_sites,
    estimated_volume: r.estimated_volume,
    coverage_pct: r.coverage_pct,
    low: r.low,
    mid: r.mid,
    high: r.high,
  }));
}

function toProductRows(rows: CoverageRow[]): CovEffRowVM[] {
  return rows.map((r) => ({
    chipTone: toneForProduct(r.product!),
    chipLabel: productLabel(r.product!),
    chipClass: styles.chipProduct,
    tot_sites: r.tot_sites,
    estimated_volume: r.estimated_volume,
    coverage_pct: r.coverage_pct,
    low: r.low,
    mid: r.mid,
    high: r.high,
  }));
}

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

  const productBlocks = useMemo(
    () =>
      [...page.coverage_efficiency]
        .sort((a, b) => productSortIndex(a.product) - productSortIndex(b.product))
        .map((block) => ({
          product: block.product,
          title: productLabel(block.product),
          totalCoverage: weightedCoverage(block.rows),
          rows: toAreaRows(block.product, block.rows),
        })),
    [page.coverage_efficiency],
  );

  const areaBlock = useMemo(() => {
    if (isGlobal) return null;
    const block = page.coverage_by_area.find((b) => b.area === area);
    if (!block) return null;
    const rows = [...block.rows].sort(
      (a, b) => productSortIndex(a.product!) - productSortIndex(b.product!),
    );
    return {
      title: areaLabel(area),
      totalCoverage: weightedCoverage(rows),
      rows: toProductRows(rows),
      area,
    };
  }, [isGlobal, page.coverage_by_area, area]);

  return (
    <>
      <section className={`panel ${styles.hero}`}>
        <header className={styles.heroHead}>
          <h2>Coverage &amp; Efficiency</h2>
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

      <div data-tour="cov-map">
        <CoverageMap activeArea={area} onSelect={selectArea} />
      </div>

      {isGlobal
        ? productBlocks.map((block, bi) => (
            <div key={block.product} className={styles.blockSlot}>
              <CovBlock
                title={block.title}
                totalCoverage={block.totalCoverage}
                firstColLabel="Area"
                dataTour={bi === 0 ? "cov-block" : undefined}
                dataAttr={{ product: block.product }}
                rows={block.rows}
              />
            </div>
          ))
        : areaBlock ? (
            <CovBlock
              title={areaBlock.title}
              totalCoverage={areaBlock.totalCoverage}
              firstColLabel="Product"
              dataTour="cov-block"
              dataAttr={{ area: areaBlock.area }}
              rows={areaBlock.rows}
            />
          ) : (
            <section className="panel">
              <p className={styles.lede}>No coverage data for {areaLabel(area)}.</p>
            </section>
          )}

      <MappingsUnderReview page={page} area={area} />

      {tourOpen ? (
        <Tour
          steps={TOUR_STEPS}
          open
          onClose={() => setTourOpen(false)}
          label="Coverage tutorial"
        />
      ) : null}
    </>
  );
}
