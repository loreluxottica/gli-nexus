import type { Product } from "@/data/types";

/** Coverage / product table order: Frames → GV → RX → Stock Lenses. */
export const PRODUCT_ORDER: Product[] = [
  "Finished Frames",
  "GV Frames",
  "RX",
  "Stock Lenses",
];

/** Short UI labels for product blocks and chips. */
export function productLabel(product: string): string {
  switch (product) {
    case "Finished Frames":
      return "Frames";
    case "GV Frames":
      return "GV";
    default:
      return product;
  }
}

/** Stable sort key for product lists (unknown products go last). */
export function productSortIndex(product: string): number {
  const i = PRODUCT_ORDER.indexOf(product as Product);
  return i === -1 ? PRODUCT_ORDER.length : i;
}

/**
 * Volume-weighted coverage across area/product rows.
 * Each row's coverage_pct is already volume-weighted within the row; this
 * re-weights those % by expected volume so the product/area total matches
 * overall covered volume ÷ total volume.
 */
export function weightedCoverage(
  rows: { coverage_pct: number | null; estimated_volume: number | null }[],
): number | null {
  let weighted = 0;
  let totalVol = 0;
  for (const r of rows) {
    const vol = r.estimated_volume;
    const cov = r.coverage_pct;
    if (vol == null || vol <= 0 || cov == null) continue;
    weighted += cov * vol;
    totalVol += vol;
  }
  if (totalVol <= 0) return null;
  return weighted / totalVol;
}
