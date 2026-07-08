"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

// The pitch machinery (script, trend aggregates, spotlight) stays out of the
// shell bundle: it loads only when a ?story= stop is actually active.
const StoryMode = dynamic(() => import("./StoryMode").then((m) => m.StoryMode), {
  ssr: false,
});

/** Mounts Story mode whenever the URL carries ?story=N. Lives in the app
 *  layout so the bar survives navigation between the deep-linked stops. */
export function StoryGate() {
  const params = useSearchParams();
  return params.get("story") ? <StoryMode /> : null;
}
