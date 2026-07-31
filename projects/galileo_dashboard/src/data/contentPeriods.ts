/**
 * Period snapshots for Content (YTD Jan…latest).
 *
 * These used to be a separate JS chunk so the route could hydrate with only the
 * latest rows. They now arrive inside the fetched content payload, so there is
 * nothing left to download — this is just the accessor, still reached through a
 * dynamic import so the Content view keeps deferring the work of walking every
 * month until after first paint.
 */
import { getContent } from "./content";
import type { PeriodSnapshot } from "./types";

export function getContentPeriods(): Record<string, PeriodSnapshot> {
  return getContent().current_view.periods;
}
