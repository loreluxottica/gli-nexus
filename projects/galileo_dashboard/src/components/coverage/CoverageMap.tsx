"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoArea } from "@/data/types";
import styles from "./Coverage.module.css";

const DEFAULT_LABEL = "Click or focus an area, then Enter to select";

/**
 * World map for picking an area on Global. SVG is lazy-loaded (108 KB) only on
 * this route. Regions are made keyboard-operable (the prototype was mouse-only):
 * each region gets tabindex/role/aria-label, and Enter/Space selects it.
 */
export function CoverageMap({
  activeArea,
  onSelect,
}: {
  activeArea: GeoArea;
  onSelect: (area: GeoArea) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);

  // Update the hover label imperatively — using state here would re-render the
  // component, which re-injects the dangerouslySetInnerHTML SVG and WIPES the
  // active/dim classes set below, making the selection vanish on mouseout.
  const showLabel = (t: string) => {
    if (labelRef.current) labelRef.current.textContent = t;
  };

  useEffect(() => {
    let alive = true;
    import("@/data/worldMap").then((m) => {
      if (alive) setSvg(m.WORLD_MAP_SVG);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Enhance injected regions for keyboard/SR once the SVG is present.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !svg) return;
    host.querySelectorAll<SVGGElement>(".region").forEach((g) => {
      const r = g.getAttribute("data-region");
      if (!r || r === "OTHER") return;
      g.setAttribute("tabindex", "0");
      g.setAttribute("role", "button");
      g.setAttribute("aria-label", `Focus ${r}`);
    });
  }, [svg]);

  // Reflect active/dim selection state on the regions.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.querySelectorAll<SVGGElement>(".region").forEach((g) => {
      const r = g.getAttribute("data-region");
      g.classList.toggle("active", activeArea !== "ALL" && r === activeArea);
      g.classList.toggle("dim", activeArea !== "ALL" && r !== activeArea && r !== "OTHER");
    });
  }, [activeArea, svg]);

  const regionFromEvent = (e: { target: EventTarget | null }): GeoArea | null => {
    const el = (e.target as Element)?.closest?.(".region") as SVGGElement | null;
    const r = el?.getAttribute("data-region");
    return r && r !== "OTHER" ? (r as GeoArea) : null;
  };

  const setHover = (r: string | null) => {
    hostRef.current?.querySelectorAll<SVGGElement>(".region").forEach((g) => {
      g.classList.toggle("hover", r !== null && g.getAttribute("data-region") === r);
    });
  };

  return (
    <section className={`panel ${styles.mapPanel}`}>
      <div className={styles.mapBar}>
        <h3 className={styles.mapTitle}>Geographical coverage</h3>
        <div ref={labelRef} className={styles.mapLabel}>{DEFAULT_LABEL}</div>
      </div>

      {svg ? (
        <div
          ref={hostRef}
          className={styles.mapHost}
          onClick={(e) => {
            const r = regionFromEvent(e);
            if (r) onSelect(r);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              const r = regionFromEvent(e);
              if (r) {
                e.preventDefault();
                onSelect(r);
              }
            }
          }}
          onMouseOver={(e) => {
            const r = regionFromEvent(e);
            if (r) {
              setHover(r);
              showLabel(r);
            }
          }}
          onMouseOut={() => {
            setHover(null);
            showLabel(DEFAULT_LABEL);
          }}
          onFocus={(e) => {
            const r = regionFromEvent(e);
            if (r) {
              setHover(r);
              showLabel(r);
            }
          }}
          onBlur={() => {
            setHover(null);
            showLabel(DEFAULT_LABEL);
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        <div className={`${styles.mapHost} ${styles.mapSkeleton}`} aria-hidden="true" />
      )}
    </section>
  );
}
