import { Suspense } from "react";
import { content } from "@/data/content";
import { CoverageView } from "@/components/coverage/CoverageView";

/**
 * Server passes the coverage_page slice. The 108 KB world-map SVG is lazy-imported
 * inside CoverageMap (client), so it only loads on this route, on Global.
 */
export default function CoveragePage() {
  return (
    <Suspense fallback={null}>
      <CoverageView page={content.coverage_page} />
    </Suspense>
  );
}
