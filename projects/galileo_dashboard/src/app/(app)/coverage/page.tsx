"use client";

import { Suspense } from "react";
import { getContent } from "@/data/content";
import { CoverageView } from "@/components/coverage/CoverageView";

/**
 * Renders the coverage_page slice of the fetched payload. The 108 KB world-map
 * SVG is still lazy-imported inside CoverageMap (client), so it only loads on
 * this route, on Global.
 */
export default function CoveragePage() {
  return (
    <Suspense fallback={null}>
      <CoverageView page={getContent().coverage_page} />
    </Suspense>
  );
}
