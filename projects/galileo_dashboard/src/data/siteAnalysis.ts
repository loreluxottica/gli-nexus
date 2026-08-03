import type { SiteAnalysisData } from "./types";
import { loadPayload } from "./api";

/**
 * Per-site summaries (245 plants, ~270 KB) used by the efficiency-comment site
 * mentions: a comment can tag a plant and the reader opens its single-site
 * analysis.
 *
 * Not part of the core payload — only the Content route needs it, so it is
 * fetched by that route's gate and stays off the landing page entirely.
 */
let cached: SiteAnalysisData | null = null;
let names: string[] = [];

export async function loadSiteAnalysis(): Promise<SiteAnalysisData> {
  if (!cached) {
    cached = await loadPayload<SiteAnalysisData>("site_analysis");
    names = Object.keys(cached.sites).sort((a, b) => a.localeCompare(b));
  }
  return cached;
}

export function getSiteAnalysis(): SiteAnalysisData {
  if (!cached) {
    throw new Error(
      "Galileo: site_analysis payload not loaded — this component rendered outside <GalileoData needsSiteAnalysis>",
    );
  }
  return cached;
}

/** Sorted site names for the comment composer's mention picker. */
export function getSiteNames(): string[] {
  getSiteAnalysis();
  return names;
}
