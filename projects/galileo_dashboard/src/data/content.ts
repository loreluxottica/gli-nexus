import contentJson from "./content.json";
import type { Content } from "./types";

/**
 * The static content payload (formerly window.CONTENT).
 * Imported directly so it is bundled/tree-shaken per route rather than loaded
 * as a global side-effect script. The heavy DB records (db.js) stay OUT of this
 * module and are lazy-loaded only on the Database route (Phase 4).
 *
 * Pure geo helpers (GEO_DEFAULT, isGeoArea, areaLabel) live in ./geo so that
 * client components can use them WITHOUT bundling this payload.
 */
export const content = contentJson as unknown as Content;

/** Geo values that are valid in the URL ?area= param. */
export const GEO_OPTIONS = content.geo_options;

export { GEO_DEFAULT, isGeoArea, areaLabel } from "./geo";
