import { Suspense } from "react";
import { content } from "@/data/content";
import { contentTrends } from "@/data/contentTrends";
import { ContentViewV2 } from "@/components/content-v2/ContentViewV2";
import type { CurrentView, PeriodSnapshot } from "@/data/types";

/**
 * Content — volumes / YoY surface.
 *
 * Payload slim-down: ship only the *latest* period cells in `view.rows`.
 * Full multi-month `periods` map is a separate client chunk (~75 KB) loaded
 * when the user changes the period (or prefetched on idle) — keeps section
 * switches snappy.
 */
function slimView(full: CurrentView): CurrentView {
  const n = full.period_number;
  const latest: PeriodSnapshot = full.periods[n] ?? {
    rows: full.rows.map((r) => ({ geo_data: r.geo_data, acct_data: r.acct_data })),
    drills: {},
  };
  return {
    ...full,
    // Keep a single snapshot so the client can still resolve the default
    // without waiting on the periods chunk.
    periods: { [n]: latest },
  };
}

export default function ContentPage() {
  return (
    <Suspense fallback={null}>
      <ContentViewV2
        view={slimView(content.current_view)}
        drills={content.export_labs_sites}
        trends={contentTrends}
        periodsLazy
      />
    </Suspense>
  );
}
