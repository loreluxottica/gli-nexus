import contentJson from "./content.json";
import type { Content } from "./types";

/**
 * Static content payload (formerly window.CONTENT).
 * Imported per route; heavy db.json is lazy-loaded only on /database.
 * Geo helpers live in ./geo so client chrome need not import this module.
 */
export const content = contentJson as unknown as Content;

/** Geo values that are valid in the URL ?area= param. */
export const GEO_OPTIONS = content.geo_options;

export { GEO_DEFAULT, isGeoArea, areaLabel } from "./geo";
