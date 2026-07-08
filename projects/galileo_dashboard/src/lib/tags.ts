import type { GeoArea, Market, Product } from "@/data/types";
import type { TagTone } from "@/components/ui/Tag";
import { slug } from "./format";

/**
 * Domain value -> categorical tone. Single source of the entity↔hue mapping
 * documented in docs/design-system/tokens-audit.md. Callers never hardcode a hue.
 */

/**
 * Products share ONE uniform tone (no per-product hue) — by request: product
 * categories should read as a single family, not be color-differentiated.
 * Area / market / flow keep their distinct tones below.
 */
export function toneForProduct(_product: Product | string): TagTone {
  return "azure";
}

export function toneForArea(area: GeoArea | string): TagTone {
  switch (area) {
    case "EMEA":
      return "azure";
    case "NA":
      return "sage";
    case "LATAM":
      return "clay";
    case "APAC":
      return "brass";
    default:
      return "neutral"; // ALL / Global
  }
}

export function toneForMarket(market: Market | string): TagTone {
  switch (market) {
    case "REP":
      return "azure";
    case "LM":
      return "brass";
    default:
      return "neutral";
  }
}

/** Named LM flows (e.g. "Glassed Direct" -> azure, "Brille 24" -> brass). */
export function toneForFlow(label: string): TagTone {
  return slug(label) === "glassed-direct" ? "azure" : "brass";
}
