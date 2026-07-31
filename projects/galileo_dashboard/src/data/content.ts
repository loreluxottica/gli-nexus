import type { Content } from "./types";
import { loadPayload } from "./api";

/**
 * Main content payload (formerly window.CONTENT).
 *
 * Fetched at runtime rather than imported: the numbers live in Databricks, and
 * baking them into the export meant a data load could not reach the dashboard
 * without a rebuild. `loadContent()` is awaited once by <GalileoData>; every
 * component below that gate reads it synchronously with `getContent()`.
 *
 * Geo helpers live in ./geo so client chrome need not touch this module.
 */
let cached: Content | null = null;

export async function loadContent(): Promise<Content> {
  if (!cached) cached = await loadPayload<Content>("content");
  return cached;
}

export function getContent(): Content {
  if (!cached) {
    throw new Error(
      "Galileo: content payload not loaded — this component rendered outside <GalileoData>",
    );
  }
  return cached;
}

/** Geo values that are valid in the URL ?area= param. */
export function geoOptions(): Content["geo_options"] {
  return getContent().geo_options;
}

export { GEO_DEFAULT, isGeoArea, areaLabel } from "./geo";
