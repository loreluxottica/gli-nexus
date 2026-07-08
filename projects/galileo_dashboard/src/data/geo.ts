import type { GeoArea } from "./types";

/**
 * Pure geo helpers — NO content.json import, so client components (AreaTabs)
 * can use these without pulling the 35 KB payload into the client bundle.
 */

export const GEO_DEFAULT: GeoArea = "ALL";
export const GEO_AREAS: GeoArea[] = ["ALL", "APAC", "EMEA", "LATAM", "NA"];

export function isGeoArea(value: string | null | undefined): value is GeoArea {
  return !!value && (GEO_AREAS as string[]).includes(value);
}

/** Human label for an area ("ALL" -> "Global"). */
export function areaLabel(area: GeoArea): string {
  return area === "ALL" ? "Global" : area;
}
