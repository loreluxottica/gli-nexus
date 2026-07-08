"use client";

import { useSearchParams } from "next/navigation";
import { areaLabel, GEO_DEFAULT, isGeoArea } from "@/data/geo";

/** Reflects the active ?area on the page body — proves the URL scoping wiring. */
export function ScopeNote() {
  const raw = useSearchParams().get("area");
  const area = isGeoArea(raw) ? raw : GEO_DEFAULT;
  return (
    <p>
      Scoped to <strong>{areaLabel(area)}</strong>.
    </p>
  );
}
