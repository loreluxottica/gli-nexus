import data from "./site_analysis.json";
import type { SiteAnalysisData } from "./types";

/**
 * Per-site summaries (245 plants, ~60 KB) built from db.json by
 * scripts/build_site_analysis.py. Used by the efficiency-comment site mentions:
 * a comment can tag a plant and the reader opens its single-site analysis.
 */
export const siteAnalysis = data as unknown as SiteAnalysisData;

/** Sorted site names for the comment composer's mention picker. */
export const siteNames = Object.keys(siteAnalysis.sites).sort((a, b) => a.localeCompare(b));
