"use client";

import { Fragment } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { GeoArea } from "@/data/types";
import { areaLabel, GEO_DEFAULT, isGeoArea } from "@/data/geo";
import styles from "./AreaTabs.module.css";

/**
 * Top-level dimension selector. The active area lives in the URL (?area=)
 * so every page is deep-linkable and back/forward works (MASTER §4, deep-linking).
 */
export function AreaTabs({ options }: { options: GeoArea[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const raw = params.get("area");
  const active: GeoArea = isGeoArea(raw) ? raw : GEO_DEFAULT;

  const select = (area: GeoArea) => {
    const next = new URLSearchParams(params.toString());
    if (area === GEO_DEFAULT) next.delete("area");
    else next.set("area", area);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return (
    <nav className={styles.areatabs} aria-label="Geographical Area" data-tour="area-tabs">
      {options.map((a) => {
        const isActive = a === active;
        // GEO_DEFAULT ("Global") is the starting point: styled as an anchored
        // base segment and set off from the drill-down areas by a divider.
        const isHome = a === GEO_DEFAULT;
        return (
          <Fragment key={a}>
            <button
              type="button"
              className={`${styles.areatab} ${isHome ? styles.home : ""} ${
                isActive ? styles.active : ""
              }`}
              aria-pressed={isActive}
              onClick={() => select(a)}
            >
              {areaLabel(a)}
            </button>
            {isHome && <span className={styles.divider} aria-hidden="true" />}
          </Fragment>
        );
      })}
    </nav>
  );
}
