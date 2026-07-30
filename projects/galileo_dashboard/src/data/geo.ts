import type { GeoArea } from "./types";

/**
 * Pure geo helpers — NO content.json import, so client components (AreaTabs)
 * can use these without pulling the content payload into the client bundle.
 */

export const GEO_DEFAULT: GeoArea = "ALL";
/** Global first, then EMEA → NA → APAC → LATAM. */
export const GEO_AREAS: GeoArea[] = ["ALL", "EMEA", "NA", "APAC", "LATAM"];

export function isGeoArea(value: string | null | undefined): value is GeoArea {
  return !!value && (GEO_AREAS as string[]).includes(value);
}

/** Human label for an area ("ALL" -> "Global"). */
export function areaLabel(area: GeoArea): string {
  return area === "ALL" ? "Global" : area;
}
