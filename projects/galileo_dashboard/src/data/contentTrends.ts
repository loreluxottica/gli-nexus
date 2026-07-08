import trendsJson from "./content_trends.json";
import type { ContentTrends } from "./types";

/**
 * Monthly trend series powering the Content V2 sparklines. Compact (~14 KB),
 * built from db.json by scripts/build_content_trends.py — the heavy db.json
 * itself stays out of this route (it is lazy-loaded only on /database).
 */
export const contentTrends = trendsJson as unknown as ContentTrends;
