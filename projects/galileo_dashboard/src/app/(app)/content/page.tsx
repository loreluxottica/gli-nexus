"use client";

import { Suspense } from "react";
import { getContent } from "@/data/content";
import { getContentTrends } from "@/data/contentTrends";
import { GalileoData } from "@/data/GalileoData";
import { ContentViewV2 } from "@/components/content-v2/ContentViewV2";
import type { CurrentView, PeriodSnapshot } from "@/data/types";

/**
 * Content — volumes / YoY surface.
 *
 * Payload slim-down: render only the *latest* period cells in `view.rows`. The
 * full multi-month `periods` map already arrived with content.json, but keeping
 * the slim shape means the table does not walk every month on first paint.
 *
 * This is the only route that needs the per-plant site analysis (comment
 * mentions drill into it), so it takes the extra payload here rather than
 * making the landing and the other routes wait for it.
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
    // without walking the whole periods map.
    periods: { [n]: latest },
  };
}

function ContentBody() {
  const content = getContent();
  return (
    <ContentViewV2
      view={slimView(content.current_view)}
      drills={content.export_labs_sites}
      trends={getContentTrends()}
      periodsLazy
    />
  );
}

export default function ContentPage() {
  return (
    <Suspense fallback={null}>
      <GalileoData needsSiteAnalysis>
        <ContentBody />
      </GalileoData>
    </Suspense>
  );
}
