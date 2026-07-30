/**
 * Period snapshots for Content (YTD Jan…Apr). Split from the main content
 * import so the Content route can hydrate with only the latest rows, then
 * pull this chunk when the user changes period (or on idle prefetch).
 */
import contentJson from "./content.json";
import type { PeriodSnapshot } from "./types";

export const contentPeriods = (contentJson as { current_view: { periods: Record<string, PeriodSnapshot> } })
  .current_view.periods;
