import { Suspense } from "react";
import { content } from "@/data/content";
import { contentTrends } from "@/data/contentTrends";
import { ContentViewV2 } from "@/components/content-v2/ContentViewV2";

/**
 * Content — the canonical volumes view. Server component: selects the Content
 * slice of the payload (current_view + export_labs_sites) plus the compact
 * monthly trend series and passes them to the client view. Renders a single
 * market/metric at a time (REP and LM are different units and must not share a
 * scale) with an insight strip, paired YoY bars and sparklines.
 *
 * This route hosts the trend-augmented experience formerly at /content-v2; the
 * old Excel-faithful table (components/content/ContentView) is retired but kept
 * in the tree for reference. /content-v2 now redirects here.
 */
export default function ContentPage() {
  return (
    <Suspense fallback={null}>
      <ContentViewV2
        view={content.current_view}
        drills={content.export_labs_sites}
        trends={contentTrends}
      />
    </Suspense>
  );
}
