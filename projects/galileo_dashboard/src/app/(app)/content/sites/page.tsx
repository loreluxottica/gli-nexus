"use client";

import { Suspense } from "react";
import { GalileoData } from "@/data/GalileoData";
import { FlowSitesView } from "@/components/content-v2/FlowSitesView";

export default function FlowSitesPage() {
  return (
    <Suspense fallback={null}>
      <GalileoData needsSiteAnalysis>
        <FlowSitesView />
      </GalileoData>
    </Suspense>
  );
}
